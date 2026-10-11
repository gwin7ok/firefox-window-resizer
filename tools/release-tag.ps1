Param(
    [string]$Remote = 'origin',
    [switch]$DryRun,
    [switch]$NoPush
)

# manifest.json の version から vX.Y.Z の注釈付きタグを作成して push する。
# タグの push で .github/workflows/release.yml が起動し、署名済み XPI が Release に添付される。
# 既存タグの削除・再作成は行わない（AMO は同一バージョンを再署名できないため）。

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).ProviderPath
Set-Location $repoRoot

$manifestPath = Join-Path $repoRoot 'manifest.json'
$version = (Get-Content -Raw -Path $manifestPath -Encoding UTF8 | ConvertFrom-Json).version
if (-not $version) { Write-Error 'version not found in manifest.json'; exit 2 }

$tag = "v$version"
Write-Host "Repository root: $repoRoot"
Write-Host "Version: $version"
Write-Host "Tag: $tag"

# CHANGELOG に該当節があるか
$changelog = Get-Content -Raw -Path (Join-Path $repoRoot 'CHANGELOG.md') -Encoding UTF8
if ($changelog -notmatch "(?m)^## \[$([regex]::Escape($version))\]") {
    Write-Error "CHANGELOG.md has no section for $version. Run tools/bump-version.ps1 or add it."
    exit 3
}

# 未コミットの変更がないか
$dirty = (& git status --porcelain) | Out-String
if ($dirty.Trim() -ne '') {
    Write-Error "Working tree is not clean. Commit your changes before tagging.`n$dirty"
    exit 4
}

# 既存タグ（ローカル / リモート）があれば中止
if ((& git tag -l $tag | Out-String).Trim() -ne '') {
    Write-Error "Local tag $tag already exists. Bump the version instead of re-creating the tag."
    exit 5
}
if (-not $NoPush) {
    $remoteTag = (& git ls-remote --tags $Remote "refs/tags/$tag" | Out-String).Trim()
    if ($remoteTag -ne '') {
        Write-Error "Remote tag $tag already exists on $Remote. Bump the version instead."
        exit 6
    }
}

$planned = @("git tag -a $tag -m 'Release $tag' HEAD")
if (-not $NoPush) { $planned += "git push $Remote refs/tags/$tag" }

if ($DryRun) {
    Write-Host 'Dry run: the following commands would be executed:'
    $planned | ForEach-Object { Write-Host "  $_" }
    exit 0
}

& git tag -a $tag -m "Release $tag" HEAD
if ($LASTEXITCODE -ne 0) { Write-Error 'git tag failed'; exit 10 }

if (-not $NoPush) {
    & git push $Remote "refs/tags/$tag"
    if ($LASTEXITCODE -ne 0) { Write-Error 'git push failed'; exit 11 }
}

Write-Host "Success: tag '$tag' created$(if (-not $NoPush) { ' and pushed' })." -ForegroundColor Green
