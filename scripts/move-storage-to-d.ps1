param([string]$Destination = 'D:\Frameforge\storybuilder',[switch]$Resume)
$ErrorActionPreference = 'Stop'
$studioRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$storageRoot = [IO.Path]::GetFullPath($Destination).TrimEnd('\')
if ($storageRoot -ne 'D:\Frameforge\storybuilder' -or $studioRoot -notlike '*\g-p-6acb2da1b1d881919c10e8c5a417d67a\frameforge') { throw 'Unexpected migration roots.' }
if ((Get-Item -LiteralPath $studioRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Studio source must be a real directory.' }
$components = @('backups','runtime','data','evidence')
$journalPath=Join-Path $storageRoot 'migration.json'
$savedJournal=$null
if ($Resume) {
    $savedJournal=Get-Content -LiteralPath $journalPath -Raw | ConvertFrom-Json
    if ($savedJournal.source -ne $studioRoot -or $savedJournal.destination -ne $storageRoot) { throw 'Recovery journal belongs to different roots.' }
    if ($savedJournal.finished) { throw 'This move is already complete. Keep its links and use the studio launcher.' }
}
$requiredBytes = 0L
foreach ($name in $components) {
    $source = Join-Path $studioRoot $name
    $target = Join-Path $storageRoot $name
    if ((Test-Path -LiteralPath $target) -and !$Resume) { throw ('Destination already exists; inspect saved migration before resuming: '+$target) }
    $sourceItem = Get-Item -LiteralPath $source
    if ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        if ($Resume -and $sourceItem.Target -eq $target -and @($savedJournal.components | Where-Object { $_.name -eq $name -and $_.status -eq 'linked' }).Count -eq 1) { continue }
        throw ('Unexpected linked source: '+$source)
    }
    $requiredBytes += (Get-ChildItem -LiteralPath $source -Recurse -File | Measure-Object -Property Length -Sum).Sum
}
if ((Get-PSDrive D).Free -lt ($requiredBytes + 5GB)) { throw 'Insufficient D-drive space including a 5 GB margin.' }
$base='http://127.0.0.1:4317'
if (!$Resume -or @(Get-NetTCPConnection -State Listen -LocalPort 4317,8188 -ErrorAction SilentlyContinue).Count) {
    $active = @((Invoke-RestMethod ($base+'/api/audio-jobs')) + (Invoke-RestMethod ($base+'/api/jobs')) | Where-Object { $_.status -in @('processing','uploading','submitting','submitted','running','cancelling','verifying') })
    $engineQueue=Invoke-RestMethod 'http://127.0.0.1:8188/queue'
    if ($active.Count -or $engineQueue.queue_running.Count -or $engineQueue.queue_pending.Count) { throw 'Active work exists. Do not interrupt it.' }
}
$owned = @(Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq 'node.exe' -and $_.CommandLine -like ('*"'+(Join-Path $studioRoot 'server.mjs')+'"*')) -or
    ($_.Name -eq 'python.exe' -and ($_.CommandLine -like ('*'+(Join-Path $studioRoot 'runtime\comfy-engine-cc57e6f47d9e\main.py')+'*') -or $_.CommandLine -like ('*'+(Join-Path $studioRoot 'runtime\mcp-env\Scripts\comfy-mcp.exe')+'*')))
})
$before = @{ CFree=(Get-PSDrive C).Free; DFree=(Get-PSDrive D).Free }
New-Item -ItemType Directory -Path $storageRoot -Force | Out-Null
$journal=@{ started=[DateTime]::UtcNow.ToString('o'); source=$studioRoot; destination=$storageRoot; before=$before; components=@(); stoppedProcesses=@($owned | Select-Object ProcessId,Name) }
if ($savedJournal) { foreach ($property in $savedJournal.PSObject.Properties) { $journal[$property.Name]=$property.Value }; $journal.resumed=[DateTime]::UtcNow.ToString('o') }
function Save-Journal { $journal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $journalPath -Encoding UTF8 }
Save-Journal
foreach ($ownedProcess in $owned) { Stop-Process -Id $ownedProcess.ProcessId -ErrorAction SilentlyContinue }
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;
public static class StorageCopyCheck {
  public static long[] Verify(string source, string target, string manifest) {
    long count=0,bytes=0;
    foreach(string path in Directory.EnumerateFileSystemEntries(source,"*",SearchOption.AllDirectories))
      if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0) throw new IOException("Unexpected link in source: "+path);
    object gate=new object();
    using(var writer=new StreamWriter(manifest,false,new System.Text.UTF8Encoding(false))) {
      Parallel.ForEach(Directory.GetFiles(source,"*",SearchOption.AllDirectories),new ParallelOptions{MaxDegreeOfParallelism=8},path=> {
        string relative=path.Substring(source.Length+1),dest=Path.Combine(target,relative);
        var a=new FileInfo(path);var b=new FileInfo(dest);
        if(!b.Exists||a.Length!=b.Length)throw new IOException("Copy size mismatch: "+relative);
        byte[] ha,hb;
        using(var sha=SHA256.Create())using(var stream=File.OpenRead(path))ha=sha.ComputeHash(stream);
        using(var sha=SHA256.Create())using(var stream=File.OpenRead(dest))hb=sha.ComputeHash(stream);
        string hash=BitConverter.ToString(ha).Replace("-","").ToLowerInvariant();
        if(hash!=BitConverter.ToString(hb).Replace("-","").ToLowerInvariant())throw new IOException("Copy checksum mismatch: "+relative);
        lock(gate){writer.WriteLine(hash+"\t"+a.Length+"\t"+relative);count++;bytes+=a.Length;}
      });
    }
    long targetCount=0;foreach(string path in Directory.EnumerateFiles(target,"*",SearchOption.AllDirectories))targetCount++;
    if(targetCount!=count)throw new IOException("Copy file-count mismatch");
    return new long[]{count,bytes};
  }
}
'@
foreach ($name in $components) {
    $source=[IO.Path]::GetFullPath((Join-Path $studioRoot $name))
    $target=[IO.Path]::GetFullPath((Join-Path $storageRoot $name))
    if ((Split-Path -Parent $source) -ne $studioRoot -or (Split-Path -Parent $target) -ne $storageRoot -or $name -notin $components) { throw 'Component escaped the intended roots.' }
    if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) { Write-Output ('Previously verified link retained: '+$name); continue }
    Write-Output ('Copying '+$name+' to '+$target)
    & robocopy.exe $source $target /E /COPY:DAT /DCOPY:DAT /XJ /R:1 /W:1 /MT:8 /NFL /NDL /NP /NJH /NJS ('/LOG:'+(Join-Path $storageRoot ($name+'-copy.log')))
    if ($LASTEXITCODE -ge 8) { throw ('Copy failed; original retained: '+$source) }
    Write-Output ('Checking every '+$name+' file against its original')
    $measured=[StorageCopyCheck]::Verify($source,$target,(Join-Path $storageRoot ($name+'-sha256.tsv')))
    $entry=@{ name=$name; source=$source; target=$target; files=$measured[0]; bytes=$measured[1]; verified=[DateTime]::UtcNow.ToString('o'); status='copy-verified' }
    $journal.components+=@($entry);Save-Journal
    # Only the exact allowlisted source can be removed, after the complete destination passed SHA-256 verification.
    if ((Get-Item -LiteralPath $source).FullName -ne $source -or ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Source changed before switch.' }
    Remove-Item -LiteralPath $source -Recurse -Force
    New-Item -ItemType Junction -Path $source -Target $target | Out-Null
    if ((Get-Item -LiteralPath $source).Target -ne $target) { throw 'Compatibility link did not resolve to verified destination.' }
    $entry.status='linked';Save-Journal
    Write-Output ('Verified and linked '+$name+': '+[math]::Round($measured[1]/1GB,2)+' GiB')
}
$journal.finished=[DateTime]::UtcNow.ToString('o');$journal.after=@{ CFree=(Get-PSDrive C).Free; DFree=(Get-PSDrive D).Free };Save-Journal
Write-Output ($journal | ConvertTo-Json -Depth 8)
