Write-Host "KinKong Tasks Status"
Write-Host "==================="
Get-ScheduledTask -TaskName "KinKong_*" | Format-Table TaskName, State, LastRunTime, LastTaskResult
pause
