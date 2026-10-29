param([Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
[void][Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
[IO.Compression.ZipFile]::ExtractToDirectory($Archive,$Destination)
