# 文字エンコード設定（Windows PowerShell 5.1対策）
if ($PSVersionTable.PSVersion.Major -lt 6) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
}

# 定数の設定
$PackageName = "firefox-window-resizer"                             # パッケージ名
$SourceFolder = Split-Path -Parent $MyInvocation.MyCommand.Path     # このスクリプトファイルがあるフォルダ
$OutputFileName = "$PackageName@gwin7ok.com.xpi"                   # 出力するXPIファイル名
$TempFolderName = "$PackageName-temp"                                     # 一時フォルダ名
$ExcludeDirs = @(".git", ".vscode", "node_modules")                       # 除外するディレクトリ
$ExcludeFiles = @("*.zip", "*.xpi", "*.log", "*.ps1", "*.md", ".gitignore")                              # 除外するファイル
$SevenZipPath = "C:\Program Files\7-Zip\7z.exe"                           # 7-Zipのパス

# 実行環境の詳細情報
Write-Host "`n=== 実行環境診断 ===" -ForegroundColor Yellow
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)" -ForegroundColor Cyan
Write-Host "Current Location: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Source Folder: $SourceFolder" -ForegroundColor Cyan
Write-Host "Source Folder Exists: $(Test-Path $SourceFolder)" -ForegroundColor Cyan
Write-Host "Working Directory: $PWD" -ForegroundColor Cyan
Write-Host "Execution Policy: $(Get-ExecutionPolicy)" -ForegroundColor Cyan

# ソースフォルダの内容確認
if (Test-Path $SourceFolder) {
    Write-Host "`nSource Folder Contents:" -ForegroundColor Cyan
    Get-ChildItem -Path $SourceFolder -Name | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
} else {
    Write-Host "`n[ERROR] Source folder not found: $SourceFolder" -ForegroundColor Red
    throw "Source folder not found"
}

# デバッグ情報


