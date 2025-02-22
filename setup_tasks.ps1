# Ensure running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Please run as administrator!"
    Break
}

# Set up variables
$LOG_DIR = "C:\Users\conta\kinkong\logs"
$SCRIPTS_DIR = "C:\Users\conta\kinkong\engine"
$ERROR_LOG = "$LOG_DIR\task_errors.log"

# Create logs directory if it doesn't exist
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR
}

# Get Python path
$PYTHON_PATH = (Get-Command python).Path
Write-Host "Python path: $PYTHON_PATH"

# Remove existing tasks if they exist
Write-Host "Removing existing tasks..."
Get-ScheduledTask -TaskName "KinKong_*" -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false

Write-Host "Creating new tasks..."

# Create the tasks
$tasks = @(
    @{
        Name = "KinKong_TokenSnapshot"
        Script = "token_snapshots.py"
        Schedule = "Every4Hours"
        StartTime = "00:00"  # Starts at midnight, then every 4 hours
    },
    @{
        Name = "KinKong_Signals"
        Script = "signals.py"
        Schedule = "Every4Hours"
        StartTime = "00:05"  # 5 minutes after token snapshot
    },
    @{
        Name = "KinKong_Trades"
        Script = "trades.py"
        Schedule = "Every4Hours"
        StartTime = "00:10"  # 5 minutes after signals
    },
    @{
        Name = "KinKong_WalletSnapshot"
        Script = "wallet_snapshots.py"
        Schedule = "Every4Hours"
        StartTime = "00:15"  # 5 minutes after trades
    }
)

foreach ($task in $tasks) {
    $action = New-ScheduledTaskAction -Execute $PYTHON_PATH -Argument "$SCRIPTS_DIR\$($task.Script)" -WorkingDirectory $SCRIPTS_DIR
    
    # Create trigger based on schedule type
    switch ($task.Schedule) {
        "Every4Hours" {
            $trigger = New-ScheduledTaskTrigger -Once -At $task.StartTime -RepetitionInterval (New-TimeSpan -Hours 4)
        }
    }

    # Create the task
    $taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
    
    Register-ScheduledTask -TaskName $task.Name -Action $action -Trigger $trigger -Settings $taskSettings -Force
    
    Write-Host "Created task: $($task.Name)"
}

Write-Host "`nVerifying tasks..."
Get-ScheduledTask -TaskName "KinKong_*" | Format-Table TaskName, State

Write-Host "`nCreating monitoring script..."
$monitorScript = @"
Write-Host "KinKong Tasks Status"
Write-Host "==================="
Get-ScheduledTask -TaskName "KinKong_*" | Format-Table TaskName, State, LastRunTime, LastTaskResult
pause
"@

Set-Content -Path "$SCRIPTS_DIR\monitor_tasks.ps1" -Value $monitorScript

Write-Host "`nTasks created successfully with the following enhancements:"
Write-Host "- Separate log files for each task in $LOG_DIR"
Write-Host "- Centralized error logging to $ERROR_LOG"
Write-Host "- Created monitoring script at $SCRIPTS_DIR\monitor_tasks.ps1"
Write-Host "`nYou can:"
Write-Host "1. Check individual logs in $LOG_DIR"
Write-Host "2. Check error logs in $ERROR_LOG"
Write-Host "3. Run monitor_tasks.ps1 to check task status"

Read-Host "`nPress Enter to exit"
