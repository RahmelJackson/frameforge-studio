$ErrorActionPreference='Stop'
$studioRoot=Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'start-studio.ps1')
$studioConfig=Get-Content (Join-Path $studioRoot 'config.local.json') | ConvertFrom-Json
$studioHome='http://127.0.0.1:'+ $studioConfig.port + '/'
$available=$false
for ($attempt=0;$attempt -lt 30;$attempt++) {
    try { $null=Invoke-RestMethod ($studioHome+'api/catalog') -TimeoutSec 2; $available=$true; break } catch { Start-Sleep -Seconds 1 }
}
if (!$available) { throw 'The studio could not start. See runtime/studio.stderr.log.' }
Start-Process $studioHome
