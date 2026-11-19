[CmdletBinding()]
param(
    [string]$TargetPath = (Join-Path $PSScriptRoot '..'),
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($TargetPath)
$issues = [Collections.Generic.List[string]]::new()
$version = $null
$commit = $null
$status = $null
$requestedVersion = $null
$requestedCommit = $null

function Assert-NoReparsePoint {
    param([string]$Path)
    $cursor = [IO.Path]::GetPathRoot($Path)
    foreach ($part in $Path.Substring($cursor.Length).Split([char[]]@('\', '/'), [StringSplitOptions]::RemoveEmptyEntries)) {
        $cursor = Join-Path $cursor $part
        try { $attributes = [IO.File]::GetAttributes($cursor) }
        catch [IO.FileNotFoundException] { break }
        catch [IO.DirectoryNotFoundException] { break }
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Path contains a reparse point.' }
    }
}

function Get-SafeTargetPath {
    param([string]$RelativePath)
    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [IO.Path]::IsPathRooted($RelativePath)) { throw 'Invalid relative path.' }
    $segments = $RelativePath.Split([char[]]@('/', '\'), [StringSplitOptions]::None)
    foreach ($segment in $segments) {
        if (-not $segment -or $segment -in @('.', '..') -or
            $segment.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0 -or $segment -match '[\x00-\x1F]') {
            throw 'Invalid relative path.'
        }
    }
    $path = [IO.Path]::GetFullPath([IO.Path]::Combine($root, ($segments -join [IO.Path]::DirectorySeparatorChar)))
    $prefix = $root.TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
    if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside target.' }
    Assert-NoReparsePoint $path
    return $path
}

$manifest = $null
try {
    $manifestPath = Get-SafeTargetPath '.agent-toolkit/install-manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Missing manifest.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest -isnot [System.Management.Automation.PSCustomObject] -or
        ($manifest.manifestVersion -isnot [int] -and $manifest.manifestVersion -isnot [long]) -or $manifest.manifestVersion -notin @(1, 2) -or
        $manifest.files -isnot [array] -or $manifest.files.Count -eq 0 -or $manifest.files.Count -gt 10000) { throw 'Invalid manifest.' }
}
catch { $manifest = $null; $issues.Add('Install manifest is missing, invalid, unsupported, or unsafe.') }

if ($manifest) {
    if ($manifest.toolkitVersion -is [string] -and $manifest.toolkitVersion -cmatch '\A(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?\z') {
        $version = $manifest.toolkitVersion
    }
    else { $issues.Add('Installed version is missing or unknown.') }
    if ($manifest.sourceCommit -is [string] -and $manifest.sourceCommit -match '\A[0-9a-f]{40}\z') {
        $commit = $manifest.sourceCommit.ToLowerInvariant()
    }
    else { $issues.Add('Installed source commit is missing or unknown.') }
    foreach ($name in @('sourceCommit', 'lastCompleteCommit', 'requestedCommit')) {
        $value = $manifest.$name
        if ($null -ne $value -and ($value -isnot [string] -or $value -notmatch '\A[0-9a-f]{40}\z')) {
            $issues.Add("Install manifest contains an invalid $name.")
        }
    }
    if ($manifest.sourceCommit -is [string] -and $manifest.lastCompleteCommit -is [string] -and
        $manifest.sourceCommit -ine $manifest.lastCompleteCommit) {
        $issues.Add('Install manifest contains inconsistent complete commit identities.')
    }
    if ($manifest.installationStatus -cin @('complete', 'partial')) { $status = $manifest.installationStatus }
    if ($status -cne 'complete' -or $manifest.sourceModified -isnot [bool] -or $manifest.sourceModified -ne $false) { $issues.Add('Installation is incomplete, modified, or legacy.') }
    if ($manifest.requestedVersion -is [string] -and $manifest.requestedVersion -cmatch '\A(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?\z') {
        $requestedVersion = $manifest.requestedVersion
    }
    if ($manifest.requestedCommit -is [string] -and $manifest.requestedCommit -match '\A[0-9a-f]{40}\z') { $requestedCommit = $manifest.requestedCommit.ToLowerInvariant() }

    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $manifest.files) {
        if ($entry -isnot [System.Management.Automation.PSCustomObject] -or $entry.path -isnot [string] -or
            $entry.sha256 -isnot [string] -or $entry.sha256 -cnotmatch '\A[0-9A-Fa-f]{64}\z' -or -not $seen.Add($entry.path.Replace('\', '/'))) {
            $issues.Add('Install manifest contains an invalid or duplicate file record.')
            continue
        }
        if ($entry.path.Replace('\', '/') -ieq '.agent-toolkit/settings.json') { continue }
        try {
            $path = Get-SafeTargetPath $entry.path
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
                $issues.Add("Managed file is missing or not a file: $($entry.path)")
                continue
            }
            if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ine $entry.sha256) {
                $issues.Add("Managed file was modified: $($entry.path)")
            }
        }
        catch { $issues.Add('Install manifest contains an unsafe or unreadable file path.') }
    }
    try {
        $mappingPath = Get-SafeTargetPath '.agent-toolkit/install-files.json'
        $mapping = Get-Content -LiteralPath $mappingPath -Raw | ConvertFrom-Json
        if ($mapping -isnot [System.Management.Automation.PSCustomObject] -or
            $mapping.files -isnot [array] -or $mapping.files.Count -eq 0 -or $mapping.files.Count -gt 10000) { throw 'Invalid mapping.' }
        $mappedTargets = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($file in $mapping.files) {
            if ($file -isnot [System.Management.Automation.PSCustomObject]) { throw 'Invalid mapping entry.' }
            $targets = @()
            if ($file.target) { $targets += $file.target }
            if ($null -ne $file.targets) {
                if ($file.targets -isnot [array]) { throw 'Invalid mapping targets.' }
                $targets += $file.targets
            }
            if ($targets.Count -eq 0) { throw 'Missing mapping target.' }
            foreach ($targetEntry in $targets) {
                $name = if ($targetEntry -is [string]) { $targetEntry } elseif ($targetEntry -is [System.Management.Automation.PSCustomObject]) { $targetEntry.target } else { $null }
                if ($name -isnot [string] -or [IO.Path]::IsPathRooted($name)) { throw 'Invalid mapping target.' }
                $segments = @($name.Split([char[]]@('\', '/')) | Where-Object { $_ -and $_ -cne '.' })
                if ($segments -contains '..') { throw 'Invalid mapping target.' }
                $name = $segments -join '/'
                [void](Get-SafeTargetPath $name)
                if (-not $mappedTargets.Add($name)) { throw 'Duplicate mapping target.' }
                if ($name -ine '.agent-toolkit/settings.json' -and -not $seen.Contains($name)) {
                    $issues.Add("Managed file is absent from install manifest: $name")
                }
            }
        }
    }
    catch { $issues.Add('Install mapping is missing, invalid, or unsafe.') }
}

try {
    $settings = Get-SafeTargetPath '.agent-toolkit/settings.json'
    $schema = Get-SafeTargetPath '.agent-toolkit/settings.schema.json'
    $installedValidator = Get-SafeTargetPath 'scripts/validate-agent-toolkit-settings.ps1'
    $validator = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'validate-agent-toolkit-settings.ps1'))
    Assert-NoReparsePoint $validator
    if (-not (Test-Path -LiteralPath $settings -PathType Leaf) -or
        -not (Test-Path -LiteralPath $schema -PathType Leaf) -or
        -not (Test-Path -LiteralPath $validator -PathType Leaf) -or
        -not (Test-Path -LiteralPath $installedValidator -PathType Leaf)) { throw 'Missing settings or validator.' }
    $validatorRecord = @($manifest.files | Where-Object { $_.path -ieq 'scripts/validate-agent-toolkit-settings.ps1' })
    if ($validatorRecord.Count -ne 1 -or $validatorRecord[0].sha256 -isnot [string] -or
        $validatorRecord[0].sha256 -notmatch '\A[0-9a-f]{64}\z') { throw 'Validator baseline is missing.' }
    $validatorBytes = [IO.File]::ReadAllBytes($validator)
    [byte[]]$installedBytes = if ($validator -ieq $installedValidator) { $validatorBytes } else { [IO.File]::ReadAllBytes($installedValidator) }
    $validatorText = [Text.UTF8Encoding]::new($false, $true).GetString($validatorBytes).TrimStart([char]0xFEFF)
    $installedText = [Text.UTF8Encoding]::new($false, $true).GetString($installedBytes).TrimStart([char]0xFEFF)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $validatorHash = -join ($sha.ComputeHash($installedBytes) | ForEach-Object { $_.ToString('x2') })
        $normalizedHash = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($validatorText.Replace("`r`n", "`n"))) | ForEach-Object { $_.ToString('x2') })
        $installedNormalizedHash = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($installedText.Replace("`r`n", "`n"))) | ForEach-Object { $_.ToString('x2') })
    }
    finally { $sha.Dispose() }
    # Keep the fingerprint in sync with the shipped validator; a manifest alone is not a trust anchor.
    $supportedHash = '88ba0e31019ddab4b18d2eb0d1d58b0f51cdebf5cad86f8cc052a95dc2d25238'
    if ($validatorHash -ine $validatorRecord[0].sha256 -or $normalizedHash -cne $supportedHash -or $installedNormalizedHash -cne $supportedHash) {
        throw 'Validator does not match the supported baseline.'
    }
    & ([scriptblock]::Create($validatorText)) -SettingsPath $settings -SchemaPath $schema | Out-Null
    $settingsState = Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json
    if ($settingsState.initialized -eq $false) { $issues.Add('Settings have not been initialized.') }
}
catch { $issues.Add('Settings or schema are missing, invalid, unsupported, or unsafe.') }

$result = [ordered]@{
    status = if ($issues.Count) { 'issues' } else { 'healthy' }
    toolkitVersion = $version
    sourceCommit = $commit
    installationStatus = $status
    requestedVersion = $requestedVersion
    requestedCommit = $requestedCommit
    issues = @($issues.ToArray())
}
if ($Json) { $result | ConvertTo-Json -Depth 5 }
else {
    Write-Output "Agent Toolkit status: $($result.status)"
    Write-Output "Version: $(if ($version) { $version } else { 'unknown' })"
    Write-Output "Source commit: $(if ($commit) { $commit } else { 'unknown' })"
    Write-Output "Installation: $(if ($status) { $status } else { 'unknown' })"
    if ($status -ceq 'partial') {
        Write-Output "Requested version: $(if ($requestedVersion) { $requestedVersion } else { 'unknown' })"
        Write-Output "Requested commit: $(if ($requestedCommit) { $requestedCommit } else { 'unknown' })"
    }
    foreach ($issue in $issues) { Write-Output "Issue: $issue" }
}
if ($issues.Count) { exit 1 }
