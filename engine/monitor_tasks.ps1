# Monitor KinKong Tasks
Clear-Host

# Set up variables
$LOG_DIR = "C:\Users\conta\kinkong\logs"
$SCRIPTS_DIR = "C:\Users\conta\kinkong\engine"
$ERROR_LOG = "$LOG_DIR\task_errors.log"

# Get current time
$currentTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "KinKong Tasks Status" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host "Time: $currentTime`n"

Write-Host "Task Status:" -ForegroundColor Yellow
Write-Host "-----------" -ForegroundColor Yellow

# Get and display task status
Get-ScheduledTask -TaskName "KinKong_*" | ForEach-Object {
    $task = $_
    $lastRun = $task.LastRunTime
    $nextRun = $task.NextRunTime
    $state = $task.State
    $lastResult = $task.LastTaskResult

    # Color code the state
    $stateColor = switch ($state) {
        "Ready" { "Green" }
        "Running" { "Yellow" }
        "Disabled" { "Red" }
        default { "White" }
    }

    Write-Host "`nTask: " -NoNewline
    Write-Host $task.TaskName -ForegroundColor Cyan
    Write-Host "State: " -NoNewline
    Write-Host $state -ForegroundColor $stateColor
    Write-Host "Last Run: $lastRun"
    Write-Host "Next Run: $nextRun"
    Write-Host "Last Result: $lastResult"
}

Write-Host "`nLog Files:" -ForegroundColor Yellow
Write-Host "----------" -ForegroundColor Yellow

# Check and display log files
$logFiles = @(
    "wallet_snapshots.log"
    "token_snapshots.log"
    "signals.log"
    "trades.log"
    "task_errors.log"
)

foreach ($logFile in $logFiles) {
    $path = Join-Path $LOG_DIR $logFile
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        $lastWrite = (Get-Item $path).LastWriteTime
        $lastLines = Get-Content $path -Tail 3

        Write-Host "`n$logFile:" -ForegroundColor Cyan
        Write-Host "Size: $([math]::Round($size/1KB, 2)) KB"
        Write-Host "Last Modified: $lastWrite"
        Write-Host "Last entries:"
        foreach ($line in $lastLines) {
            Write-Host "  $line" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "`n$logFile:" -ForegroundColor Cyan
        Write-Host "File not found" -ForegroundColor Red
    }
}

Write-Host "`nPress any key to refresh..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Refresh display
& $MyInvocation.MyCommand.Path
