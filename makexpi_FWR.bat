@echo off
chcp 65001 > nul
echo Firefox Window Resizer XPI Builder
echo =====================================

REM Change to the directory where this batch file is located
echo Changing to working directory...
cd /d "%~dp0"

REM Show current directory
echo Current directory: %CD%

REM Execute PowerShell script with debugging
echo Creating XPI file...
echo Debug: Checking for PowerShell Core...

REM Try PowerShell Core first, then fall back to Windows PowerShell
where pwsh.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Found PowerShell Core - using pwsh.exe
    pwsh.exe -ExecutionPolicy Bypass -File "firefox-window-resizermakeXPI.ps1"
) else (
    echo PowerShell Core not found - using powershell.exe with UTF-8
    powershell.exe -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '.\firefox-window-resizermakeXPI.ps1'"
)

REM Check execution result
if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] XPI file creation completed
) else (
    echo.
    echo [ERROR] An error occurred (Error code: %ERRORLEVEL%)
)

echo.
echo Process completed. Press any key to continue...
pause > nul