@echo off
REM Create KinKong scheduled tasks

REM Delete existing tasks if they exist
schtasks /delete /tn "KinKong_WalletSnapshot" /f 2>nul
schtasks /delete /tn "KinKong_TokenSnapshot" /f 2>nul
schtasks /delete /tn "KinKong_Signals" /f 2>nul
schtasks /delete /tn "KinKong_Trades" /f 2>nul

REM Create new tasks
schtasks /create /tn "KinKong_WalletSnapshot" /tr "python C:\Users\conta\kinkong\engine\wallet_snapshots.py" /sc daily /st 00:00 /f
schtasks /create /tn "KinKong_TokenSnapshot" /tr "python C:\Users\conta\kinkong\engine\token_snapshots.py" /sc hourly /mo 6 /st 00:00 /f
schtasks /create /tn "KinKong_Signals" /tr "python C:\Users\conta\kinkong\engine\signals.py" /sc hourly /mo 6 /st 00:05 /f
schtasks /create /tn "KinKong_Trades" /tr "python C:\Users\conta\kinkong\engine\trades.py" /sc minute /mo 30 /st 00:00 /f

REM Verify tasks were created
schtasks /query /tn "KinKong_*"

echo.
echo Tasks created successfully! Press any key to exit...
pause
