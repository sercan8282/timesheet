@echo off
REM Better crash log collector for Timesheet app

setlocal enabledelayedexpansion

echo.
echo ====================================================
echo    TIMESHEET APP - DETAILED CRASH LOG COLLECTOR
echo ====================================================
echo.

set ADB=C:\Users\Sergio\AppData\Local\Android\Sdk\platform-tools\adb.exe

echo Checking connected devices...
%ADB% devices
echo.

echo Clearing all previous logs...
%ADB% logcat -c
%ADB% logcat --buffer=all -c

timeout /t 2 /nobreak

echo.
echo ====================================================
echo IMPORTANT: Follow these steps:
echo 1. Open the Timesheet app on your device NOW
echo 2. Wait for it to crash
echo 3. Come back here - press any key
echo ====================================================
echo.
pause

echo.
echo Waiting for crash to happen...
timeout /t 5 /nobreak

echo.
echo ====================================================
echo EXTRACTING CRASH LOGS (all buffers)...
echo ====================================================
echo.

REM Get all logs
%ADB% logcat -d > crash-logs-full.txt

REM Filter for app-specific crashes
echo.
echo ====================================================
echo APP-SPECIFIC CRASH LOGS:
echo ====================================================
echo.

%ADB% logcat -d 2>&1 | findstr /B /C:".*site.urenregistratie.*" /C:".*FATAL.*" /C:".*CRASH.*" /C:".*AndroidRuntime.*" /C:".*Exception.*" /C:".*ERROR.*"

echo.
echo ====================================================
echo SEARCHING FOR WEBVIEW ERRORS...
echo ====================================================
echo.

%ADB% logcat -d 2>&1 | findstr /I "chromium webview renderer"

echo.
echo ====================================================
echo Files created:
echo  - crash-logs-full.txt (all logs)
echo ====================================================
echo.

echo Opening crash-logs-full.txt...
timeout /t 2 /nobreak
start notepad crash-logs-full.txt

pause
