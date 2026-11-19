[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetPath,

    [switch]$DryRun,

    [string]$SourceRoot,

    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'validate-agent-toolkit-settings.ps1')

function Get-ToolkitPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        throw "Toolkit paths must be relative: $RelativePath"
    }

    $segments = $RelativePath -split '[/\\]'
    if ($segments -contains '..') {
        throw "Toolkit paths cannot contain '..': $RelativePath"
    }

    $localPath = $RelativePath -replace '[/\\]', [System.IO.Path]::DirectorySeparatorChar
    $rootWithSeparator = $Root.TrimEnd([char[]]@('\', '/')) + [System.IO.Path]::DirectorySeparatorChar
    $resolvedPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $localPath))
    if (-not $resolvedPath.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Toolkit path resolves outside its root: $RelativePath"
    }

    return $resolvedPath
}

function Assert-NoReparsePointComponents {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $volumeRoot = [System.IO.Path]::GetPathRoot($resolvedRoot)
    if (-not $resolvedRoot.Equals($volumeRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Assert-NoReparsePointComponents -Root $volumeRoot -Path $resolvedRoot
    }
    $rootWithoutTrailingSeparator = $resolvedRoot.TrimEnd([char[]]@('\', '/'))
    if ([string]::IsNullOrEmpty($rootWithoutTrailingSeparator)) {
        $rootWithSeparator = [string][System.IO.Path]::DirectorySeparatorChar
    }
    else {
        $rootWithSeparator = $rootWithoutTrailingSeparator + [System.IO.Path]::DirectorySeparatorChar
    }

    $components = [System.Collections.Generic.List[string]]::new()
    $components.Add($resolvedRoot)

    if (-not $resolvedPath.Equals($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        if (-not $resolvedPath.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Toolkit path is not inside the selected target root: $Path"
        }

        $relativePath = $resolvedPath.Substring($rootWithSeparator.Length)
        $currentPath = $resolvedRoot
        foreach ($segment in ($relativePath -split '[/\\]')) {
            if (-not $segment) {
                continue
            }

            $currentPath = [System.IO.Path]::Combine($currentPath, $segment)
            $components.Add($currentPath)
        }
    }

    foreach ($componentPath in $components) {
        try {
            $attributes = [System.IO.File]::GetAttributes($componentPath)
        }
        catch [System.IO.FileNotFoundException] {
            break
        }
        catch [System.IO.DirectoryNotFoundException] {
            break
        }

        if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Toolkit target paths cannot contain reparse points: $componentPath"
        }
    }
}

function Get-RelativeToolkitPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    return $Path.Substring($Root.TrimEnd([char[]]@('\', '/')).Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
}

function Test-SafeManifestRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [System.IO.Path]::IsPathRooted($RelativePath)) {
        return $false
    }

    $invalidFileNameCharacters = [System.IO.Path]::GetInvalidFileNameChars()
    foreach ($segment in $RelativePath.Split([char[]]@('/', '\'), [System.StringSplitOptions]::None)) {
        if ([string]::IsNullOrEmpty($segment) -or $segment -eq '.' -or $segment -eq '..') {
            return $false
        }

        if ($segment.IndexOfAny($invalidFileNameCharacters) -ge 0 -or $segment -match '[\x00-\x1F]') {
            return $false
        }
    }

    return $true
}

function Get-BytesSha256 {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][byte[]]$Bytes
    )

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha256.ComputeHash($Bytes)
    }
    finally {
        $sha256.Dispose()
    }

    return (-join ($hash | ForEach-Object { $_.ToString('X2') }))
}

function Get-VerifiedPackageSources {
        param([string]$Root, [object]$Metadata)

        if ($Metadata.sourceHashes -isnot [array] -or $Metadata.sourceHashes.Count -eq 0 -or $Metadata.sourceHashes.Count -gt 500) {
            throw 'Package integrity metadata is missing or invalid.'
        }
        $sources = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($entry in $Metadata.sourceHashes) {
            if ($entry.path -isnot [string] -or -not (Test-SafeManifestRelativePath $entry.path) -or $entry.path.Contains('\') -or
                $entry.sha256 -isnot [string] -or $entry.sha256 -cnotmatch '^[0-9A-Fa-f]{64}$' -or $sources.ContainsKey($entry.path)) {
                throw 'Package integrity entry is invalid or duplicated.'
            }
            $path = Get-ToolkitPath -Root $Root -RelativePath $entry.path
            Assert-NoReparsePointComponents -Root $Root -Path $path
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Package source missing: $($entry.path)" }
            $bytes = [IO.File]::ReadAllBytes($path)
            if ((Get-BytesSha256 -Bytes $bytes) -ne $entry.sha256) { throw "Package source hash mismatch: $($entry.path)" }
            $sources.Add($entry.path, $bytes)
        }
        $mappingName = '.agent-toolkit/install-files.json'
        if (-not $sources.ContainsKey($mappingName)) { throw 'Package integrity metadata does not cover the mapping.' }
        $mappingText = [Text.Encoding]::UTF8.GetString($sources[$mappingName]).TrimStart([char]0xFEFF)
        $packageDefinition = $mappingText | ConvertFrom-Json
        if (-not $packageDefinition.files) { throw 'Package mapping is empty.' }
        $expected = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        [void]$expected.Add($mappingName)
        foreach ($file in $packageDefinition.files) {
            if ($file.source -isnot [string] -or -not (Test-SafeManifestRelativePath $file.source) -or $file.source.Contains('\')) { throw 'Invalid package source path.' }
            [void]$expected.Add($file.source)
        }
        if ($expected.Count -ne $sources.Count) { throw 'Package integrity metadata does not match mapping sources.' }
        foreach ($name in $expected) {
            if (-not $sources.ContainsKey($name)) { throw "Package integrity metadata does not cover: $name" }
        }
        return ,$sources
}

function Get-OptionalCommit {
    param([object]$Value)
    if ($null -eq $Value) { return $null }
    if ($Value -isnot [string] -or $Value -cnotmatch '\A[0-9a-fA-F]{40}\z') {
        throw 'Invalid source commit identity in metadata or manifest.'
    }
    return $Value.ToLowerInvariant()
}

function ConvertTo-FrontmatterScalar {
    param(
        [Parameter(Mandatory = $true)][object]$Value
    )

    if ($Value -is [bool]) {
        if ($Value) {
            return 'true'
        }

        return 'false'
    }

    if ($Value -is [string] -or $Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal] -or $Value -is [single]) {
        return [string]$Value
    }

    throw 'Frontmatter override values must be a boolean, string, or number.'
}

# Platform frontmatter is derived from the single canonical source file so the same
# rules, agents, and skills stay in sync across GitHub Copilot, WorkBuddy, and TRAE.
# A null override removes the key, which covers tool-specific fields such as
# Copilot's user-invocable flag that has no equivalent in TRAE subagents.
function Add-FrontmatterOverrides {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][byte[]]$Bytes,
        [Parameter(Mandatory = $true)][object]$Overrides,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $content = [System.Text.UTF8Encoding]::new($false).GetString($Bytes)
    # Hosts such as TRAE reject a BOM in frontmatter files. Strip a leading BOM
    # before matching the header so a BOM-bearing source cannot produce two
    # frontmatter blocks.
    if ($content.Length -gt 0 -and $content[0] -eq [char]0xFEFF) {
        $content = $content.Substring(1)
    }
    $newLine = "`n"
    if ($content.Contains("`r`n")) {
        $newLine = "`r`n"
    }

    $appliedOverrides = [System.Collections.Generic.List[object]]::new()
    foreach ($property in $Overrides.PSObject.Properties) {
        $appliedOverrides.Add([pscustomobject]@{
                Key   = $property.Name
                Value = $property.Value
            })
    }

    if ($appliedOverrides.Count -eq 0) {
        return , $Bytes
    }

    $frontmatterMatch = [regex]::Match($content, '\A---[ \t]*\r?\n(?<block>[\s\S]*?)\r?\n---[ \t]*(?:\r?\n|\z)')
    $blockLines = [System.Collections.Generic.List[string]]::new()
    if ($frontmatterMatch.Success) {
        $existingBlock = $frontmatterMatch.Groups['block'].Value
        if ($existingBlock.Length -gt 0) {
            foreach ($blockLine in ($existingBlock -split '\r?\n')) {
                $blockLines.Add($blockLine)
            }
        }

        $remainder = $content.Substring($frontmatterMatch.Length)
    }
    else {
        $remainder = $content
    }

    foreach ($override in $appliedOverrides) {
        if ([string]::IsNullOrWhiteSpace($override.Key) -or $override.Key -notmatch '\A[A-Za-z0-9_.-]+\z') {
            throw "Frontmatter keys must be simple identifiers: $($override.Key) ($RelativePath)"
        }

        $linePattern = '^\s*' + [regex]::Escape($override.Key) + '\s*:'
        $index = -1
        for ($i = 0; $i -lt $blockLines.Count; $i++) {
            if ($blockLines[$i] -match $linePattern) {
                $index = $i
                break
            }
        }

        if ($null -eq $override.Value) {
            if ($index -ge 0) {
                $blockLines.RemoveAt($index)
            }

            continue
        }

        $value = ConvertTo-FrontmatterScalar -Value $override.Value
        if ($value -match '[\x00-\x1F]' -or $value -match ':\s' -or $value -match '^\s' -or $value -match '\s$' -or $value.StartsWith('#')) {
            throw "Frontmatter values must be simple single-line YAML scalars: $($override.Key) ($RelativePath)"
        }

        $renderedLine = '{0}: {1}' -f $override.Key, $value
        if ($index -ge 0) {
            $blockLines[$index] = $renderedLine
        }
        else {
            $blockLines.Add($renderedLine)
        }
    }

    $builder = [System.Text.StringBuilder]::new()
    [void]$builder.Append('---').Append($newLine)
    foreach ($blockLine in $blockLines) {
        [void]$builder.Append($blockLine).Append($newLine)
    }

    [void]$builder.Append('---').Append($newLine)
    if (-not $frontmatterMatch.Success) {
        [void]$builder.Append($newLine)
    }

    [void]$builder.Append($remainder)

    return , ([System.Text.UTF8Encoding]::new($false).GetBytes($builder.ToString()))
}

$sourceRoot = if ($SourceRoot) { [System.IO.Path]::GetFullPath($SourceRoot) } else { [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')) }
$targetRoot = [System.IO.Path]::GetFullPath($TargetPath)
if ($sourceRoot.Equals($targetRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'The target directory cannot be the toolkit source directory.'
}

$definitionPath = Join-Path $sourceRoot '.agent-toolkit\install-files.json'
Assert-NoReparsePointComponents -Root $sourceRoot -Path $definitionPath
if (-not (Test-Path -LiteralPath $definitionPath -PathType Leaf)) {
    throw "Toolkit file definition was not found: $definitionPath"
}

try {
    $definition = Get-Content -LiteralPath $definitionPath -Raw | ConvertFrom-Json
}
catch {
    throw "Toolkit file definition is invalid JSON: $($_.Exception.Message)"
}

if (-not $definition.files) {
    throw 'Toolkit file definition must contain files.'
}

$versionPath = Join-Path $sourceRoot '.agent-toolkit/package-version.json'
$sourceManifestPath = Join-Path $sourceRoot '.agent-toolkit/install-manifest.json'
Assert-NoReparsePointComponents -Root $sourceRoot -Path $versionPath
Assert-NoReparsePointComponents -Root $sourceRoot -Path $sourceManifestPath
$sourceModified = $false
$requestedCommit = $null
$verifiedSources = $null
if (Test-Path -LiteralPath $versionPath -PathType Leaf) {
    $versionInfo = Get-Content -LiteralPath $versionPath -Raw | ConvertFrom-Json
    $requestedVersion = [string]$versionInfo.semVer
    if ($versionInfo.sourceModified -isnot [bool]) { throw 'Package sourceModified metadata must be boolean.' }
    $sourceModified = $versionInfo.sourceModified
    $requestedCommit = Get-OptionalCommit $versionInfo.commit
    $verifiedSources = Get-VerifiedPackageSources -Root $sourceRoot -Metadata $versionInfo
    $definition = [Text.Encoding]::UTF8.GetString($verifiedSources['.agent-toolkit/install-files.json']).TrimStart([char]0xFEFF) | ConvertFrom-Json
}
elseif (Test-Path -LiteralPath $sourceManifestPath -PathType Leaf) {
    $sourceManifest = Get-Content -LiteralPath $sourceManifestPath -Raw | ConvertFrom-Json
    if ($sourceManifest.installationStatus -eq 'complete' -and $sourceManifest.sourceModified -eq $false) {
        $requestedVersion = [string]$sourceManifest.toolkitVersion
        $sourceCommit = Get-OptionalCommit $sourceManifest.sourceCommit
        $lastCompleteSourceCommit = Get-OptionalCommit $sourceManifest.lastCompleteCommit
        if ($sourceCommit -and $lastCompleteSourceCommit -and $sourceCommit -cne $lastCompleteSourceCommit) { throw 'Installed source has inconsistent complete commit identities.' }
        $requestedCommit = if ($sourceCommit) { $sourceCommit } else { $lastCompleteSourceCommit }
    }
    elseif ($sourceManifest.installationStatus -eq 'partial' -and $sourceManifest.requestedVersion) {
        $requestedVersion = [string]$sourceManifest.requestedVersion
        $sourceModified = $true
    }
    else { throw 'Installed source has no verified version; use a current checkout or release package.' }
    $sourceHashes = @{}
    foreach ($entry in @($sourceManifest.files)) { $sourceHashes[[string]$entry.path] = [string]$entry.sha256 }
    if (-not $sourceHashes['.agent-toolkit/install-files.json'] -or
        (Get-BytesSha256 -Bytes ([IO.File]::ReadAllBytes($definitionPath))) -ne $sourceHashes['.agent-toolkit/install-files.json']) { $sourceModified = $true }
    foreach ($file in @($definition.files)) {
        $sourceFile = Get-ToolkitPath -Root $sourceRoot -RelativePath $file.source
        Assert-NoReparsePointComponents -Root $sourceRoot -Path $sourceFile
        if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf) -or
            -not $sourceHashes[$file.source] -or
            (Get-BytesSha256 -Bytes ([IO.File]::ReadAllBytes($sourceFile))) -ne $sourceHashes[$file.source]) { $sourceModified = $true }
    }
}
else {
    Push-Location $sourceRoot
    try {
        $gitRoot = git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -ne 0 -or -not [System.IO.Path]::GetFullPath($gitRoot).Equals($sourceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'Source is not a toolkit Git checkout and package version metadata is missing.'
        }
        $gitVersionCommand = Get-Command gitversion, dotnet-gitversion -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $gitVersionCommand) { throw 'GitVersion 6.4.0 is required for a source-tree install.' }
        $toolVersion = (& $gitVersionCommand.Source /version | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $toolVersion -cnotmatch '^6\.4\.0(?:\+.*)?$') { throw 'Source installs require GitVersion 6.4.0.' }
        $requestedVersion = (& $gitVersionCommand.Source /showvariable SemVer | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'GitVersion failed.' }
        $requestedCommit = (git rev-parse --verify HEAD | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $requestedCommit -cnotmatch '\A[0-9a-f]{40}\z') { throw 'Cannot determine source checkout commit.' }
        $sourceModified = [bool](@(git status --porcelain --untracked-files=all -- GitVersion.yml .agent-toolkit/install-files.json .agent-toolkit/settings.schema.json .agent-toolkit/settings.template.json .github/agents .github/prompts .github/skills .github/copilot-instructions.md scripts/install-agent-toolkit.ps1 scripts/validate-agent-toolkit-settings.ps1 scripts/doctor-agent-toolkit.ps1 scripts/upgrade-agent-toolkit.ps1 install-agent-toolkit.cmd docs/agent-toolkit.md docs/people-requirements-record/README.md).Count)
        if ($LASTEXITCODE -ne 0) { throw 'Could not determine source changes.' }
    }
    finally { Pop-Location }
}
if ($requestedVersion -cnotmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$') {
    throw "Invalid GitVersion SemVer: '$requestedVersion'."
}

$timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N')
$isDryRun = $DryRun
$mappedFiles = [System.Collections.Generic.List[object]]::new()
$declaredTargets = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($file in @($definition.files)) {
    if (-not $file.source) {
        throw 'Each toolkit file entry must contain a source path.'
    }

    $sourcePath = Get-ToolkitPath -Root $sourceRoot -RelativePath $file.source
    Assert-NoReparsePointComponents -Root $sourceRoot -Path $sourcePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Toolkit source file is missing: $($file.source)"
    }

    if ($null -ne $verifiedSources) {
        $sourceBytes = $verifiedSources[$file.source]
    }
    else {
        $sourceBytes = [System.IO.File]::ReadAllBytes($sourcePath)
    }

    $targetEntries = [System.Collections.Generic.List[object]]::new()
    $targetsProperty = $file.PSObject.Properties['targets']
    if ($null -ne $targetsProperty) {
        foreach ($entry in @($targetsProperty.Value)) {
            $targetEntries.Add($entry)
        }
    }

    $singleTargetProperty = $file.PSObject.Properties['target']
    if ($null -ne $singleTargetProperty -and $singleTargetProperty.Value) {
        $targetEntries.Add($singleTargetProperty.Value)
    }

    if ($targetEntries.Count -eq 0) {
        throw "Each toolkit file entry must declare at least one target: $($file.source)"
    }

    foreach ($targetEntry in $targetEntries) {
        $targetRelativeValue = $targetEntry
        $frontmatterOverrides = $null
        if ($targetEntry -isnot [string]) {
            if ($null -eq $targetEntry -or -not $targetEntry.target) {
                throw "Each toolkit target entry must contain a target path: $($file.source)"
            }

            $targetRelativeValue = $targetEntry.target
            $frontmatterProperty = $targetEntry.PSObject.Properties['frontmatter']
            if ($null -ne $frontmatterProperty) {
                $frontmatterOverrides = $frontmatterProperty.Value
            }
        }

        if (-not $targetRelativeValue) {
            throw "Each toolkit target entry must contain a target path: $($file.source)"
        }

        $destinationPath = Get-ToolkitPath -Root $targetRoot -RelativePath $targetRelativeValue
        # Compare canonical destination names so aliases such as "./" cannot
        # bypass settings preservation or schema/default preflight checks.
        $targetRelativePath = Get-RelativeToolkitPath -Root $targetRoot -Path $destinationPath
        if (-not $declaredTargets.Add($targetRelativePath)) {
            throw "Toolkit target paths must be unique; duplicate target: $targetRelativePath"
        }

        $payloadBytes = $sourceBytes
        if ($null -ne $frontmatterOverrides) {
            $payloadBytes = Add-FrontmatterOverrides -Bytes $sourceBytes -Overrides $frontmatterOverrides -RelativePath $targetRelativePath
        }

        $backupPath = Get-ToolkitPath -Root $targetRoot -RelativePath ".agent-toolkit\backups\$timestamp\$targetRelativePath"
        $mappedFiles.Add([pscustomobject]@{
                SourcePath         = $sourcePath
                DestinationPath    = $destinationPath
                TargetRelativePath = $targetRelativePath
                BackupPath         = $backupPath
                PayloadBytes       = $payloadBytes
                PayloadHash        = (Get-BytesSha256 -Bytes $payloadBytes)
            })
    }
}

$targetSettingsPath = Get-ToolkitPath -Root $targetRoot -RelativePath '.agent-toolkit/settings.json'
Assert-NoReparsePointComponents -Root $targetRoot -Path $targetSettingsPath
$candidateSchema = @($mappedFiles | Where-Object { $_.TargetRelativePath -eq '.agent-toolkit/settings.schema.json' })
if ($candidateSchema.Count -gt 0) {
    # This is the same payload snapshot that will be installed; package inputs
    # have already been checked against the package source hashes.
    $schemaArguments = @{ SchemaBytes = $candidateSchema[0].PayloadBytes }
    Assert-SupportedSettingsSchema @schemaArguments
}
else {
    # A mapping that does not install a schema must validate against the
    # existing target schema when present, otherwise the trusted local schema.
    $targetSchemaPath = Get-ToolkitPath -Root $targetRoot -RelativePath '.agent-toolkit/settings.schema.json'
    Assert-NoReparsePointComponents -Root $targetRoot -Path $targetSchemaPath
    $schemaArguments = @{ SchemaPath = if (Test-Path -LiteralPath $targetSchemaPath) { $targetSchemaPath } else { Join-Path $PSScriptRoot '../.agent-toolkit/settings.schema.json' } }
}
if (Test-Path -LiteralPath $targetSettingsPath) {
    if (-not (Test-Path -LiteralPath $targetSettingsPath -PathType Leaf)) {
        throw 'Existing .agent-toolkit/settings.json is not a regular file; no files were installed.'
    }
    Assert-SettingsV1 -SettingsPath $targetSettingsPath @schemaArguments
}
# Validate mapped defaults even when settings already exist: the template may
# also be installed separately and later used to initialize a project.
foreach ($defaultSettings in @($mappedFiles | Where-Object { $_.TargetRelativePath -in @('.agent-toolkit/settings.json', '.agent-toolkit/settings.template.json') })) {
    Assert-SettingsV1 -SettingsBytes $defaultSettings.PayloadBytes @schemaArguments
}

if ($ValidateOnly) {
    if ($null -eq $verifiedSources) { throw 'Validation requires package integrity metadata.' }
    Write-Host 'Package integrity and mapping validated; no files were installed.'
    return
}

$targetManifestPath = Get-ToolkitPath -Root $targetRoot -RelativePath '.agent-toolkit\install-manifest.json'
Assert-NoReparsePointComponents -Root $targetRoot -Path $targetRoot
foreach ($mappedFile in $mappedFiles) {
    Assert-NoReparsePointComponents -Root $targetRoot -Path $mappedFile.DestinationPath
    Assert-NoReparsePointComponents -Root $targetRoot -Path $mappedFile.BackupPath
}
Assert-NoReparsePointComponents -Root $targetRoot -Path $targetManifestPath

$conflicts = [System.Collections.Generic.List[string]]::new()
$declinedOperations = [System.Collections.Generic.List[string]]::new()
$previousHashes = @{}
$manifestPathExists = Test-Path -LiteralPath $targetManifestPath
$manifestDirectoryCollision = Test-Path -LiteralPath $targetManifestPath -PathType Container
if ($manifestDirectoryCollision -or ($manifestPathExists -and -not (Test-Path -LiteralPath $targetManifestPath -PathType Leaf))) {
    $manifestConflictPath = '.agent-toolkit/install-manifest.json'
    throw "Preserved directory conflict: $manifestConflictPath. No files were installed."
}
elseif (Test-Path -LiteralPath $targetManifestPath -PathType Leaf) {
    try {
        $previousManifest = Get-Content -LiteralPath $targetManifestPath -Raw | ConvertFrom-Json -NoEnumerate
        if ($null -eq $previousManifest -or $previousManifest -isnot [System.Management.Automation.PSCustomObject]) {
            throw 'The manifest root must be a JSON object.'
        }

        $manifestVersionProperty = $previousManifest.PSObject.Properties['manifestVersion']
        $toolkitVersionProperty = $previousManifest.PSObject.Properties['toolkitVersion']
        $filesProperty = $previousManifest.PSObject.Properties['files']
        if ($null -eq $manifestVersionProperty -or $null -eq $toolkitVersionProperty -or $null -eq $filesProperty) {
            throw 'The manifest must contain manifestVersion, toolkitVersion, and files.'
        }

        $manifestVersion = $manifestVersionProperty.Value
        if (($manifestVersion -isnot [int] -and $manifestVersion -isnot [long]) -or ($manifestVersion -ne 1 -and $manifestVersion -ne 2)) {
            throw 'The manifestVersion is not supported.'
        }

        $toolkitVersion = $toolkitVersionProperty.Value
        if (($toolkitVersion -isnot [string] -or [string]::IsNullOrWhiteSpace($toolkitVersion)) -and
            -not ($null -eq $toolkitVersion -and $previousManifest.installationStatus -eq 'partial')) {
            throw 'The toolkitVersion must be a non-empty string.'
        }

        $manifestFiles = $filesProperty.Value
        if ($manifestFiles -isnot [array]) {
            throw 'The manifest files value must be an array.'
        }

        foreach ($entry in $manifestFiles) {
            if ($null -eq $entry -or $entry -isnot [System.Management.Automation.PSCustomObject]) {
                throw 'Each manifest files entry must be an object.'
            }

            $pathProperty = $entry.PSObject.Properties['path']
            $sha256Property = $entry.PSObject.Properties['sha256']
            if ($null -eq $pathProperty -or $pathProperty.Value -isnot [string] -or -not (Test-SafeManifestRelativePath -RelativePath $pathProperty.Value)) {
                throw 'Each manifest files entry must contain a safe relative path.'
            }

            if ($null -eq $sha256Property -or $sha256Property.Value -isnot [string] -or $sha256Property.Value -notmatch '\A[0-9a-fA-F]{64}\z') {
                throw 'Each manifest files entry must contain a 64-character SHA-256 hash.'
            }

            $previousHashes[$pathProperty.Value] = $sha256Property.Value
        }
    }
    catch {
        throw "Existing Agent Toolkit install manifest is invalid or unsupported; refusing to overwrite files: $($_.Exception.Message)"
    }
}

$nextHashes = @{}
foreach ($key in $previousHashes.Keys) {
    $nextHashes[$key] = $previousHashes[$key]
    if (-not $declaredTargets.Contains($key)) {
        $retiredPath = Get-ToolkitPath -Root $targetRoot -RelativePath $key
        Assert-NoReparsePointComponents -Root $targetRoot -Path $retiredPath
        if (Test-Path -LiteralPath $retiredPath) {
            $conflicts.Add($key)
            Write-Warning "Preserved previously installed file absent from the new mapping: $key"
        }
        else { $nextHashes.Remove($key) }
    }
}

$manifestWriteApproved = $false
if (-not $isDryRun) {
    $manifestWriteApproved = $PSCmdlet.ShouldProcess($targetManifestPath, 'Write Agent Toolkit install manifest')
    if (-not $manifestWriteApproved) {
        $declinedOperations.Add('Write .agent-toolkit/install-manifest.json')
    }
}

$priorCompleteVersion = if ($previousManifest.installationStatus -eq 'complete') { $previousManifest.toolkitVersion } elseif ($previousManifest.installationStatus -eq 'partial') { $previousManifest.lastCompleteVersion } else { $null }
$priorSourceCommit = Get-OptionalCommit $previousManifest.sourceCommit
$priorLastCompleteCommit = Get-OptionalCommit $previousManifest.lastCompleteCommit
[void](Get-OptionalCommit $previousManifest.requestedCommit)
if ($priorSourceCommit -and $priorLastCompleteCommit -and $priorSourceCommit -cne $priorLastCompleteCommit) { throw 'Existing install manifest has inconsistent complete commit identities.' }
$priorCompleteCommit = if ($priorCompleteVersion) {
    if ($priorLastCompleteCommit) { $priorLastCompleteCommit } else { $priorSourceCommit }
} else { $null }
function Write-InstallManifest {
    param([object]$Value)
    Assert-NoReparsePointComponents -Root $targetRoot -Path $targetManifestPath
    $directory = Split-Path -Parent $targetManifestPath
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $temporaryManifest = Join-Path $directory ('install-manifest-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        Assert-NoReparsePointComponents -Root $targetRoot -Path $temporaryManifest
        $json = $Value | ConvertTo-Json -Depth 8
        [IO.File]::WriteAllText($temporaryManifest, $json, [Text.UTF8Encoding]::new($false))
        Assert-NoReparsePointComponents -Root $targetRoot -Path $targetManifestPath
        [IO.File]::Move($temporaryManifest, $targetManifestPath, $true)
    }
    finally { Remove-Item -LiteralPath $temporaryManifest -Force -ErrorAction SilentlyContinue }
}
if (-not $isDryRun -and $manifestWriteApproved) {
    $beforeFiles = @(
        foreach ($key in ($previousHashes.Keys | Sort-Object)) {
            [ordered]@{ path = $key; sha256 = $previousHashes[$key] }
        }
    )
    # Persist an incomplete state before touching mapped files, including on an interrupted process.
    Write-InstallManifest ([ordered]@{
        manifestVersion = 2
        toolkitVersion = if ($previousManifest) { $previousManifest.toolkitVersion } else { $null }
        installationStatus = 'partial'
        lastCompleteVersion = $priorCompleteVersion
        requestedVersion = $requestedVersion
        sourceCommit = $priorCompleteCommit
        lastCompleteCommit = $priorCompleteCommit
        requestedCommit = $requestedCommit
        sourceModified = $sourceModified
        files = $beforeFiles
    })
}

$loopCompleted = $false
# Record completed writes even if a later mapped operation fails.
try {
foreach ($mappedFile in $mappedFiles) {
    $destinationPath = $mappedFile.DestinationPath
    $targetRelativePath = $mappedFile.TargetRelativePath
    Assert-NoReparsePointComponents -Root $targetRoot -Path $destinationPath

    $sourceHash = $mappedFile.PayloadHash
    $destinationExists = Test-Path -LiteralPath $destinationPath
    $targetIsDirectory = Test-Path -LiteralPath $destinationPath -PathType Container
    $targetExists = Test-Path -LiteralPath $destinationPath -PathType Leaf
    $isSettings = $targetRelativePath -eq '.agent-toolkit/settings.json'

    if ($targetIsDirectory -or ($destinationExists -and -not $targetExists)) {
        $conflicts.Add($targetRelativePath)
        Write-Warning "Preserved directory conflict: $targetRelativePath"
        continue
    }

    if (-not $targetExists) {
        if ($isDryRun) {
            Write-Host "Would install: $targetRelativePath"
            $nextHashes[$targetRelativePath] = $sourceHash
            continue
        }

        if ($PSCmdlet.ShouldProcess($destinationPath, 'Install Agent Toolkit file') -and $manifestWriteApproved) {
            $destinationDirectory = Split-Path -Parent $destinationPath
            Assert-NoReparsePointComponents -Root $targetRoot -Path $destinationDirectory
            New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
            Assert-NoReparsePointComponents -Root $targetRoot -Path $destinationPath
            [System.IO.File]::WriteAllBytes($destinationPath, $mappedFile.PayloadBytes)
            $nextHashes[$targetRelativePath] = $sourceHash
            Write-Host "Installed: $targetRelativePath"
        }
        else {
            $declinedOperations.Add("Install $targetRelativePath")
        }
        continue
    }

    if ($isSettings) {
        Write-Host "Preserved existing settings: $targetRelativePath"
        continue
    }

    $targetHash = Get-BytesSha256 -Bytes ([System.IO.File]::ReadAllBytes($destinationPath))
    $previousHash = $previousHashes[$targetRelativePath]
    if ($targetHash -eq $sourceHash) {
        $nextHashes[$targetRelativePath] = $sourceHash
        Write-Host "Unchanged: $targetRelativePath"
        continue
    }
    if ($previousHash -and $targetHash -eq $previousHash) {
        if ($isDryRun) {
            Write-Host "Would update: $targetRelativePath"
            $nextHashes[$targetRelativePath] = $sourceHash
            continue
        }

        if ($PSCmdlet.ShouldProcess($destinationPath, 'Update unchanged Agent Toolkit file') -and $manifestWriteApproved) {
            $backupPath = $mappedFile.BackupPath
            Assert-NoReparsePointComponents -Root $targetRoot -Path $backupPath
            New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
            Assert-NoReparsePointComponents -Root $targetRoot -Path $backupPath
            Assert-NoReparsePointComponents -Root $targetRoot -Path $destinationPath
            [System.IO.File]::Copy($destinationPath, $backupPath, $false)
            [System.IO.File]::WriteAllBytes($destinationPath, $mappedFile.PayloadBytes)
            $nextHashes[$targetRelativePath] = $sourceHash
            Write-Host "Updated (backup saved): $targetRelativePath"
        }
        else {
            $declinedOperations.Add("Update $targetRelativePath")
        }
        continue
    }

    $conflicts.Add($targetRelativePath)
    if ($previousHash) {
        $nextHashes[$targetRelativePath] = $previousHash
    }

    if ($isDryRun) {
        Write-Warning "Would preserve conflicting file: $targetRelativePath"
    }
    else {
        Write-Warning "Preserved existing or modified file: $targetRelativePath"
    }
}
$loopCompleted = $true
}
finally {
if (-not $isDryRun -and -not $manifestDirectoryCollision -and $manifestWriteApproved) {
        Assert-NoReparsePointComponents -Root $targetRoot -Path $targetManifestPath
        $manifestDirectory = Split-Path -Parent $targetManifestPath
        Assert-NoReparsePointComponents -Root $targetRoot -Path $manifestDirectory
        New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
        Assert-NoReparsePointComponents -Root $targetRoot -Path $targetManifestPath
        if (Test-Path -LiteralPath $targetManifestPath -PathType Container) {
            $manifestDirectoryCollision = $true
            $manifestConflictPath = '.agent-toolkit/install-manifest.json'
            if (-not $conflicts.Contains($manifestConflictPath)) {
                $conflicts.Add($manifestConflictPath)
            }
            Write-Warning "Preserved directory conflict: $manifestConflictPath"
        }
        else {
            $manifestFiles = @(
                foreach ($key in ($nextHashes.Keys | Sort-Object)) {
                    [ordered]@{
                        path   = $key
                        sha256 = $nextHashes[$key]
                    }
                }
            )
            $manifest = [ordered]@{
                manifestVersion = 2
                toolkitVersion  = if ($loopCompleted -and $conflicts.Count -eq 0 -and $declinedOperations.Count -eq 0 -and -not $sourceModified) { $requestedVersion } elseif ($previousManifest) { $previousManifest.toolkitVersion } else { $null }
                installationStatus = if ($loopCompleted -and $conflicts.Count -eq 0 -and $declinedOperations.Count -eq 0 -and -not $sourceModified) { 'complete' } else { 'partial' }
                lastCompleteVersion = if ($loopCompleted -and $conflicts.Count -eq 0 -and $declinedOperations.Count -eq 0 -and -not $sourceModified) { $requestedVersion } else { $priorCompleteVersion }
                requestedVersion = $requestedVersion
                sourceCommit = if ($loopCompleted -and $conflicts.Count -eq 0 -and $declinedOperations.Count -eq 0 -and -not $sourceModified) { $requestedCommit } else { $priorCompleteCommit }
                lastCompleteCommit = if ($loopCompleted -and $conflicts.Count -eq 0 -and $declinedOperations.Count -eq 0 -and -not $sourceModified) { $requestedCommit } else { $priorCompleteCommit }
                requestedCommit = $requestedCommit
                sourceModified = $sourceModified
                files           = $manifestFiles
            }
            Write-InstallManifest $manifest
        }
}
}

if ($isDryRun) {
    Write-Host 'Dry run complete; no files were changed.'
}
else {
    $finalMessages = [System.Collections.Generic.List[string]]::new()
    if ($declinedOperations.Count -gt 0) {
        $finalMessages.Add("Installation incomplete: $($declinedOperations.Count) ShouldProcess operation(s) were declined: $($declinedOperations -join ', ').")
    }
    if ($conflicts.Count -gt 0) {
        $finalMessages.Add("Installation finished with $($conflicts.Count) preserved conflict(s): $($conflicts -join ', '). Review and merge them manually.")
    }
    if ($finalMessages.Count -gt 0) {
        throw ($finalMessages -join ' ')
    }

    if ($sourceModified) { Write-Warning 'Source files have uncommitted changes; the manifest is marked partial rather than asserting an exact version.' }
    Write-Host "Agent Toolkit $requestedVersion installed in: $targetRoot"
}
