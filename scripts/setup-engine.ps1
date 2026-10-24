param([string]$BasePython = 'python')
$ErrorActionPreference='Stop'
$studioRoot=Split-Path -Parent $PSScriptRoot
$setupRoot=Join-Path $studioRoot 'setup'
$manifest=Get-Content (Join-Path $setupRoot 'manifest.json') | ConvertFrom-Json
$archive=Join-Path $setupRoot $manifest.sourceArchive
if (!(Test-Path -LiteralPath $archive)) { throw 'This lightweight source release uses your own ComfyUI. Install it from https://www.comfy.org/download and connect it in Setup & models. The original machine engine snapshot is not distributed.' }
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256){throw 'Engine source checksum mismatch.'}
& $BasePython -c "import sys; assert sys.version_info[:2]==(3,12), 'Python 3.12 is required'"
if($LASTEXITCODE -ne 0){throw 'Provide a Python 3.12 executable with -BasePython.'}
$enginePython=Join-Path $studioRoot 'runtime/engine-env/Scripts/python.exe'
if(-not (Test-Path -LiteralPath $enginePython)){
    & $BasePython -m venv (Join-Path $studioRoot 'runtime/engine-env')
    if($LASTEXITCODE -ne 0){throw 'Python environment creation failed.'}
}
$engineSource=Join-Path $studioRoot ('runtime/comfy-engine-'+$manifest.sha256.Substring(0,12))
$readyMarker=Join-Path $engineSource '.snapshot-ready'
if(-not (Test-Path -LiteralPath $readyMarker)){Expand-Archive -LiteralPath $archive -DestinationPath $engineSource -Force;Set-Content -LiteralPath $readyMarker -Value $manifest.sha256}
& $enginePython -m pip install -r (Join-Path $setupRoot 'requirements-windows.lock.txt')
if($LASTEXITCODE -ne 0){throw 'Dependency installation failed; config was not changed. Rerun setup to resume.'}
& $enginePython -c "import av,numpy,PIL,torch; assert torch.cuda.is_available(), 'CUDA is unavailable'; print(torch.__version__)"
if($LASTEXITCODE -ne 0){throw 'GPU dependency check failed; config was not changed.'}
& $enginePython -c "import sys; sys.path.insert(0,sys.argv[1]); import comfy.sd,comfy_extras.nodes_wan; print('Engine imports verified')" $engineSource
if($LASTEXITCODE -ne 0){throw 'Engine source import check failed; config was not changed.'}
$settingsPath=Join-Path $studioRoot 'config.local.json'
$settings=Get-Content $(if(Test-Path -LiteralPath $settingsPath){$settingsPath}else{Join-Path $studioRoot 'config.example.json'}) | ConvertFrom-Json
$settings | Add-Member -NotePropertyName python -NotePropertyValue $enginePython -Force
$settings | Add-Member -NotePropertyName comfySource -NotePropertyValue $engineSource -Force
$settings | ConvertTo-Json | Set-Content -LiteralPath $settingsPath
Write-Output 'Standalone project engine is ready. Restart the studio services to apply it.'
