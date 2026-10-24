param([string]$BasePython)
$ErrorActionPreference='Stop'
$studioRoot=Split-Path -Parent $PSScriptRoot
if (!$BasePython) { $BasePython=(Get-Content (Join-Path $studioRoot 'config.local.json') | ConvertFrom-Json).python }
$mcpEnvironment=Join-Path $studioRoot 'runtime/mcp-env'
& $BasePython -m venv $mcpEnvironment
if ($LASTEXITCODE -ne 0) { throw 'Could not create the MCP tooling environment.' }
$mcpPython=Join-Path $mcpEnvironment 'Scripts/python.exe'
& $mcpPython -m pip install -r (Join-Path $studioRoot 'setup/requirements-mcp.lock.txt') --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { throw 'MCP dependency installation failed.' }
$mcpExecutable=Join-Path $mcpEnvironment 'Scripts/comfy-mcp.exe'
$comfyExecutable=Join-Path $mcpEnvironment 'Scripts/comfy.exe'
& codex mcp add frameforge-comfy --env "COMFY_BIN=$comfyExecutable" --env 'COMFYUI_URL=http://127.0.0.1:8188' --env "COMFY_PROJECT=$studioRoot" --env 'DO_NOT_TRACK=1' --env 'PYTHONUTF8=1' -- $mcpExecutable
if ($LASTEXITCODE -ne 0) { throw 'Codex MCP registration failed.' }
$env:FRAMEFORGE_CONFIG_FILE=Join-Path $env:USERPROFILE '.codex/config.toml'
@"
import os
from pathlib import Path
import tomlkit
p=Path(os.environ['FRAMEFORGE_CONFIG_FILE'])
d=tomlkit.parse(p.read_text(encoding='utf-8'))
server=d['mcp_servers']['frameforge-comfy']
server['enabled_tools']=['server_info','system_stats','nodes','validate_workflow','run_workflow','job','fetch_outputs']
server['startup_timeout_sec']=30
server['tool_timeout_sec']=90
p.write_text(tomlkit.dumps(d),encoding='utf-8')
"@ | & $mcpPython -
if ($LASTEXITCODE -ne 0) { throw 'Could not apply the local tool selection.' }
Write-Output 'Local ComfyUI MCP registered. Reload the client connection to expose its seven selected tools.'
