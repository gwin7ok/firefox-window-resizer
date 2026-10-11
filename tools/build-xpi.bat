@echo off
chcp 65001 > nul
rem ローカル確認用の未署名XPIを dist\gwins-window-resizer.xpi に作成する（ダブルクリック用）
cd /d "%~dp0\.."

where pwsh.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "tools\build-xpi.ps1"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools\build-xpi.ps1"
)

echo.
pause
