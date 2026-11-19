[CmdletBinding()]
param([string]$SettingsPath, [string]$SchemaPath)

# Schema-v1 validation is deliberately independent of Test-Json: PowerShell
# 7.0-7.3 do not implement draft 2020-12 conditional keywords consistently.
# Keep these rules synchronized with .agent-toolkit/settings.schema.json.
function Get-SettingsObject {
    param([System.Text.Json.JsonElement]$Value, [string[]]$Allowed, [string[]]$Required)
    if ($Value.ValueKind -ne [System.Text.Json.JsonValueKind]::Object) { throw 'Expected an object.' }
    $result = [Collections.Generic.Dictionary[string, System.Text.Json.JsonElement]]::new([StringComparer]::Ordinal)
    foreach ($property in $Value.EnumerateObject()) {
        if ($property.Name -cnotin $Allowed -or $result.ContainsKey($property.Name)) {
            throw 'Unexpected or duplicate property.'
        }
        $result.Add($property.Name, $property.Value)
    }
    foreach ($name in $Required) {
        if (-not $result.ContainsKey($name)) { throw "Required property missing: $name." }
    }
    return ,$result
}

function Assert-SettingsBoolean {
    param([System.Text.Json.JsonElement]$Value)
    if ($Value.ValueKind -notin @([System.Text.Json.JsonValueKind]::True, [System.Text.Json.JsonValueKind]::False)) {
        throw 'Expected a boolean.'
    }
}

function Assert-SettingsString {
    param([System.Text.Json.JsonElement]$Value, [switch]$NonEmpty)
    if ($Value.ValueKind -ne [System.Text.Json.JsonValueKind]::String -or ($NonEmpty -and $Value.GetString().Length -eq 0)) {
        throw 'Expected a string of the required form.'
    }
}

function Test-JsonNumberIsOne {
    param([System.Text.Json.JsonElement]$Value)
    if ($Value.ValueKind -ne [System.Text.Json.JsonValueKind]::Number) { return $false }
    $match = [regex]::Match($Value.GetRawText(), '\A(?<int>0|[1-9]\d*)(?:\.(?<frac>\d+))?(?:[eE](?<exp>[+-]?\d+))?\z')
    if (-not $match.Success) { return $false }
    $digits = ($match.Groups['int'].Value + $match.Groups['frac'].Value).TrimStart('0')
    if (-not $digits -or $digits.TrimEnd('0') -cne '1') { return $false }
    $exponent = 0L
    if ($match.Groups['exp'].Success -and -not [long]::TryParse($match.Groups['exp'].Value, [ref]$exponent)) { return $false }
    return ($exponent -eq ($match.Groups['frac'].Length - ($digits.Length - 1)))
}

function Assert-SupportedSettingsSchema {
    param([string]$SchemaPath, [AllowEmptyCollection()][byte[]]$SchemaBytes)
    try {
        if ($PSBoundParameters.ContainsKey('SchemaBytes')) {
            $schemaText = [Text.UTF8Encoding]::new($false, $true).GetString($SchemaBytes)
        }
        elseif ($SchemaPath) {
            $schemaText = [IO.File]::ReadAllText($SchemaPath, [Text.UTF8Encoding]::new($false, $true))
        }
        else { throw 'Schema is required.' }
        # Fail closed if the trusted schema changes; update these rules and the
        # parity tests alongside the schema. Normalize checkout line endings.
        $schemaText = $schemaText.TrimStart([char]0xFEFF).Replace("`r`n", "`n").TrimEnd()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $schemaHash = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($schemaText)) | ForEach-Object { $_.ToString('x2') }) }
        finally { $sha.Dispose() }
        if ($schemaHash -cne 'a2cba951a17171f2ca693d6118a53f1b9d5e876489b033286dc6b231e08bf8ce') { throw 'Unsupported settings schema.' }
    }
    catch {
        throw 'Settings schema is missing, unreadable or unsupported; bootstrap from a trusted current checkout with a matching validator and schema before continuing.'
    }
}

