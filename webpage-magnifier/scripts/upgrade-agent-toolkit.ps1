[CmdletBinding()]
param(
    [string]$TargetPath = (Join-Path $PSScriptRoot '..'),
    [switch]$AllowUnknownVersion,
    [switch]$AllowSameVersionDifferentCommit,
    [string]$ReleaseJsonPath,
    [string]$ArchivePath
)
$ErrorActionPreference = 'Stop'
if ($ReleaseJsonPath -and -not $ArchivePath) { throw '-ReleaseJsonPath requires -ArchivePath.' }

function Get-GitHubToken {
    foreach ($name in @('GH_TOKEN', 'GITHUB_TOKEN')) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return $null }
    $terminalPrompt = $env:GIT_TERMINAL_PROMPT
    $managerInteractive = $env:GCM_INTERACTIVE
    $askPass = $env:GIT_ASKPASS
    try {
        $env:GIT_TERMINAL_PROMPT = '0'
        $env:GCM_INTERACTIVE = 'never'
        $env:GIT_ASKPASS = 'false'
        try { $credential = @("protocol=https`nhost=github.com`n`n" | & git credential fill 2>$null) }
        catch { Write-Verbose 'Git credential helper was unavailable; trying anonymous access.'; return $null }
        if ($LASTEXITCODE -ne 0) { return $null }
        foreach ($line in $credential) {
            if ($line -clike 'password=*' -and $line.Length -gt 9) { return $line.Substring(9) }
        }
        return $null
    }
    finally {
        if ($null -eq $terminalPrompt) { Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue }
        else { $env:GIT_TERMINAL_PROMPT = $terminalPrompt }
        if ($null -eq $managerInteractive) { Remove-Item Env:GCM_INTERACTIVE -ErrorAction SilentlyContinue }
        else { $env:GCM_INTERACTIVE = $managerInteractive }
        if ($null -eq $askPass) { Remove-Item Env:GIT_ASKPASS -ErrorAction SilentlyContinue }
        else { $env:GIT_ASKPASS = $askPass }
    }
}

function Get-LatestGitHubRelease {
    param([string]$Token, [Net.Http.HttpMessageHandler]$Handler)
    $ownsHandler = $null -eq $Handler
    if ($ownsHandler) {
        $Handler = [Net.Http.HttpClientHandler]::new()
        $Handler.AllowAutoRedirect = $false
    }
    $client = [Net.Http.HttpClient]::new($Handler, $false)
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    $client.MaxResponseContentBufferSize = 2MB
    $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, 'https://api.github.com/repos/zzfzzf1018/ai-coding-agents/releases/latest')
    try {
        $request.Headers.TryAddWithoutValidation('User-Agent', 'agent-toolkit-upgrade') | Out-Null
        $request.Headers.TryAddWithoutValidation('Accept', 'application/vnd.github+json') | Out-Null
        if ($Token) {
            try { $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token) }
            catch { throw 'Invalid GitHub credential format.' }
        }
        try { $response = $client.SendAsync($request).GetAwaiter().GetResult() }
        catch { throw 'GitHub release lookup failed; check network and credentials.' }
        try {
            $status = [int]$response.StatusCode
            if ($status -eq 404) { throw 'No stable GitHub Release was found, or the credentials lack access. Use an authorized token or an offline ZIP.' }
            if ($status -ne 200) { throw "GitHub release lookup failed (HTTP $status); check network and credentials." }
            try { return ($response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json) }
            catch { throw 'GitHub returned invalid release metadata.' }
        }
        finally { $response.Dispose() }
    }
    finally { $request.Dispose(); $client.Dispose(); if ($ownsHandler) { $Handler.Dispose() } }
}

