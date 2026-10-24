$ErrorActionPreference='Stop'
$source=[IO.Path]::GetFullPath('C:\models').TrimEnd('\')
$target=[IO.Path]::GetFullPath('D:\Frameforge\comfy-models').TrimEnd('\')
if ($source -ne 'C:\models' -or $target -ne 'D:\Frameforge\comfy-models') { throw 'Unexpected model roots.' }
if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Model source already linked; inspect before rerunning.' }
if (Test-Path -LiteralPath $target) { throw 'Destination exists; original retained. Inspect before recovery.' }
if (@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('python.exe','pythonw.exe') -and $_.CommandLine -match '(?i)comfy.*main\.py|main\.py.*--' }).Count) { throw 'A ComfyUI engine is running. Preserve it and inspect its queue first.' }
$entries=@(Get-ChildItem -LiteralPath $source -Recurse -Force)
if (@($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Unexpected nested model link.' }
$files=@($entries | Where-Object { !$_.PSIsContainer })
$bytes=($files | Measure-Object Length -Sum).Sum
if ((Get-PSDrive D).Free -lt ($bytes+5GB)) { throw 'D: has insufficient room.' }
$record=@{ source=$source; target=$target; started=[DateTime]::UtcNow.ToString('o'); files=@(); bytes=$bytes; beforeCFree=(Get-PSDrive C).Free; status='copying' }
$journal='D:\Frameforge\desktop-model-migration.json'
& robocopy.exe $source $target /E /COPY:DAT /DCOPY:DAT /XJ /R:1 /W:1 /MT:8 /NFL /NDL /NP /NJH /NJS /LOG:D:\Frameforge\desktop-model-copy.log
if ($LASTEXITCODE -ge 8) { throw 'Model copy failed; C: originals retained.' }
foreach ($file in $files) {
    $relative=$file.FullName.Substring($source.Length+1)
    $destinationFile=Join-Path $target $relative
    if ((Get-Item -LiteralPath $destinationFile).Length -ne $file.Length) { throw ('Size mismatch: '+$relative) }
    $originalHash=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    $copiedHash=(Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash
    if ($originalHash -ne $copiedHash) { throw ('Checksum mismatch; originals retained: '+$relative) }
    $record.files+=@(@{file=$relative;bytes=$file.Length;sha256=$originalHash.ToLowerInvariant()})
    Write-Output ('Verified desktop model: '+$relative)
}
if (@(Get-ChildItem -LiteralPath $target -Recurse -File).Count -ne $files.Count) { throw 'Copied model count differs.' }
$record.status='copy-verified';$record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $journal -Encoding UTF8
if ((Get-Item -LiteralPath $source).FullName -ne 'C:\models' -or ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Source changed before switching.' }
Remove-Item -LiteralPath $source -Recurse -Force
New-Item -ItemType Junction -Path $source -Target $target | Out-Null
if ((Get-Item -LiteralPath $source).Target -ne $target) { throw 'Model compatibility link failed.' }
$record.status='linked';$record.finished=[DateTime]::UtcNow.ToString('o');$record.afterCFree=(Get-PSDrive C).Free
$record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $journal -Encoding UTF8
Write-Output ('Moved and SHA-256 verified '+$files.Count+' files / '+[math]::Round($bytes/1GB,2)+' GiB')
