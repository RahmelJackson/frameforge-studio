param([string]$Manifest,[string]$Output)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$narrationData=Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $speaker.SelectVoice($narrationData.request.voice)
    $speaker.SetOutputToWaveFile($Output)
    $speaker.Speak($narrationData.request.narration)
} finally { $speaker.Dispose() }
