$ErrorActionPreference = 'Stop'
$cliArguments = @($args)

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js 22 or newer is required. Install it from https://nodejs.org/ and run again.'
    }
    & node -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"
    if ($LASTEXITCODE -ne 0) {
        throw 'Node.js 22 or newer is required. Upgrade Node.js and run again.'
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'npm is missing. Repair your Node.js installation and run again.'
    }

    if ($cliArguments.Count -eq 0) {
        $url = Read-Host 'Enter the webpage URL'
        if ([string]::IsNullOrWhiteSpace($url)) {
            throw 'A webpage URL is required.'
        }
        $cliArguments = @($url.Trim())
    }

    Push-Location $PSScriptRoot
    try {
        $stampPath = Join-Path $PSScriptRoot 'node_modules\.webpage-md-dependencies'
        $fingerprint = & node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; console.log(createHash('sha256').update(readFileSync('package.json')).update(readFileSync('package-lock.json')).digest('hex'));"
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not read the dependency manifests.'
        }
        $needsInstall = -not (Test-Path -LiteralPath $stampPath)
        if (-not $needsInstall) {
            $needsInstall = (Get-Content -LiteralPath $stampPath -Raw).Trim() -ne $fingerprint
        }
        if (-not $needsInstall) {
            try {
                # Windows PowerShell treats native stderr as errors; npm's
                # diagnostic here is expected when a dependency needs repair.
                $ErrorActionPreference = 'Continue'
                & npm.cmd ls --omit=dev --depth=0 *> $null
                $needsInstall = $LASTEXITCODE -ne 0
            } finally {
                $ErrorActionPreference = 'Stop'
            }
        }
        if ($needsInstall) {
            Write-Host 'Installing project dependencies...'
            & npm.cmd ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) {
                throw "Dependency installation failed (exit code $LASTEXITCODE)."
            }
            Set-Content -LiteralPath $stampPath -Value $fingerprint -Encoding ASCII
        }

        if ($cliArguments -contains '--render') {
            Write-Host 'Preparing Chromium (already installed browsers are reused)...'
            & node (Join-Path $PSScriptRoot 'node_modules\playwright\cli.js') install chromium
            if ($LASTEXITCODE -ne 0) {
                throw "Chromium installation failed (exit code $LASTEXITCODE)."
            }
        }

        & node (Join-Path $PSScriptRoot 'src\cli.js') @cliArguments
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    exit $exitCode
} catch {
    [Console]::Error.WriteLine("Error: $($_.Exception.Message)")
    exit 1
}
