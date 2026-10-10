function Assert-WebpageUrl {
    param([string]$Url)
    $parsed = $null
    if (-not [System.Uri]::TryCreate($Url, [System.UriKind]::Absolute, [ref]$parsed) -or
        $parsed.Scheme -notin @('http', 'https') -or
        [string]::IsNullOrEmpty($parsed.Host) -or
        -not [string]::IsNullOrEmpty($parsed.UserInfo) -or
        -not $parsed.IsWellFormedOriginalString()) {
        throw "Invalid HTTP/HTTPS URL (credentials are not supported): $Url"
    }
}

function Assert-WebpageOptions {
    param([string[]]$Options)
    $render = $false
    $waitFor = $false
    foreach ($option in $Options) {
        if ($option -eq '--render') { $render = $true }
    }
    for ($index = 0; $index -lt $Options.Count; $index++) {
        $option = $Options[$index]
        if ($option -in @('--render', '--help', '-h')) { continue }
        if ($option -notin @('-o', '--output', '--selector', '--wait-for', '--timeout')) {
            throw "Unknown option: $option."
        }
        $index++
        if ($index -ge $Options.Count -or
            [string]::IsNullOrWhiteSpace($Options[$index]) -or
            $Options[$index].StartsWith('-')) {
            throw "Missing value for $option."
        }
        if ($option -eq '--timeout') {
            $timeout = 0L
            if (-not [long]::TryParse($Options[$index], [ref]$timeout) -or
                $timeout -le 0 -or $timeout -gt 2147483647) {
                throw '--timeout must be a positive integer no greater than 2147483647.'
            }
        }
        if ($option -eq '--wait-for') { $waitFor = $true }
    }
    if ($waitFor -and -not $render) {
        throw '--wait-for requires --render.'
    }
}

function Invoke-WebpageRun {
    param([string]$ScriptPath, [string[]]$Arguments)
    $previous = $env:WEBPAGE_MD_ARGUMENTS_JSON
    $preference = $ErrorActionPreference
    try {
        # JSON avoids Windows PowerShell's lossy native quoting of CSS selectors
        # and paths. Only a fixed transport flag crosses the command line.
        $env:WEBPAGE_MD_ARGUMENTS_JSON = ConvertTo-Json -InputObject @($Arguments) -Compress
        $ErrorActionPreference = 'Continue'
        $global:LASTEXITCODE = $null
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath --encoded-arguments | Out-Host
        if ($null -eq $LASTEXITCODE) {
            throw 'Could not start the single-page script.'
        }
        return $LASTEXITCODE
    } finally {
        $env:WEBPAGE_MD_ARGUMENTS_JSON = $previous
        $ErrorActionPreference = $preference
    }
}
