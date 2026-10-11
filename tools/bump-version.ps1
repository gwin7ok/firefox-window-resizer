Param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [switch]$DryRun
)

# manifest.json の version を更新し、CHANGELOG.md の [Unreleased] を [Version] - 日付 に切り出す。
# 使い方: pwsh ./tools/bump-version.ps1 -Version 1.2.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).ProviderPath
$manifestPath = Join-Path $repoRoot 'manifest.json'
$changelogPath = Join-Path $repoRoot 'CHANGELOG.md'

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be x.y.z (got '$Version')"
    exit 1
}

$manifestRaw = Get-Content -Raw -Path $manifestPath -Encoding UTF8
$current = ([regex]::Match($manifestRaw, '"version"\s*:\s*"([^"]+)"')).Groups[1].Value
if (-not $current) { Write-Error 'version not found in manifest.json'; exit 2 }

if ([version]$Version -le [version]$current) {
    Write-Error "New version $Version must be greater than current $current (AMO cannot sign the same version twice)."
    exit 3
}

$changelogRaw = Get-Content -Raw -Path $changelogPath -Encoding UTF8
if ($changelogRaw -notmatch '(?m)^## \[Unreleased\]') {
    Write-Error 'CHANGELOG.md has no [Unreleased] section'
    exit 4
}
if ($changelogRaw -match "(?m)^## \[$([regex]::Escape($Version))\]") {
    Write-Error "CHANGELOG.md already has a section for $Version"
    exit 5
}

# [Unreleased] に内容があるか確認
$unreleased = [regex]::Match($changelogRaw, '(?ms)^## \[Unreleased\]\s*\r?\n(.*?)(?=^## \[|\z)').Groups[1].Value
if ([string]::IsNullOrWhiteSpace($unreleased)) {
    Write-Error '[Unreleased] section is empty. Write the changes first.'
    exit 6
}

$date = (Get-Date).ToString('yyyy-MM-dd')
$newManifest = [regex]::Replace($manifestRaw, '("version"\s*:\s*")[^"]+(")', "`${1}$Version`${2}", 1)
$newChangelog = [regex]::Replace($changelogRaw, '(?m)^## \[Unreleased\]', "## [Unreleased]`n`n`n## [$Version] - $date", 1)

Write-Host "manifest.json : $current -> $Version"
Write-Host "CHANGELOG.md  : [Unreleased] -> [$Version] - $date"

if ($DryRun) {
    Write-Host 'Dry run: no files were changed.'
    exit 0
}

[System.IO.File]::WriteAllText($manifestPath, $newManifest, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText($changelogPath, $newChangelog, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Done. Review the changes, commit, then run tools/release-tag.ps1.' -ForegroundColor Green
