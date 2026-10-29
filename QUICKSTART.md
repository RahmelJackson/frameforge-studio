# Quick start

1. Download and extract the **whole** source ZIP. Running a command from inside the ZIP will not work.
2. Windows: double-click **Start Frameforge.cmd**. macOS/Linux: open **Start Frameforge.command**, or run `sh 'Start Frameforge.command'`. On macOS a downloaded command may need right-click → Open. Native macOS/Linux acceptance remains open.
3. Choose your local ComfyUI, a new installation or external online creation. **Check my setup** explains what is ready, required or optional.

The launcher reuses Node.js 22+ or downloads a private checksum-verified runtime. It can take up to a minute for a freshly downloaded program to become ready. Keep the printed address if the browser does not open. If port 4317 is in use, the selected port is saved in ignored local settings.

## Choose only the dependencies you need

Browse and download graphs without Python or weights. For Studio uploads/checks, use **Install media tools** on Welcome. It installs isolated CPU helpers without touching ComfyUI's environment. Local generation needs a running ComfyUI and the selected recipe's models/nodes. Each workflow's download control lists existing and missing files and downloads only its missing requirements after your confirmation. Choose ComfyUI's models folder or export shared-folder registration; restart the idle engine to refresh its model list. No model is installed merely by opening a page.

Run `npm run doctor` for a report, or `npm run doctor -- --workflow wan-i2v` for local recipe requirements. Nothing is installed or rendered by these checks.

## Connect assistants and ComfyUI

Use **Settings → Use from Claude or Codex → Copy connection** first. It includes the actual Node executable and Studio address, even with a private runtime or another port. The marketplace plugin needs `node` on PATH and explicitly enables requested local creation. Raw MCP connections are read-only unless given `--allow-writes`. After a plugin update, reconnect or restart your client to load its new server.

The ComfyUI extension installer accepts a source folder containing main.py or a Desktop user folder containing custom_nodes. The downloadable extension ZIP is another option. After installation, restart an idle ComfyUI, press Frameforge's button for Quick tools, then switch to Full Studio if needed.

## Recovery

- **Extract the whole folder first:** do not run from inside the ZIP.
- **Browser did not open:** paste the local address printed by the launcher into your browser.
- **Engine offline:** start your own ComfyUI, then find/save its address in Settings.
- **Missing weights or nodes:** check that recipe's file list and official node instructions. Refresh/restart the idle engine after installation.
- **Gated model:** accept the original model terms in your own browser, then download the file or use your own local authenticated downloader. Never send a token in chat.
- **Online only:** Comfy Cloud/Civitai sign-in and spending remain in your own provider account.
- **Stop:** use Stop Frameforge.cmd or `node scripts/quickstart.mjs --stop`. Active media/setup jobs prevent stopping; ComfyUI is left alone.

See [detailed setup](GITHUB-SETUP.md), [MCP guide](MCP-GUIDE.md) and [remaining limits](REMAINING-CHECKLIST.md). Model weights, personal work and local settings are excluded from the public source.
