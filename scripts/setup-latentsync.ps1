$ErrorActionPreference='Stop'
$studioRoot=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $studioRoot 'runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$basePython=Join-Path $runtime 'audio-env\Scripts\python.exe'
$environment=Join-Path $runtime 'latentsync-env'
if (!(Test-Path -LiteralPath (Join-Path $environment 'Scripts\python.exe'))) {
    & $basePython -m venv $environment
    if ($LASTEXITCODE -ne 0) { throw 'LatentSync environment creation failed.' }
}
@((Join-Path $runtime 'audio-env\Lib\site-packages'),(Join-Path $runtime 'engine-env\Lib\site-packages')) | Set-Content -LiteralPath (Join-Path $environment 'Lib\site-packages\frameforge-shared.pth')
$python=Join-Path $environment 'Scripts\python.exe'
& $python -m pip install --no-cache-dir --disable-pip-version-check -r (Join-Path $studioRoot 'setup\requirements-latentsync.lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Isolated LatentSync dependency setup failed.' }
& $basePython (Join-Path $PSScriptRoot 'setup-latentsync.py')
if ($LASTEXITCODE -ne 0) { throw 'LatentSync pinned download verification failed.' }
& $basePython (Join-Path $PSScriptRoot 'setup-lipsync-eval.py')
if ($LASTEXITCODE -ne 0) { throw 'Lip-sync evaluator verification failed.' }
Write-Output 'LatentSync experiment is installed in the Studio runtime. Existing speech/video environments were preserved.'
