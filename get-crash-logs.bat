@echo off
REM Get crash logs from Timesheet app

echo.
echo ====================================================
echo      TIMESHEET APP CRASH LOG COLLECTOR
echo ====================================================
echo.

set ADB=C:\Users\Sergio\AppData\Local\Android\Sdk\platform-tools\adb.exe

echo Checking connected devices...
%ADB% devices

echo.
echo Clearing previous logs...
%ADB% logcat -c

echo.
echo Launch the app again on your device...
echo (The script will capture logs for 10 seconds)
echo.
pause

echo.
echo Capturing crash logs...
timeout /t 2 /nobreak

echo.
echo ====================================================
echo CRASH LOGS:
echo ====================================================
echo.

%ADB% logcat -d 2>&1 | findstr /C:"site.urenregistratie" /C:"FATAL" /C:"CRASH" /C:"AndroidRuntime" /C:"Exception" /C:"Error"

echo.
echo ====================================================
echo Full logcat saved to: crash-logs.txt
echo ====================================================
echo.

%ADB% logcat -d > crash-logs.txt
echo Logs saved. Opening file...
start crash-logs.txt

pause
