@echo off
cls
echo KinKong Tasks Monitor
echo ===================
echo.

REM Set color for status
color 0A

REM Get current time
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YYYY=%dt:~0,4%"
set "MM=%dt:~4,2%"
set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%"
set "Min=%dt:~10,2%"
set "Sec=%dt:~12,2%"

echo Current time: %HH%:%Min%:%Sec%
echo Date: %YYYY%-%MM%-%DD%
echo.

REM Check if log directory exists
set "LOG_DIR=C:\Users\conta\kinkong\logs"
if not exist "%LOG_DIR%" (
    echo WARNING: Log directory not found at %LOG_DIR%
    echo Creating log directory...
    mkdir "%LOG_DIR%"
)

echo Task Status:
echo -----------
schtasks /query /tn "KinKong_*" /fo list /v | findstr "TaskName Status Last Next"
echo.

echo Log File Sizes:
echo --------------
for %%F in ("%LOG_DIR%\*.log") do (
    for %%S in (%%F) do echo %%~nF: %%~zS bytes
)
echo.

echo Recent Log Entries:
echo -----------------
echo.
echo Wallet Snapshots:
if exist "%LOG_DIR%\wallet_snapshots.log" (
    powershell -Command "Get-Content '%LOG_DIR%\wallet_snapshots.log' -Tail 5"
) else (
    echo No wallet snapshots log found
)
echo.

echo Token Snapshots:
if exist "%LOG_DIR%\token_snapshots.log" (
    powershell -Command "Get-Content '%LOG_DIR%\token_snapshots.log' -Tail 5"
) else (
    echo No token snapshots log found
)
echo.

echo Signals:
if exist "%LOG_DIR%\signals.log" (
    powershell -Command "Get-Content '%LOG_DIR%\signals.log' -Tail 5"
) else (
    echo No signals log found
)
echo.

echo Trades:
if exist "%LOG_DIR%\trades.log" (
    powershell -Command "Get-Content '%LOG_DIR%\trades.log' -Tail 5"
) else (
    echo No trades log found
)
echo.

echo Error Log:
if exist "%LOG_DIR%\task_errors.log" (
    powershell -Command "Get-Content '%LOG_DIR%\task_errors.log' -Tail 5"
) else (
    echo No error log found
)
echo.

echo.
echo Press any key to refresh...
pause > nul
cls
goto :eof
