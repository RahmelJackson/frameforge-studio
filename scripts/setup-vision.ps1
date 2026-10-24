$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$visionDirectory = Join-Path $studioRoot 'runtime/vision-env'
$visionPython = Join-Path $visionDirectory 'Scripts/python.exe'
if (!(Test-Path -LiteralPath $visionPython)) {
    $enginePython = Join-Path $studioRoot 'runtime/engine-env/Scripts/python.exe'
    if (!(Test-Path -LiteralPath $enginePython)) { throw 'Set up the studio engine first.' }
    & $enginePython -m venv $visionDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the isolated vision environment.' }
}
& $visionPython -m pip install --index-url https://pypi.org/simple --only-binary=:all: -r (Join-Path $studioRoot 'setup/requirements-vision.lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Vision dependency installation failed.' }
$modelDirectory = Join-Path $studioRoot 'runtime/vision-models'
New-Item -ItemType Directory -Force -Path $modelDirectory | Out-Null
$modelLock = Get-Content (Join-Path $studioRoot 'setup/vision-models.lock.json') | ConvertFrom-Json
foreach ($modelRecord in $modelLock.models) {
    $modelPath = Join-Path $modelDirectory $modelRecord.name
    if ((Test-Path -LiteralPath $modelPath) -and (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash.ToLowerInvariant() -eq $modelRecord.sha256) { continue }
    $pendingPath = $modelPath + '.download'
    try {
        Invoke-WebRequest ($modelRecord.url + '?generation=' + $modelRecord.generation) -OutFile $pendingPath
        if ((Get-Item -LiteralPath $pendingPath).Length -ne $modelRecord.bytes -or (Get-FileHash -LiteralPath $pendingPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $modelRecord.sha256) { throw 'Downloaded vision model does not match the pinned checksum.' }
        Move-Item -LiteralPath $pendingPath -Destination $modelPath -Force
    } finally { if (Test-Path -LiteralPath $pendingPath) { Remove-Item -LiteralPath $pendingPath } }
}
Write-Output 'Isolated vision tools are ready. The ComfyUI environment was preserved.'
