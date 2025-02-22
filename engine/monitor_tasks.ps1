# Monitor KinKong Tasks
Clear-Host

# Set up variables
$LOG_DIR = "C:\Users\conta\kinkong\logs"
$SCRIPTS_DIR = "C:\Users\conta\kinkong\engine"
$ERROR_LOG = "$LOG_DIR\task_errors.log"

function Show-Header {
    Write-Host "`nKinKong Tasks Monitor" -ForegroundColor Cyan
    Write-Host "===================" -ForegroundColor Cyan
    Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
}

function Show-TaskStatus {
    Write-Host "Task Status:" -ForegroundColor Yellow
    Write-Host "-----------" -ForegroundColor Yellow
    
    $tasks = Get-ScheduledTask -TaskName "KinKong_*"
    if ($tasks.Count -eq 0) {
        Write-Host "No KinKong tasks found!" -ForegroundColor Red
        return
    }

    foreach ($task in $tasks) {
        $taskInfo = Get-ScheduledTaskInfo -TaskName $task.TaskName
        $state = $task.State
        
        # Determine status color
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
        Write-Host "Last Run: $($taskInfo.LastRunTime)"
        Write-Host "Next Run: $($taskInfo.NextRunTime)"
        Write-Host "Last Result: $($taskInfo.LastTaskResult)"
        
        # Show trigger details
        $trigger = $task.Triggers[0]
        if ($trigger) {
            Write-Host "Schedule: " -NoNewline
            switch ($trigger.GetType().Name) {
                "DailyTrigger" { 
                    Write-Host "Daily at $($trigger.StartBoundary.Split('T')[1])"
                }
                "TimeTrigger" { 
                    Write-Host "Every $($trigger.Repetition.Interval.Split('PT')[1]) starting at $($trigger.StartBoundary.Split('T')[1])"
                }
                default {
                    Write-Host $trigger.GetType().Name
                }
            }
        }
    }
}

function Show-LogStatus {
    Write-Host "`nLog Files:" -ForegroundColor Yellow
    Write-Host "----------" -ForegroundColor Yellow
    
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
            $lastLines = Get-Content $path -Tail 3 -ErrorAction SilentlyContinue
            
            Write-Host "`n$($logFile):" -ForegroundColor Cyan
            Write-Host "Size: $([math]::Round($size/1KB, 2)) KB"
            Write-Host "Last Modified: $lastWrite"
            if ($lastLines) {
                Write-Host "Last entries:"
                foreach ($line in $lastLines) {
                    Write-Host "  $line" -ForegroundColor DarkGray
                }
            }
        } else {
            Write-Host "`n$($logFile):" -ForegroundColor Cyan
            Write-Host "File not found" -ForegroundColor Red
        }
    }
}

function Show-Menu {
    Write-Host "`nOptions:" -ForegroundColor Yellow
    Write-Host "1. Refresh Status"
    Write-Host "2. Run Task Now"
    Write-Host "3. Enable Task"
    Write-Host "4. Disable Task"
    Write-Host "5. View Full Log"
    Write-Host "6. Exit"
    
    $choice = Read-Host "`nSelect option"
    
    switch ($choice) {
        "1" { 
            Clear-Host
            Show-Header
            Show-TaskStatus
            Show-LogStatus
            Show-Menu
        }
        "2" {
            $tasks = Get-ScheduledTask -TaskName "KinKong_*"
            Write-Host "`nAvailable tasks:"
            for ($i = 0; $i -lt $tasks.Count; $i++) {
                Write-Host "$($i+1). $($tasks[$i].TaskName)"
            }
            $taskNum = Read-Host "`nSelect task number"
            if ($taskNum -match '^\d+$' -and [int]$taskNum -le $tasks.Count) {
                $selectedTask = $tasks[$taskNum-1]
                Start-ScheduledTask -TaskName $selectedTask.TaskName
                Write-Host "Task started: $($selectedTask.TaskName)" -ForegroundColor Green
            }
            Start-Sleep -Seconds 2
            Clear-Host
            Show-Header
            Show-TaskStatus
            Show-LogStatus
            Show-Menu
        }
        "3" {
            $tasks = Get-ScheduledTask -TaskName "KinKong_*"
            Write-Host "`nAvailable tasks:"
            for ($i = 0; $i -lt $tasks.Count; $i++) {
                Write-Host "$($i+1). $($tasks[$i].TaskName)"
            }
            $taskNum = Read-Host "`nSelect task number"
            if ($taskNum -match '^\d+$' -and [int]$taskNum -le $tasks.Count) {
                $selectedTask = $tasks[$taskNum-1]
                Enable-ScheduledTask -TaskName $selectedTask.TaskName
                Write-Host "Task enabled: $($selectedTask.TaskName)" -ForegroundColor Green
            }
            Start-Sleep -Seconds 2
            Clear-Host
            Show-Header
            Show-TaskStatus
            Show-LogStatus
            Show-Menu
        }
        "4" {
            $tasks = Get-ScheduledTask -TaskName "KinKong_*"
            Write-Host "`nAvailable tasks:"
            for ($i = 0; $i -lt $tasks.Count; $i++) {
                Write-Host "$($i+1). $($tasks[$i].TaskName)"
            }
            $taskNum = Read-Host "`nSelect task number"
            if ($taskNum -match '^\d+$' -and [int]$taskNum -le $tasks.Count) {
                $selectedTask = $tasks[$taskNum-1]
                Disable-ScheduledTask -TaskName $selectedTask.TaskName
                Write-Host "Task disabled: $($selectedTask.TaskName)" -ForegroundColor Yellow
            }
            Start-Sleep -Seconds 2
            Clear-Host
            Show-Header
            Show-TaskStatus
            Show-LogStatus
            Show-Menu
        }
        "5" {
            $logFile = Read-Host "Enter log file name (e.g., trades.log)"
            $fullPath = Join-Path $LOG_DIR $logFile
            if (Test-Path $fullPath) {
                Get-Content $fullPath | Out-Host
            } else {
                Write-Host "Log file not found" -ForegroundColor Red
            }
            pause
            Clear-Host
            Show-Header
            Show-TaskStatus
            Show-LogStatus
            Show-Menu
        }
        "6" {
            exit
        }
        default {
            Write-Host "Invalid option" -ForegroundColor Red
            Start-Sleep -Seconds 1
            Clear-Host
            Show-Header
            Show-TaskStatus
            Show-LogStatus
            Show-Menu
        }
    }
}

# Main execution
Show-Header
Show-TaskStatus
Show-LogStatus
Show-Menu
