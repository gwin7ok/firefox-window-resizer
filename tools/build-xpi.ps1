Param(
    # 出力先（省略時は dist/gwins-window-resizer.xpi）
    [string]$OutFile
)

# ローカル確認用の未署名XPIを作成する（PowerShell 標準機能のみ。7-Zip などの追加ツールは不要）。
# 署名済みXPIはタグの push をきっかけに GitHub Actions が作成する（DEVELOPMENT.md 参照）。

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).ProviderPath

# XPI に含めないもの（リポジトリ直下のディレクトリ名 / ファイル名パターン）
$excludeDirs = @('.git', '.github', '.vscode', 'node_modules', 'tools', 'tests', 'dist', 'web-ext-artifacts')
$excludeFiles = @('*.md', '*.ps1', '*.bat', '*.xpi', '*.zip', '*.log', '.gitignore')

if (-not $OutFile) {
    $OutFile = Join-Path $repoRoot 'dist/gwins-window-resizer.xpi'
}
$OutFile = [System.IO.Path]::GetFullPath($OutFile)
$outDir = Split-Path -Parent $OutFile
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if (Test-Path $OutFile) { Remove-Item $OutFile -Force }

$manifestPath = Join-Path $repoRoot 'manifest.json'
$manifest = Get-Content -Raw -Path $manifestPath -Encoding UTF8 | ConvertFrom-Json
Write-Host "Extension: $($manifest.name) v$($manifest.version)"

# 収集
$rootLen = $repoRoot.TrimEnd('\', '/').Length + 1
$files = Get-ChildItem -Path $repoRoot -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($rootLen).Replace('\', '/')
    $top = $rel.Split('/')[0]
    if ($rel.Contains('/') -and ($excludeDirs -contains $top)) { return }
    foreach ($pattern in $excludeFiles) {
        if ($_.Name -like $pattern) { return }
    }
    [pscustomobject]@{ FullName = $_.FullName; Entry = $rel }
}

if (-not ($files | Where-Object { $_.Entry -eq 'manifest.json' })) {
    Write-Error 'manifest.json is not included'
    exit 2
}

# 作成（エントリ名は常に "/" 区切りにする）
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($OutFile, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($f in $files) {
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $f.FullName, $f.Entry, [System.IO.Compression.CompressionLevel]::Optimal)
    }
}
finally {
    $zip.Dispose()
}

$size = (Get-Item $OutFile).Length
Write-Host ("Files: {0}  Size: {1:N1} KB" -f @($files).Count, ($size / 1KB))
Write-Host "XPI created: $OutFile" -ForegroundColor Green
Write-Host 'Firefox へは about:debugging の「一時的なアドオンを読み込む」で manifest.json を選んで確認できます。'
