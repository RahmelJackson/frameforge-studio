$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioConfig = Get-Content (Join-Path $studioRoot 'config.local.json') | ConvertFrom-Json
if ($studioConfig.storageRoot) {
    foreach ($storagePart in @('runtime','data','evidence','backups')) {
        if (!(Test-Path -LiteralPath (Join-Path $studioConfig.storageRoot $storagePart))) { throw ('The configured studio storage is unavailable: '+$storagePart+'. Check storageRoot before starting.') }
    }
}
$runtimePath = Join-Path $studioRoot 'runtime'
New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
$studioProcesses = @()
try { $null = Invoke-RestMethod ($studioConfig.comfyUrl + '/system_stats') -TimeoutSec 2 }
catch {
    $engineScript = Join-Path $PSScriptRoot 'start-comfy.ps1'
    $engineProcess = Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-File',('"'+$engineScript+'"')) -WorkingDirectory $studioRoot -RedirectStandardOutput (Join-Path $runtimePath 'engine.stdout.log') -RedirectStandardError (Join-Path $runtimePath 'engine.stderr.log') -PassThru
    $studioProcesses += @{ role='engine launcher'; pid=$engineProcess.Id; started=$engineProcess.StartTime.ToString('o') }
}
$studioUrl = 'http://127.0.0.1:' + $studioConfig.port
try { $null = Invoke-RestMethod ($studioUrl + '/api/catalog') -TimeoutSec 2 }
catch {
    $serverPath = Join-Path $studioRoot 'server.mjs'
    $serverProcess = Start-Process node.exe -WindowStyle Hidden -ArgumentList @(('"'+$serverPath+'"')) -WorkingDirectory $studioRoot -RedirectStandardOutput (Join-Path $runtimePath 'studio.stdout.log') -RedirectStandardError (Join-Path $runtimePath 'studio.stderr.log') -PassThru
    $studioProcesses += @{ role='studio'; pid=$serverProcess.Id; started=$serverProcess.StartTime.ToString('o') }
}
if ($studioProcesses.Count -gt 0) { $studioProcesses | ConvertTo-Json | Set-Content (Join-Path $runtimePath 'launched-processes.json') }
$websiteReady = $false
for ($websiteAttempt = 0; $websiteAttempt -lt 30; $websiteAttempt++) {
    try { $null = Invoke-RestMethod ($studioUrl + '/api/catalog') -TimeoutSec 1; $websiteReady = $true; break }
    catch { Start-Sleep -Milliseconds 500 }
}
if (!$websiteReady) { throw 'The studio website did not become ready. Check runtime/studio.stderr.log before opening or restarting it again.' }
Write-Output "Studio: $studioUrl"
Write-Output 'The engine may take a minute to start. Logs are in runtime/.'
