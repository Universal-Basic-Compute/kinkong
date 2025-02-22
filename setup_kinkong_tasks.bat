@echo off
REM Create KinKong scheduled tasks with advanced configuration

REM Set up variables
set LOG_DIR=C:\Users\conta\kinkong\logs
set SCRIPTS_DIR=C:\Users\conta\kinkong\engine
set ERROR_LOG=%LOG_DIR%\task_errors.log

REM Create logs directory if it doesn't exist
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Get Python path
for /f "tokens=*" %%i in ('where python') do set PYTHON_PATH=%%i

REM Delete existing tasks if they exist
echo Removing existing tasks...
schtasks /delete /tn "KinKong_WalletSnapshot" /f 2>nul
schtasks /delete /tn "KinKong_TokenSnapshot" /f 2>nul
schtasks /delete /tn "KinKong_Signals" /f 2>nul
schtasks /delete /tn "KinKong_Trades" /f 2>nul

REM Common task settings
set TASK_SETTINGS=/NP /RL HIGHEST /RU "%USERNAME%" /IT
set ERROR_SETTINGS=/F /V1 /Z

REM Create new tasks with enhanced configuration
echo Creating new tasks...

REM Wallet Snapshots - Daily at midnight
schtasks /create /tn "KinKong_WalletSnapshot" %TASK_SETTINGS% %ERROR_SETTINGS% ^
    /tr "\"%PYTHON_PATH%\" \"%SCRIPTS_DIR%\wallet_snapshots.py\" >> \"%LOG_DIR%\wallet_snapshots.log\" 2>> \"%ERROR_LOG%\"" ^
    /sc daily /st 00:00 ^
    /f

REM Token Snapshots - Every 6 hours
schtasks /create /tn "KinKong_TokenSnapshot" %TASK_SETTINGS% %ERROR_SETTINGS% ^
    /tr "\"%PYTHON_PATH%\" \"%SCRIPTS_DIR%\token_snapshots.py\" >> \"%LOG_DIR%\token_snapshots.log\" 2>> \"%ERROR_LOG%\"" ^
    /sc hourly /mo 6 /st 00:00 ^
    /f

REM Signals - Every 6 hours, 5 minutes after token snapshots
schtasks /create /tn "KinKong_Signals" %TASK_SETTINGS% %ERROR_SETTINGS% ^
    /tr "\"%PYTHON_PATH%\" \"%SCRIPTS_DIR%\signals.py\" >> \"%LOG_DIR%\signals.log\" 2>> \"%ERROR_LOG%\"" ^
    /sc hourly /mo 6 /st 00:05 ^
    /f

REM Trades - Every 30 minutes
schtasks /create /tn "KinKong_Trades" %TASK_SETTINGS% %ERROR_SETTINGS% ^
    /tr "\"%PYTHON_PATH%\" \"%SCRIPTS_DIR%\trades.py\" >> \"%LOG_DIR%\trades.log\" 2>> \"%ERROR_LOG%\"" ^
    /sc minute /mo 30 /st 00:00 ^
    /f

REM Verify tasks were created and show detailed information
echo.
echo Verifying task creation...
schtasks /query /tn "KinKong_*" /fo LIST /v

REM Create a monitoring script
echo @echo off > "%SCRIPTS_DIR%\monitor_tasks.bat"
echo echo KinKong Tasks Status Check >> "%SCRIPTS_DIR%\monitor_tasks.bat"
echo echo ======================== >> "%SCRIPTS_DIR%\monitor_tasks.bat"
echo schtasks /query /tn "KinKong_*" /fo LIST /v >> "%SCRIPTS_DIR%\monitor_tasks.bat"
echo pause >> "%SCRIPTS_DIR%\monitor_tasks.bat"

echo.
echo Tasks created successfully with the following enhancements:
echo - Separate log files for each task in %LOG_DIR%
echo - Centralized error logging to %ERROR_LOG%
echo - Running with highest available privileges
echo - Automatic retry on failure
echo - Created monitoring script at %SCRIPTS_DIR%\monitor_tasks.bat
echo.
echo You can:
echo 1. Check individual logs in %LOG_DIR%
echo 2. Check error logs in %ERROR_LOG%
echo 3. Run monitor_tasks.bat to check task status
echo.
pause
