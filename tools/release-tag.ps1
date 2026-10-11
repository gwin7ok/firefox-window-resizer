Param(
    [string]$Remote = 'origin',
    [switch]$DryRun,
    [switch]$NoPush,
    # manifest.json / CHANGELOG.md だけが未コミットの場合、"Release vX.Y.Z" としてコミットしてから push + タグ発行する
    [switch]$CommitRelease,
    # 確認プロンプトを省略する
    [switch]$Yes
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
    Write-Error "CHANGELOG.md has no section for $version. Run Ctrl+Shift+2 (tools/bump-version.ps1) first."
    exit 3
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

# 未コミットの変更の扱い
$dirtyLines = @(& git status --porcelain | Where-Object { $_ -ne '' })
$needCommit = $false
if ($dirtyLines.Count -gt 0) {
    $dirtyFiles = $dirtyLines | ForEach-Object { $_.Substring(3).Trim('"') }
    $allowed = @('manifest.json', 'CHANGELOG.md')
    $others = @($dirtyFiles | Where-Object { $allowed -notcontains $_ })
    if ($CommitRelease -and $others.Count -eq 0) {
        $needCommit = $true
    } else {
        Write-Error ("Working tree is not clean. Commit your changes before tagging.`n" + ($dirtyLines -join "`n"))
        exit 4
    }
}

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()

$planned = @()
if ($needCommit) { $planned += "git add manifest.json CHANGELOG.md; git commit -m 'Release $tag'" }
if (-not $NoPush) { $planned += "git push $Remote $branch" }
$planned += "git tag -a $tag -m 'Release $tag' HEAD"
if (-not $NoPush) { $planned += "git push $Remote refs/tags/$tag" }

Write-Host ''
Write-Host 'Planned commands:'
$planned | ForEach-Object { Write-Host "  $_" }

if ($DryRun) {
    Write-Host 'Dry run: nothing was executed.'
    exit 0
}

if (-not $Yes) {
    $answer = (Read-Host "リリース $tag を生成します（push するとGitHub Actionsが署名・公開します）。実行しますか? [y/N]").Trim()
    if ($answer -notmatch '^[yY]') { Write-Host '中止しました。'; exit 0 }
}

if ($needCommit) {
    & git add manifest.json CHANGELOG.md
    & git commit -m "Release $tag"
    if ($LASTEXITCODE -ne 0) { Write-Error 'git commit failed'; exit 9 }
}

if (-not $NoPush) {
    & git push $Remote $branch
    if ($LASTEXITCODE -ne 0) { Write-Error 'git push (branch) failed'; exit 12 }
}

& git tag -a $tag -m "Release $tag" HEAD
if ($LASTEXITCODE -ne 0) { Write-Error 'git tag failed'; exit 10 }

if (-not $NoPush) {
    & git push $Remote "refs/tags/$tag"
    if ($LASTEXITCODE -ne 0) { Write-Error 'git push (tag) failed'; exit 11 }
}

Write-Host "Success: tag '$tag' created$(if (-not $NoPush) { ' and pushed' })." -ForegroundColor Green