function Invoke-GitHubDownload {
    param([string]$Uri, [string]$Token, [string]$Destination, [Net.Http.HttpMessageHandler]$Handler)
    $ownsHandler = $null -eq $Handler
    if ($ownsHandler) {
        $Handler = [Net.Http.HttpClientHandler]::new()
        $Handler.AllowAutoRedirect = $false
    }
    $client = [Net.Http.HttpClient]::new($Handler, $false)
    $client.Timeout = [TimeSpan]::FromSeconds(60)
    try {
        $current = [Uri]$Uri
        for ($redirects = 0; $redirects -le 5; $redirects++) {
            $isApi = $current.Scheme -ceq 'https' -and $current.Host -ceq 'api.github.com' -and $current.IsDefaultPort -and -not $current.UserInfo
            $isAssetHost = $current.Scheme -ceq 'https' -and $current.IsDefaultPort -and -not $current.UserInfo -and
                $current.Host -cin @('release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com')
            if (-not $isApi -and -not $isAssetHost) { throw 'Unexpected GitHub download redirect host.' }
            $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $current)
            try {
                $request.Headers.TryAddWithoutValidation('User-Agent', 'agent-toolkit-upgrade') | Out-Null
                $request.Headers.TryAddWithoutValidation('Accept', 'application/octet-stream') | Out-Null
                if ($isApi -and $Token) {
                    try { $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token) }
                    catch { throw 'Invalid GitHub credential format.' }
                }
                try { $response = $client.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult() }
                catch { throw 'GitHub asset download failed; check network and credentials.' }
                try {
                    $status = [int]$response.StatusCode
                    if ($status -in @(301, 302, 303, 307, 308)) {
                        if (-not $response.Headers.Location) { throw 'GitHub asset redirect has no location.' }
                        try { $current = [Uri]::new($current, $response.Headers.Location) }
                        catch { throw 'GitHub asset redirect has an invalid location.' }
                        continue
                    }
                    if ($status -ne 200) { throw "GitHub asset download failed (HTTP $status); check release and credentials." }
                    if ($response.Content.Headers.ContentLength -gt 50MB) { throw 'Release archive is too large.' }
                    $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                    try {
                        $outputStream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew)
                        try {
                            $buffer = [byte[]]::new(65536)
                            $total = 0L
                            while (($count = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                                $total += $count
                                if ($total -gt 50MB) { throw 'Release archive is too large.' }
                                $outputStream.Write($buffer, 0, $count)
                            }
                        }
                        finally { $outputStream.Dispose() }
                    }
                    finally { $inputStream.Dispose() }
                    return
                }
                finally { $response.Dispose() }
            }
            finally { $request.Dispose() }
        }
        throw 'Too many GitHub asset redirects.'
    }
    finally { $client.Dispose(); if ($ownsHandler) { $Handler.Dispose() } }
}
$target = [IO.Path]::GetFullPath($TargetPath)
$manifestPath = Join-Path $target '.agent-toolkit/install-manifest.json'
# Reject a reparse point anywhere in the target or manifest path before reading.
$cursor = [IO.Path]::GetPathRoot($manifestPath)
foreach ($part in $manifestPath.Substring($cursor.Length).Split([char[]]@('\','/'), [StringSplitOptions]::RemoveEmptyEntries)) {
    $cursor = Join-Path $cursor $part
    if (Test-Path -LiteralPath $cursor) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point in target: $cursor" }
    }
}
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Target is not an installed toolkit: manifest missing.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest -isnot [System.Management.Automation.PSCustomObject] -or
    ($manifest.manifestVersion -isnot [int] -and $manifest.manifestVersion -isnot [long]) -or
    $manifest.manifestVersion -notin @(1,2) -or $manifest.files -isnot [array]) { throw 'Invalid or unsupported install manifest.' }
$knownVersion = $manifest.installationStatus -ceq 'complete' -and $manifest.toolkitVersion -is [string] -and
    $manifest.sourceModified -is [bool] -and $manifest.sourceModified -eq $false
if (-not $knownVersion -and -not $AllowUnknownVersion) { throw 'Installed version is legacy, modified, or incomplete. Inspect it and explicitly pass -AllowUnknownVersion to proceed.' }

