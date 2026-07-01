param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectFolder,

    [string]$TaskName = "Rushtown Tier Updater",
    [string]$RunTime = "06:45"
)

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) {
    Write-Error "Python was not found. Install Python 3.11+ first."
    exit 1
}

$configPath = Join-Path $ProjectFolder "config.json"
$scriptPath = Join-Path $ProjectFolder "tier_updater.py"

if (-not (Test-Path $configPath)) {
    Write-Error "Missing config.json at $configPath. Copy config.sample.json to config.json and edit paths first."
    exit 1
}

if (-not (Test-Path $scriptPath)) {
    Write-Error "Missing tier_updater.py at $scriptPath."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $python -Argument "`"$scriptPath`" --config `"$configPath`" --date today" -WorkingDirectory $ProjectFolder
$trigger = New-ScheduledTaskTrigger -Daily -At $RunTime
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Updates Rushtown Tier 1 and Tier 2 boards from daily reports." -Force

Write-Host "Scheduled task installed: $TaskName at $RunTime daily"
Write-Host "Project folder: $ProjectFolder"
