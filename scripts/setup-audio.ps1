$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$audioDirectory = Join-Path $studioRoot 'runtime/audio-env'
$audioPython = Join-Path $audioDirectory 'Scripts/python.exe'
$enginePython = Join-Path $studioRoot 'runtime/engine-env/Scripts/python.exe'
if (!(Test-Path -LiteralPath $enginePython)) { throw 'Set up the studio engine first.' }
if (!(Test-Path -LiteralPath $audioPython)) {
    & $enginePython -m venv $audioDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the audio environment.' }
}
& $audioPython -m pip install --index-url https://pypi.org/simple --only-binary=:all: -r (Join-Path $studioRoot 'setup/requirements-audio.lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Audio dependency installation failed.' }
# Read-only fallback for the already installed, large CUDA Torch distribution.
# The audio environment's own packages take precedence; no engine package is changed.
$engineSite = Join-Path $studioRoot 'runtime/engine-env/Lib/site-packages'
Set-Content -LiteralPath (Join-Path $audioDirectory 'Lib/site-packages/frameforge-engine-torch.pth') -Value $engineSite -Encoding Ascii
& $audioPython -c 'import torch; from diffusers import UNet2DConditionModel; from transformers import WhisperModel; assert torch.cuda.is_available(); print("CUDA runtime:", torch.__version__)'
if ($LASTEXITCODE -ne 0) { throw 'The installed CUDA model runtime is unavailable.' }
& $audioPython (Join-Path $PSScriptRoot 'setup-audio-models.py')
if ($LASTEXITCODE -ne 0) { throw 'An audio model failed its pinned checksum.' }
Write-Output 'Audio tools are ready. Lip sync also needs scripts/setup-vision.ps1.'
