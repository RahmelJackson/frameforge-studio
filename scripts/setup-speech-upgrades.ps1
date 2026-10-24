$ErrorActionPreference = 'Stop'
$speechRoot = Split-Path -Parent $PSScriptRoot
$speechPython = Join-Path $speechRoot 'runtime/speech-env/Scripts/python.exe'
$basePython = Join-Path $speechRoot 'runtime/engine-env/Scripts/python.exe'
if (!(Test-Path -LiteralPath $speechPython)) {
    & $basePython -m venv (Join-Path $speechRoot 'runtime/speech-env')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create speech environment.' }
}
& $speechPython -m pip install --index-url https://pypi.org/simple --no-deps -r (Join-Path $speechRoot 'setup/requirements-speech.lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Speech dependency setup failed.' }
@((Join-Path $speechRoot 'runtime/audio-env/Lib/site-packages'),(Join-Path $speechRoot 'runtime/engine-env/Lib/site-packages')) | Set-Content -LiteralPath (Join-Path $speechRoot 'runtime/speech-env/Lib/site-packages/frameforge-base.pth') -Encoding Ascii
& $speechPython -c 'from chatterbox import ChatterboxVC, ChatterboxTTS; from perth import PerthImplicitWatermarker; assert PerthImplicitWatermarker is not None; import torch; assert torch.cuda.is_available(); print("Speech runtime ready")'
if ($LASTEXITCODE -ne 0) { throw 'Speech runtime failed its import / CUDA / watermark check.' }
& $basePython (Join-Path $PSScriptRoot 'setup-speech-upgrades.py')
if ($LASTEXITCODE -ne 0) { throw 'Pinned speech weight setup failed.' }
