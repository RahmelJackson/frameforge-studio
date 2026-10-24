$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioConfig = Get-Content (Join-Path $studioRoot 'config.local.json') | ConvertFrom-Json
$runtimePath = Join-Path $studioRoot 'runtime'
if ($studioConfig.storageRoot) {
    $configuredRuntime = Join-Path $studioConfig.storageRoot 'runtime'
    if (!(Test-Path -LiteralPath $configuredRuntime)) { throw 'The configured D-drive runtime is unavailable. Check that D: is connected before starting.' }
    $runtimePath = $configuredRuntime
}
New-Item -ItemType Directory -Force -Path $runtimePath,(Join-Path $runtimePath 'user'),(Join-Path $runtimePath 'temp') | Out-Null
$env:PYTHONDONTWRITEBYTECODE = '1'
$databaseUrl = 'sqlite:///' + ((Join-Path $runtimePath 'comfy.db') -replace '\\','/')
& $studioConfig.python (Join-Path $studioConfig.comfySource 'main.py') --listen 127.0.0.1 --port 8188 --base-directory $runtimePath --extra-model-paths-config (Join-Path $studioRoot 'setup/image-model-paths.yaml') --user-directory (Join-Path $runtimePath 'user') --temp-directory (Join-Path $runtimePath 'temp') --database-url $databaseUrl --disable-all-custom-nodes --disable-api-nodes --disable-auto-launch --disable-dynamic-vram --reserve-vram 6
exit $LASTEXITCODE