$release = $null
$token = $null
if ($ReleaseJsonPath) {
    $release = Get-Content -LiteralPath $ReleaseJsonPath -Raw | ConvertFrom-Json
}
elseif (-not $ArchivePath) {
    $token = Get-GitHubToken
    $release = Get-LatestGitHubRelease -Token $token
}
if ($ReleaseJsonPath -or -not $ArchivePath) {
    if ($release -isnot [System.Management.Automation.PSCustomObject]) { throw 'Invalid release metadata.' }
    if ($release.draft -isnot [bool] -or $release.draft -ne $false -or
        $release.prerelease -isnot [bool] -or $release.prerelease -ne $false -or
        $release.tag_name -isnot [string] -or $release.tag_name -cnotmatch '\Av(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\z') { throw 'Release is not a stable v-prefixed SemVer release.' }
    $releaseVersion = $release.tag_name.Substring(1)
    $assetName = "agent-toolkit-$releaseVersion.zip"
    $assets = @($release.assets | Where-Object { $_.name -ceq $assetName })
    if ($assets.Count -ne 1) { throw "Release must contain exactly one $assetName asset." }
    $expectedUrl = "https://github.com/zzfzzf1018/ai-coding-agents/releases/download/$($release.tag_name)/$assetName"
    if ($assets[0].browser_download_url -cne $expectedUrl) { throw 'Unexpected release asset URL.' }
}
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('agent-toolkit-upgrade-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    $zipPath = Join-Path $temporary 'release.zip'
    if ($ArchivePath) {
        $archive = Get-Item -LiteralPath $ArchivePath
        if ($archive -isnot [IO.FileInfo] -or $archive.Length -gt 50MB) { throw 'Release archive is not a file or is too large.' }
        Copy-Item -LiteralPath $ArchivePath -Destination $zipPath
    }
    else {
        $assetId = 0L
        if (-not [long]::TryParse([string]$assets[0].id, [ref]$assetId) -or $assetId -le 0) { throw 'Release asset ID is missing or invalid.' }
        Invoke-GitHubDownload -Uri "https://api.github.com/repos/zzfzzf1018/ai-coding-agents/releases/assets/$assetId" -Token $token -Destination $zipPath
    }
    if ((Get-Item -LiteralPath $zipPath).Length -gt 50MB) { throw 'Release archive is too large.' }
    $extract = Join-Path $temporary 'content'
    New-Item -ItemType Directory -Path $extract | Out-Null
    Add-Type -AssemblyName System.IO.Compression
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        if ($zip.Entries.Count -gt 500) { throw 'Too many ZIP entries.' }
        $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        $total = 0L
        foreach ($entry in $zip.Entries) {
            $name = $entry.FullName
            if ($name -cnotmatch '\A(?:\.github/(?:copilot-instructions\.md|agents/[A-Za-z0-9._-]+|prompts/[A-Za-z0-9._-]+|skills/[A-Za-z0-9._-]+/SKILL\.md)|\.agent-toolkit/(?:settings\.schema\.json|settings\.template\.json|install-files\.json|package-version\.json)|scripts/(?:install|upgrade|package|doctor)-agent-toolkit\.ps1|scripts/validate-agent-toolkit-settings\.ps1|scripts/tests/(?:install-agent-toolkit|versioned-release)\.tests\.ps1|README\.md|GitVersion\.yml|install-agent-toolkit\.cmd|docs/(?:agent-toolkit\.md|people-requirements-record/README\.md))\z' -or
                $name -match '(?:^|/)\.{1,2}(?:/|$)' -or -not $seen.Add($name)) { throw "Unsafe or duplicate ZIP entry: $name" }
            if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000 -or ($entry.ExternalAttributes -band 0x400) -ne 0) { throw "Link or reparse ZIP entry: $name" }
            $total += $entry.Length
            if ($entry.Length -gt 10MB -or $total -gt 50MB) { throw 'Expanded archive is too large.' }
            $destination = Join-Path $extract $name
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            $inputStream = $entry.Open()
            try {
                $out = [IO.File]::Open($destination, [IO.FileMode]::CreateNew)
                try {
                    $buffer = [byte[]]::new(65536)
                    $written = 0L
                    while (($count = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                        $written += $count
                        if ($written -gt $entry.Length) { throw "ZIP entry exceeds declared size: $name" }
                        $out.Write($buffer, 0, $count)
                    }
                    if ($written -ne $entry.Length) { throw "ZIP entry size mismatch: $name" }
                }
                finally { $out.Dispose() }
            }
            finally { $inputStream.Dispose() }
        }
    }
    finally { $zip.Dispose() }
    $metadata = Get-Content -LiteralPath (Join-Path $extract '.agent-toolkit/package-version.json') -Raw | ConvertFrom-Json
    if ($metadata -isnot [System.Management.Automation.PSCustomObject] -or
        $metadata.semVer -isnot [string] -or $metadata.semVer -cnotmatch '\A(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\z' -or
        $metadata.sourceModified -isnot [bool] -or $metadata.sourceModified -ne $false -or
        $metadata.commit -isnot [string] -or $metadata.commit -cnotmatch '\A[0-9a-f]{40}\z' -or
        ($release -and $metadata.semVer -cne $releaseVersion)) { throw 'Package metadata does not match a clean stable release.' }
    $version = $metadata.semVer
    $priorVersion = if ($knownVersion) { $manifest.toolkitVersion } elseif ($manifest.installationStatus -ceq 'partial') { $manifest.lastCompleteVersion } elseif ($manifest.toolkitVersion -is [string]) { $manifest.toolkitVersion } else { $null }
    $priorCommit = if ($manifest.installationStatus -in @('complete', 'partial')) {
        if ($manifest.lastCompleteCommit) { $manifest.lastCompleteCommit } else { $manifest.sourceCommit }
    } else { $null }
    $priorIdentities = @()
    if ($priorVersion) { $priorIdentities += @{ Version = $priorVersion; Commit = $priorCommit } }
    if ($manifest.installationStatus -ceq 'partial' -and $manifest.requestedVersion) {
        $requestedCommit = if ($manifest.sourceModified -is [bool] -and -not $manifest.sourceModified) { $manifest.requestedCommit } else { $null }
        $priorIdentities += @{ Version = $manifest.requestedVersion; Commit = $requestedCommit }
    }
    foreach ($identity in $priorIdentities) {
        if ($identity.Version -isnot [string] -or $identity.Version -cnotmatch '\A(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?\z') { throw 'Invalid installed version.' }
        $installedBase = ($identity.Version -split '-')[0]
        if ([version]$version -lt [version]$installedBase) { throw "Refusing downgrade from $($identity.Version) to $version." }
        if ($identity.Version -ceq $version -and $identity.Commit -cne $metadata.commit -and -not $AllowSameVersionDifferentCommit) {
            throw 'The same version has a different or unknown source commit. Inspect it and explicitly pass -AllowSameVersionDifferentCommit to proceed.'
        }
    }
    $installer = Join-Path $PSScriptRoot 'install-agent-toolkit.ps1'
    if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw 'Trusted local installer is missing.' }
    if (-not (Get-Command -Name $installer -CommandType ExternalScript).Parameters.ContainsKey('ValidateOnly')) {
        throw 'Trusted local installer is too old for package integrity validation; use a current trusted checkout or package.'
    }
    # Validate with locally trusted code, never with the downloaded installer.
    & $installer -TargetPath $target -SourceRoot $extract -ValidateOnly
    $mapping = Get-Content -LiteralPath (Join-Path $extract '.agent-toolkit/install-files.json') -Raw | ConvertFrom-Json
    if (-not $mapping.files) { throw 'Package mapping is empty.' }
    $requiredMappings = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($pair in @(
        @('.agent-toolkit/settings.schema.json', '.agent-toolkit/settings.schema.json'),
        @('.agent-toolkit/settings.template.json', '.agent-toolkit/settings.template.json'),
        @('.agent-toolkit/settings.template.json', '.agent-toolkit/settings.json'),
        @('.agent-toolkit/install-files.json', '.agent-toolkit/install-files.json'),
        @('scripts/install-agent-toolkit.ps1', 'scripts/install-agent-toolkit.ps1'),
        @('scripts/upgrade-agent-toolkit.ps1', 'scripts/upgrade-agent-toolkit.ps1'),
        @('scripts/doctor-agent-toolkit.ps1', 'scripts/doctor-agent-toolkit.ps1'),
        @('scripts/validate-agent-toolkit-settings.ps1', 'scripts/validate-agent-toolkit-settings.ps1')
    )) { [void]$requiredMappings.Add("$($pair[0])`n$($pair[1])") }
    foreach ($file in $mapping.files) {
        if (-not $seen.Contains([string]$file.source)) { throw "Package source missing: $($file.source)" }
        $targets = @()
        if ($file.target) { $targets += $file.target }
        if ($file.targets) { $targets += $file.targets }
        if ($targets.Count -eq 0) { throw 'Package mapping target missing.' }
        foreach ($entry in $targets) {
            $name = if ($entry -is [string]) { $entry } else { [string]$entry.target }
            if ($name -cnotmatch '\A(?:AGENTS\.md|\.github/(?:copilot-instructions\.md|agents/[A-Za-z0-9._-]+|prompts/[A-Za-z0-9._-]+|skills/[A-Za-z0-9._-]+/SKILL\.md)|\.(?:trae|codebuddy|workbuddy)/(?:rules|agents|commands|skills)/[A-Za-z0-9._/-]+|\.agent-toolkit/(?:settings\.json|settings\.schema\.json|settings\.template\.json|install-files\.json)|scripts/(?:install|upgrade|doctor)-agent-toolkit\.ps1|scripts/validate-agent-toolkit-settings\.ps1|install-agent-toolkit\.cmd|docs/(?:agent-toolkit\.md|people-requirements-record/README\.md))\z' -or $name -match '(?:^|/)\.{1,2}(?:/|$)') { throw "Unsafe package mapping target: $name" }
            if ($entry -is [string] -or $null -eq $entry.frontmatter) {
                [void]$requiredMappings.Remove("$($file.source)`n$name")
            }
        }
    }
    if ($requiredMappings.Count -gt 0) { throw 'Package mapping is missing required toolkit files.' }
    & $installer -TargetPath $target -SourceRoot $extract
}
finally { Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue }
