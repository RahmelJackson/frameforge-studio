$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioConfig = Get-Content (Join-Path $studioRoot 'config.local.json') | ConvertFrom-Json
$runtimePath = Join-Path $studioRoot 'runtime'
if ($studioConfig.storageRoot) {
    $configuredRuntime = Join-Path $studioConfig.storageRoot 'runtime'
    if (!(Test-Path -LiteralPath $configuredRuntime)) { throw 'The configured runtime folder is unavailable. Check your storageRoot setting before starting.' }
    $runtimePath = $configuredRuntime
}
New-Item -ItemType Directory -Force -Path $runtimePath,(Join-Path $runtimePath 'user'),(Join-Path $runtimePath 'temp'),(Join-Path $runtimePath 'custom_nodes') | Out-Null
$env:PYTHONDONTWRITEBYTECODE = '1'
$databaseUrl = 'sqlite:///' + ((Join-Path $runtimePath 'comfy.db') -replace '\\','/')
$bridgeOptions = @()
if (Test-Path -LiteralPath (Join-Path $runtimePath 'custom_nodes/comfyui-frameforge/__init__.py')) { $bridgeOptions = @('--whitelist-custom-nodes', 'comfyui-frameforge') }
$enginePython = $studioConfig.python
if ($studioConfig.comfyPython) { $enginePython = $studioConfig.comfyPython }
$modelOptions = @()
$modelPaths = Join-Path $studioRoot 'setup/image-model-paths.yaml'
if (Test-Path -LiteralPath $modelPaths) { $modelOptions = @('--extra-model-paths-config', $modelPaths) }
& $enginePython (Join-Path $studioConfig.comfySource 'main.py') --listen 127.0.0.1 --port 8188 --base-directory $runtimePath @modelOptions --user-directory (Join-Path $runtimePath 'user') --temp-directory (Join-Path $runtimePath 'temp') --database-url $databaseUrl --disable-all-custom-nodes @bridgeOptions --disable-api-nodes --disable-auto-launch --disable-dynamic-vram --reserve-vram 6
exit $LASTEXITCODE
