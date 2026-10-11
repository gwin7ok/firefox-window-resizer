Param(
    [string]$Version,
    [switch]$DryRun
)

# manifest.json の version を更新し、CHANGELOG.md の [Unreleased] を [Version] - 日付 に切り出す。
# -Version を省略すると、次のバージョンを対話的に選択できる（VS Code タスク: Update Changelog）。
# 使い方: pwsh ./tools/bump-version.ps1 [-Version 1.2.0] [-DryRun]

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).ProviderPath
$manifestPath = Join-Path $repoRoot 'manifest.json'
$changelogPath = Join-Path $repoRoot 'CHANGELOG.md'

function Open-InEditor([string]$Path) {
    # VS Code を待たずに起動する（code は code.cmd のため同期実行するとスクリプトが戻らない）
    if (Get-Command code -ErrorAction SilentlyContinue) {
        Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'code', '-r', "`"$Path`"" -WindowStyle Hidden
    }
}

$manifestRaw = Get-Content -Raw -Path $manifestPath -Encoding UTF8
$current = ([regex]::Match($manifestRaw, '"version"\s*:\s*"([^"]+)"')).Groups[1].Value
if (-not $current) { Write-Error 'version not found in manifest.json'; exit 2 }

# [Unreleased] に内容があるか確認（空なら CHANGELOG を開いて終了）
$changelogRaw = Get-Content -Raw -Path $changelogPath -Encoding UTF8
if ($changelogRaw -notmatch '(?m)^## \[Unreleased\]') {
    Write-Error 'CHANGELOG.md has no [Unreleased] section'
    exit 4
}
$unreleasedPattern = '(?ms)^## \[Unreleased\]\s*\r?\n(.*?)(?=^## \[|\z)'
$unreleased = [regex]::Match($changelogRaw, $unreleasedPattern).Groups[1].Value
if ([string]::IsNullOrWhiteSpace($unreleased)) {
    # [Unreleased] が空: 前回リリース以降のコミット件名から自動生成する
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8

    # 起点: 最新の v* タグ。なければ CHANGELOG.md を最後に変更したコミット。
    $base = (& git describe --tags --abbrev=0 --match 'v*' 2>$null | Out-String).Trim()
    $baseLabel = $base
    if (-not $base) {
        $base = (& git log -1 --format=%H -- CHANGELOG.md 2>$null | Out-String).Trim()
        $baseLabel = if ($base) { "CHANGELOG.md の最終変更コミット ($($base.Substring(0, 7)))" } else { '' }
    }
    $range = if ($base) { "$base..HEAD" } else { 'HEAD' }

    # ノイズとして除外する件名のパターン
    $excludePatterns = @('^Release v', '^Merge ', '^(readme|README)')

    $subjects = @(& git -c core.quotepath=off log --no-merges --reverse --format=%s $range |
        Where-Object { $_ -and $_.Trim() -ne '' } |
        Where-Object { $s = $_; -not ($excludePatterns | Where-Object { $s -match $_ }) } |
        Select-Object -Unique)

    if ($subjects.Count -eq 0) {
        Write-Warning "[Unreleased] が空で、起点 ($baseLabel) 以降に対象のコミットもありません。CHANGELOG.md に変更内容を書いてから実行してください。"
        Open-InEditor $changelogPath
        exit 6
    }

    $generated = ($subjects | ForEach-Object { "- $_" }) -join "`n"
    Write-Host "[Unreleased] が空です。起点 [$baseLabel] 以降のコミット件名から生成します ($($subjects.Count) 件):" -ForegroundColor Yellow
    Write-Host ''
    Write-Host $generated
    Write-Host ''

    $writeBack = [regex]::Replace($changelogRaw, '(?m)^## \[Unreleased\][ \t]*\r?\n', "## [Unreleased]`n`n$generated`n`n", 1)

    if ($DryRun) {
        Write-Host 'Dry run: CHANGELOG.md は変更しません（上記が [Unreleased] に入る想定で続行します）。'
        $changelogRaw = $writeBack
    } else {
        $answer = (Read-Host 'この内容を [Unreleased] に書き込みますか? [Y=書き込んで続行 (Enter) / e=書き込んで編集 / n=中止]').Trim()
        switch -Regex ($answer) {
            '^([yY]|)$' { $changelogRaw = $writeBack }   # Enter のみ（空入力）も続行
            '^[eE]$' {
                [System.IO.File]::WriteAllText($changelogPath, $writeBack, (New-Object System.Text.UTF8Encoding($false)))
                Write-Host 'CHANGELOG.md に書き込みました。内容を編集して、もう一度実行してください。' -ForegroundColor Green
                Open-InEditor $changelogPath
                exit 0
            }
            default { Write-Host '中止しました。'; exit 0 }
        }
    }
}

# バージョン未指定なら対話的に選択
if (-not $Version) {
    $cur = [version]$current
    $patch = "$($cur.Major).$($cur.Minor).$($cur.Build + 1)"
    $minor = "$($cur.Major).$($cur.Minor + 1).0"
    $major = "$($cur.Major + 1).0.0"
    Write-Host "現在のバージョン: $current"
    Write-Host "  1) $patch  (パッチ: バグ修正)"
    Write-Host "  2) $minor  (マイナー: 機能追加)"
    Write-Host "  3) $major  (メジャー: 互換性のない変更)"
    $choice = (Read-Host '番号、または x.y.z を入力 (空Enterで中止)').Trim()
    switch -Regex ($choice) {
        '^1$' { $Version = $patch }
        '^2$' { $Version = $minor }
        '^3$' { $Version = $major }
        '^\d+\.\d+\.\d+$' { $Version = $choice }
        default { Write-Host '中止しました。'; exit 0 }
    }
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be x.y.z (got '$Version')"
    exit 1
}
if ([version]$Version -le [version]$current) {
    Write-Error "New version $Version must be greater than current $current (AMO cannot sign the same version twice)."
    exit 3
}
if ($changelogRaw -match "(?m)^## \[$([regex]::Escape($Version))\]") {
    Write-Error "CHANGELOG.md already has a section for $Version"
    exit 5
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
Write-Host '更新しました。内容を確認し、tools/release-tag.ps1 -CommitRelease（タスク: release-tag-and-push-short）でリリースを生成してください。' -ForegroundColor Green