function Assert-SettingsV1 {
    param(
        [Alias('Path')][string]$SettingsPath,
        [AllowEmptyCollection()][byte[]]$SettingsBytes,
        [string]$SchemaPath,
        [AllowEmptyCollection()][byte[]]$SchemaBytes
    )
    $document = $null
    if ($PSBoundParameters.ContainsKey('SchemaBytes')) { Assert-SupportedSettingsSchema -SchemaBytes $SchemaBytes }
    else { Assert-SupportedSettingsSchema -SchemaPath $SchemaPath }
    try {
        if ($PSBoundParameters.ContainsKey('SettingsBytes')) {
            $text = [Text.UTF8Encoding]::new($false, $true).GetString($SettingsBytes)
        }
        else {
            $text = [IO.File]::ReadAllText($SettingsPath, [Text.UTF8Encoding]::new($false, $true))
        }
        $text = $text.TrimStart([char]0xFEFF)
        $document = [System.Text.Json.JsonDocument]::Parse($text)
        $root = Get-SettingsObject $document.RootElement @('$schema','schemaVersion','initialized','developmentWorkflow','gitAutomation','gitFlow','versioning','releaseAutomation','language','additionalRequirements','customSettings','reviewerPolicy') @('schemaVersion','initialized','developmentWorkflow','gitAutomation','gitFlow','versioning','releaseAutomation','language','additionalRequirements','customSettings')
        if ($root.ContainsKey('$schema')) { Assert-SettingsString $root['$schema'] }
        # JSON Schema's integer/const accepts mathematically integral numeric 1, including 1.0.
        if (-not (Test-JsonNumberIsOne $root['schemaVersion'])) { throw 'Unsupported schemaVersion.' }
        Assert-SettingsBoolean $root['initialized']
        $initialized = $root['initialized'].GetBoolean()
        $workflow = if ($root['developmentWorkflow'].ValueKind -eq [System.Text.Json.JsonValueKind]::Null) { $null } else { Assert-SettingsString $root['developmentWorkflow']; $root['developmentWorkflow'].GetString() }
        if ($null -ne $workflow -and $workflow -cnotin @('single-branch','git-flow','github-flow')) { throw 'Invalid developmentWorkflow.' }
        $language = if ($root['language'].ValueKind -eq [System.Text.Json.JsonValueKind]::Null) { $null } else { Assert-SettingsString $root['language']; $root['language'].GetString() }
        if ($null -ne $language -and $language -cnotin @('zh-CN','en','bilingual')) { throw 'Invalid language.' }
        if ($initialized -and ($null -eq $workflow -or $null -eq $language)) { throw 'Initialized settings require workflow and language.' }
        if ($root.ContainsKey('reviewerPolicy')) {
            Assert-SettingsString $root['reviewerPolicy']
            if ($root['reviewerPolicy'].GetString() -cnotin @('on-requested-sealing-or-release-tag','every-task','never')) { throw 'Invalid reviewerPolicy.' }
        }
        $git = Get-SettingsObject $root['gitAutomation'] @('autoCommit','autoPush','autoTag','tagSourceBranch') @('autoCommit','autoPush','autoTag')
        foreach ($name in @('autoCommit','autoPush','autoTag')) { Assert-SettingsBoolean $git[$name] }
        if ($git.ContainsKey('tagSourceBranch')) {
            Assert-SettingsString $git['tagSourceBranch']
            if ($git['tagSourceBranch'].GetString() -cne 'main') { throw 'Invalid tagSourceBranch.' }
        }
        $flow = Get-SettingsObject $root['gitFlow'] @('featureBranchFromDevelop','createPullRequestAutomatically','sealing') @('featureBranchFromDevelop','createPullRequestAutomatically')
        foreach ($name in @('featureBranchFromDevelop','createPullRequestAutomatically')) { Assert-SettingsBoolean $flow[$name] }
        if ($workflow -ceq 'single-branch' -and ($flow['featureBranchFromDevelop'].GetBoolean() -or $flow['createPullRequestAutomatically'].GetBoolean())) { throw 'Invalid single-branch gitFlow.' }
        if ($workflow -cne 'github-flow' -and $flow['createPullRequestAutomatically'].GetBoolean() -and -not $git['autoPush'].GetBoolean()) { throw 'Automatic pull requests require autoPush.' }
        if ($flow.ContainsKey('sealing')) {
            $seal = Get-SettingsObject $flow['sealing'] @('sourceBranch','targetBranch','createPullRequest','mergeStrategy','tagAfterMerge') @('sourceBranch','targetBranch','createPullRequest','mergeStrategy','tagAfterMerge')
            foreach ($name in @('sourceBranch','targetBranch')) { Assert-SettingsString $seal[$name] -NonEmpty }
            foreach ($name in @('createPullRequest','tagAfterMerge')) { Assert-SettingsBoolean $seal[$name] }
            Assert-SettingsString $seal['mergeStrategy']
            if ($seal['mergeStrategy'].GetString() -cnotin @('squash','merge','rebase')) { throw 'Invalid mergeStrategy.' }
            if ($initialized -and $workflow -cne 'github-flow') {
                if ($seal['createPullRequest'].GetBoolean() -and -not $git['autoPush'].GetBoolean()) { throw 'Sealing pull requests require autoPush.' }
                if ($seal['tagAfterMerge'].GetBoolean() -and (-not $git['autoTag'].GetBoolean() -or $seal['targetBranch'].GetString() -cne 'main')) { throw 'Invalid sealing tag policy.' }
            }
        }
        $versioning = Get-SettingsObject $root['versioning'] @('useGitVersion') @('useGitVersion')
        Assert-SettingsBoolean $versioning['useGitVersion']
        $release = Get-SettingsObject $root['releaseAutomation'] @('githubActions','azurePipelines') @('githubActions','azurePipelines')
        foreach ($name in @('githubActions','azurePipelines')) { Assert-SettingsBoolean $release[$name] }
        if ($root['additionalRequirements'].ValueKind -ne [System.Text.Json.JsonValueKind]::Array) { throw 'Expected an additionalRequirements array.' }
        foreach ($item in $root['additionalRequirements'].EnumerateArray()) { Assert-SettingsString $item -NonEmpty }
        if ($root['customSettings'].ValueKind -ne [System.Text.Json.JsonValueKind]::Object) { throw 'Expected a customSettings object.' }
    }
    catch {
        # Parsing and IO exception messages can contain setting values; never echo them.
        if ($PSBoundParameters.ContainsKey('SettingsBytes')) {
            throw 'Incoming default settings are invalid or do not conform to settings schema v1; no files were installed.'
        }
        throw 'Existing .agent-toolkit/settings.json is invalid or does not conform to settings schema v1; preserve it and correct the JSON and schema before continuing.'
    }
    finally { if ($null -ne $document) { $document.Dispose() } }
}

if ($SettingsPath -or $SchemaPath) {
    Assert-SettingsV1 -SettingsPath $SettingsPath -SchemaPath $SchemaPath
}
