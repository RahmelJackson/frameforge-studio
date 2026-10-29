param([switch]$NoBrowser,[switch]$StopStudio,[switch]$PortableRuntime)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
function Get-ArchiveHash([string]$File) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($File)
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}
try {
    $node = $null
    if (!$PortableRuntime) {
        $installed = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($installed) {
            $version = & $installed.Source --version
            if ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22) { $node = $installed.Source }
        }
    }
    if (!$node) {
        $lock = Get-Content -Raw -LiteralPath (Join-Path $studioRoot 'setup/quickstart-runtime.lock.json') | ConvertFrom-Json
        $architecture = if ($env:PROCESSOR_ARCHITEW6432 -eq 'ARM64' -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
        $spec = $lock.node.artifacts.PSObject.Properties['win32-'+$architecture].Value
        if (!$spec) { throw 'This computer needs a supported Node.js 22+ installation from https://nodejs.org/download.' }
        $runtime = Join-Path $studioRoot 'runtime/bootstrap'
        $folder = Join-Path $runtime ('node-v'+$lock.node.version+'-win-'+$architecture)
        $node = Join-Path $folder 'node.exe'
        if (!(Test-Path -LiteralPath $node)) {
            if ($StopStudio) { throw 'No private runtime exists. Nothing was downloaded or stopped.' }
            Write-Output 'Preparing Frameforge. Downloading a verified private Node runtime, about 36 MB.'
            Write-Output 'It stays in this folder. No administrator access or system installation is needed.'
            New-Item -ItemType Directory -Force -Path $runtime | Out-Null
            $archive = Join-Path $runtime $spec.file
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            if (!(Test-Path -LiteralPath $archive)) {
                if (!(Test-Path -LiteralPath ($archive+'.part')) -or (Get-ArchiveHash ($archive+'.part')) -ne $spec.sha256) {
                    Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/v'+$lock.node.version+'/'+$spec.file) -OutFile ($archive+'.part') -TimeoutSec 300
                }
                if ((Get-ArchiveHash ($archive+'.part')) -ne $spec.sha256) { throw 'Runtime checksum did not match. No downloaded program was executed.' }
                Move-Item -LiteralPath ($archive+'.part') -Destination $archive
            }
            if ((Get-ArchiveHash $archive) -ne $spec.sha256) { throw 'Cached runtime checksum did not match. Keep the file for inspection; no program was executed.' }
            $stage = Join-Path $runtime ('unpack-'+[Guid]::NewGuid().ToString('N'))
            [void][Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
            [IO.Compression.ZipFile]::ExtractToDirectory($archive,$stage)
            if (Test-Path -LiteralPath $folder) { throw 'The runtime folder already exists but has no executable. Inspect it before retrying.' }
            Move-Item -LiteralPath (Join-Path $stage (Split-Path -Leaf $folder)) -Destination $folder
        }
    }
    $arguments = @((Join-Path $PSScriptRoot 'quickstart.mjs'))
    if ($NoBrowser) { $arguments += '--no-browser' }
    if ($StopStudio) { $arguments += '--stop' }
    & $node @arguments
    exit $LASTEXITCODE
} catch {
    Write-Host ('Frameforge could not start: '+$_.Exception.Message)
    Write-Host 'Extract the whole ZIP into a folder you can write to, then try again. Nothing changes your ComfyUI or model files.'
    exit 1
}
