$ErrorActionPreference = 'Stop'
$batchArguments = @($args)

$helpText = @'
Usage:
  batch.cmd <url1> <url2> ... [options]
  batch.cmd --file <utf8-list.txt> [additional URLs] [options]

With no arguments, prompts for a UTF-8 list file.
List files contain one URL per line; blank lines and # comments are ignored.
URLs are processed sequentially. Failures do not stop the remaining URLs.

Options applied to every URL:
  -o, --output <directory>
      --selector <css>
      --render
      --wait-for <css>
      --timeout <ms>
  -h, --help

Exit codes: 0 = all succeeded; 1 = one or more failures or invalid batch input.
'@

try {
    . (Join-Path $PSScriptRoot 'script-helpers.ps1')
    if ($batchArguments.Count -eq 0) {
        $file = Read-Host 'Enter the UTF-8 URL list file path'
        if ([string]::IsNullOrWhiteSpace($file)) {
            throw 'A URL list file path is required.'
        }
        $batchArguments = @('--file', $file.Trim().Trim('"'))
    }

    $urls = [System.Collections.Generic.List[string]]::new()
    $commonArguments = [System.Collections.Generic.List[string]]::new()
    for ($index = 0; $index -lt $batchArguments.Count; $index++) {
        $argument = [string]$batchArguments[$index]
        if ($argument -in @('--help', '-h')) {
            Write-Host $helpText
            exit 0
        }
        if ($argument -eq '--file' -or
            $argument -in @('-o', '--output', '--selector', '--wait-for', '--timeout')) {
            $index++
            if ($index -ge $batchArguments.Count -or
                [string]::IsNullOrWhiteSpace($batchArguments[$index]) -or
                ([string]$batchArguments[$index]).StartsWith('-')) {
                throw "Missing value for $argument."
            }
            $value = [string]$batchArguments[$index]
            if ($argument -eq '--file') {
                $resolved = (Resolve-Path -LiteralPath $value).ProviderPath
                $encoding = [System.Text.UTF8Encoding]::new($false, $true)
                # ReadAllText auto-detects UTF-16 BOMs; decode explicitly to
                # enforce the documented UTF-8-only input format.
                $text = $encoding.GetString([System.IO.File]::ReadAllBytes($resolved)).TrimStart([char]0xFEFF)
                foreach ($line in ($text -split '\r?\n')) {
                    $url = $line.Trim()
                    if ($url -and -not $url.StartsWith('#')) {
                        Assert-WebpageUrl $url
                        $urls.Add($url)
                    }
                }
            } else {
                $commonArguments.Add($argument)
                $commonArguments.Add($value)
            }
        } elseif ($argument -eq '--render') {
            $commonArguments.Add($argument)
        } elseif ($argument.StartsWith('-')) {
            throw "Unknown batch option: $argument. Use --help for usage."
        } elseif (-not [string]::IsNullOrWhiteSpace($argument)) {
            Assert-WebpageUrl $argument.Trim()
            $urls.Add($argument.Trim())
        }
    }
    if ($urls.Count -eq 0) {
        throw 'No URLs supplied. Pass URLs or --file with a non-empty URL list.'
    }
    Assert-WebpageOptions -Options $commonArguments.ToArray()

    $failed = [System.Collections.Generic.List[string]]::new()
    $succeeded = 0
    for ($index = 0; $index -lt $urls.Count; $index++) {
        $url = $urls[$index]
        Write-Host "`n[$($index + 1)/$($urls.Count)] $url"
        $childArguments = @($url) + $commonArguments.ToArray()
        $exitCode = Invoke-WebpageRun -ScriptPath (Join-Path $PSScriptRoot 'run.ps1') -Arguments $childArguments
        if ($exitCode -eq 0) {
            $succeeded++
        } else {
            $failed.Add($url)
            Write-Host "FAILED (exit code $exitCode): $url"
        }
    }

    Write-Host "`nSummary: total=$($urls.Count), succeeded=$succeeded, failed=$($failed.Count)"
    if ($failed.Count -gt 0) {
        Write-Host 'Failed URLs:'
        foreach ($url in $failed) {
            Write-Host "  $url"
        }
        exit 1
    }
    exit 0
} catch {
    [Console]::Error.WriteLine("Error: $($_.Exception.Message)")
    exit 1
}
