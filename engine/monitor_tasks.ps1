# Market Sentiment Task
$Action = New-ScheduledTaskAction -Execute "python" -Argument "engine\market_sentiment.py"
$Trigger = @(
    # First run at 00:00
    New-ScheduledTaskTrigger -At 00:00 -Daily
    # Second run at 12:00
    New-ScheduledTaskTrigger -At 12:00 -Daily
)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "KinKong_MarketSentiment" -Action $Action -Trigger $Trigger -Settings $Settings

# Display task status
Write-Host "KinKong Tasks Status"
Write-Host "==================="
Get-ScheduledTask -TaskName "KinKong_*" | Format-Table TaskName, State, LastRunTime, LastTaskResult
pause