try {
    # 一時ディレクトリの作成
    $tempDir = Join-Path -Path $env:TEMP -ChildPath $TempFolderName
    if (Test-Path -Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
    New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
    Write-Host "一時ディレクトリを作成しました: $tempDir" -ForegroundColor Cyan

    # 必要なファイルをコピー（除外リストを適用）
    Write-Host "ファイルをコピーしています..." -ForegroundColor Cyan
    $items = Get-ChildItem -Path $SourceFolder -Exclude $ExcludeFiles

    foreach ($item in $items) {
        if ($item.PSIsContainer -and $ExcludeDirs -contains $item.Name) {
            Write-Host "  除外: $($item.Name)" -ForegroundColor Yellow
            continue
        }

        $destination = Join-Path -Path $tempDir -ChildPath $item.Name
        
        # 詳細なファイル情報を表示
        Write-Host "  コピー: $($item.Name)" -ForegroundColor Green
        Write-Host "    ソース: $($item.FullName)" -ForegroundColor Gray
        Write-Host "    ターゲット: $destination" -ForegroundColor Gray
        Write-Host "    サイズ: $(if ($item.PSIsContainer) { 'フォルダ' } else { $item.Length })" -ForegroundColor Gray
        
        # コピー実行
        try {
            Copy-Item -Path $item.FullName -Destination $destination -Recurse -Force -ErrorAction Stop
            
            # コピー後の検証
            if (Test-Path $destination) {
                Write-Host "    ✓ コピー成功" -ForegroundColor Green
                
                # フォルダの場合は内容を確認
                if ($item.PSIsContainer) {
                    $copiedItems = Get-ChildItem -Path $destination -Recurse -File
                    Write-Host "    フォルダ内ファイル数: $($copiedItems.Count)" -ForegroundColor Gray
                }
            } else {
                Write-Host "    ✗ コピー後に確認できない" -ForegroundColor Red
                throw "Copy verification failed for $($item.Name)"
            }
        } catch {
            Write-Host "    ✗ コピーエラー: $($_.Exception.Message)" -ForegroundColor Red
            throw $_
        }
    }

    # 重要なファイルが含まれているかチェック
    Write-Host "`n重要なファイルの存在確認:" -ForegroundColor Cyan
    $criticalFiles = @("manifest.json", "scripts\background.js", "scripts\logger.js", "views\popup.html", "views\popup.js")
    foreach ($file in $criticalFiles) {
        $filePath = Join-Path -Path $tempDir -ChildPath $file
        if (Test-Path -Path $filePath) {
            Write-Host "  ✓ $file" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $file (見つかりません)" -ForegroundColor Red
        }
    }

    # ZIPファイルを作成
    Set-Location -Path $tempDir
    if (Test-Path -Path $SevenZipPath) {
        Write-Host "`n7-Zipを使用してZIPファイルを作成します" -ForegroundColor Cyan
        & $SevenZipPath a -tzip "$($OutputFileName -replace '\.xpi$', '.zip')" * -mx=9
    } else {
        Write-Host "`n7-Zipが見つかりません。Windowsの標準圧縮機能を使用します" -ForegroundColor Yellow
        
        # 文字エンコード問題を回避するため、確実な方法で圧縮
        if ($PSVersionTable.PSVersion.Major -lt 6) {
            # Windows PowerShell 5.1の場合の安全な圧縮
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zipPath = "$($OutputFileName -replace '\.xpi$', '.zip')"
            [System.IO.Compression.ZipFile]::CreateFromDirectory($PWD.Path, $zipPath)
        } else {
            # PowerShell Core の場合
            Compress-Archive -Path * -DestinationPath "$($OutputFileName -replace '\.xpi$', '.zip')" -Force
        }
    }

    # ZIPファイルをXPIファイルにリネーム
    if (Test-Path -Path "$($OutputFileName -replace '\.xpi$', '.zip')") {
        Rename-Item -Path "$($OutputFileName -replace '\.xpi$', '.zip')" -NewName $OutputFileName -Force

        # .xpi ファイルを $SourceFolder にコピー
        $sourceDestinationFile = Join-Path -Path $SourceFolder -ChildPath $OutputFileName
        Copy-Item -Path $OutputFileName -Destination $SourceFolder -Force
        Write-Host "`n✅ XPIファイルを作成しました: $sourceDestinationFile" -ForegroundColor Green
        
        # 拡張機能の更新手順を表示（ドラッグ・アンド・ドロップ推奨）
        Write-Host "`n" + "="*70 -ForegroundColor Yellow
        Write-Host "🔄 Firefox拡張機能の更新手順 (再起動不要)" -ForegroundColor Yellow
        Write-Host "="*70 -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🟢 推奨方法: ドラッグ・アンド・ドロップ" -ForegroundColor Green
        Write-Host "1. Firefoxを開く" -ForegroundColor Cyan
        Write-Host "2. 作成されたXPIファイルをFirefoxウィンドウにドラッグ" -ForegroundColor Cyan
        Write-Host "   📁 ファイル場所: $sourceDestinationFile" -ForegroundColor White
        Write-Host "3. [追加] ボタンをクリックして更新完了 ✅" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "="*70 -ForegroundColor Yellow
    } else {
        throw "ZIPファイルの作成に失敗しました。"
    }

} catch {
    Write-Host "`nエラーが発生しました: $_" -ForegroundColor Red
} finally {
    # 必ず元のディレクトリに戻る
    Set-Location -Path $SourceFolder
    Write-Host "`n作業ディレクトリを元に戻しました: $SourceFolder" -ForegroundColor Cyan

    # 一時ディレクトリを削除
    if ($null -ne $tempDir -and (Test-Path -Path $tempDir)) {
        Remove-Item -Path $tempDir -Recurse -Force
        Write-Host "一時ディレクトリを削除しました: $tempDir" -ForegroundColor Cyan
    }
}

# XPIファイルの場所をエクスプローラーで開くか確認
Write-Host ""
$response = Read-Host "XPIファイルをエクスプローラーで開いてドラッグ準備をしますか？ (Y/n)"
if ($response -ne 'n' -and $response -ne 'N') {
    try {
        $xpiFilePath = Join-Path -Path $SourceFolder -ChildPath $OutputFileName
        if (Test-Path -Path $xpiFilePath) {
            # エクスプローラーでXPIファイルを選択状態で開く
            Start-Process "explorer.exe" -ArgumentList "/select,`"$xpiFilePath`""
            Write-Host "✅ エクスプローラーでXPIファイルを開きました" -ForegroundColor Green
            Write-Host "💡 XPIファイルをFirefoxにドラッグしてください" -ForegroundColor Cyan
        } else {
            Write-Host "❌ XPIファイルが見つかりません: $xpiFilePath" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ エクスプローラーを開けませんでした: $_" -ForegroundColor Red
    }
}

# 完了メッセージ
Write-Host ""
Write-Host "🎉 XPIファイルの作成が完了しました！" -ForegroundColor Green
Write-Host "📁 ファイル場所: $SourceFolder\$OutputFileName" -ForegroundColor White
Write-Host ""
Write-Host "何かキーを押してください..." -ForegroundColor Gray
#[System.Console]::ReadKey() | Out-Null