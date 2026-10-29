# Start creating with Frameforge

Download the source ZIP from [GitHub](https://github.com/RahmelJackson/frameforge-studio/archive/refs/heads/main.zip) and extract the entire folder somewhere you can write to. Keep this folder: your personal settings, runtime and saved work stay with it. Choose a drive with space for your projects; model downloads remain a separate per-workflow choice.

## Windows

Double-click **Start Frameforge.cmd**. A suitable Node.js installation is reused. Otherwise the launcher downloads the pinned, checksum-verified private Node runtime into `runtime/bootstrap`. No administrator access or global Node installation is required. It starts the local Studio and opens the guided welcome page. Choose Open my Studio when ready. Later launches open the Studio directly; guided setup remains available from Get set up.

**Stop Frameforge.cmd** closes only the idle Studio started by this folder. It refuses while a generation or software setup is active and never stops ComfyUI.

Corporate security policies may block unsigned scripts or downloaded applications. Follow your organization's policy; the manual route is `npm run quickstart` with Node.js 22+ already installed. The launcher changes no persistent execution policy.

## macOS and Linux

Open **Start Frameforge.command**, or run `sh 'Start Frameforge.command'` from the extracted folder if executable permissions were not preserved. The launcher reuses Node.js 22+ or downloads the pinned official runtime for x64/arm64. It needs curl, tar and shasum/sha256sum, normally available on these systems. It does not use sudo or install global packages. These launchers need native-platform acceptance; Windows is the locally tested system.

With Node already available, `npm run quickstart` works on all supported platforms. `node scripts/quickstart.mjs --no-browser` prints the address; `node scripts/quickstart.mjs --stop` closes this launcher's idle Studio. If its preferred port belongs to another application, the launcher finds another free port.

## Choose your path

1. **Already use ComfyUI:** start it, choose **I have ComfyUI**, find the running engine and connect. Existing weights stay in place. Beside your selected workflow, check the model list and choose its visible install location: your ComfyUI models folder or a shared folder. Shared folders include a configuration download to merge into ComfyUI; Comfy Desktop can add them through Storage settings. Download only the workflow’s missing files, then refresh or restart ComfyUI when needed.
2. **Starting fresh:** choose **I'm starting fresh** and follow the official Comfy Desktop installer for your system. It provisions the engine and GPU dependencies. Frameforge does not silently install CUDA, drivers, Torch or model weights.
3. **Online only:** choose **I'll create online**. No local ComfyUI, Python, GPU or weights are needed to browse and prepare supported online handoffs. Sign in and approve any paid generation on Comfy Cloud or Civitai itself.

## Optional media helpers

Choose **Install media tools** on the welcome page. This installs the pinned CPU packages for uploads, previews and export checks. If needed, a pinned uv helper fetches a managed Python 3.12 from Astral's python-build-standalone distribution into this folder. Your ComfyUI environment is preserved. Progress and errors remain visible; retrying does not download any models. A completed in-app installation updates Studio immediately.

The additional vision profile is optional and has its own isolated environment. These CPU installers have Windows/macOS/Linux paths, but dependency wheel availability can vary. Advanced GPU speech, lip-sync, style and other processors still have their separate platform/hardware requirements. The quick installer is not a claim that all processors run everywhere.

Command-line alternative: `npm run setup:media`, or `node scripts/setup-processor.mjs vision --managed --install`. Restart a previously running Studio if installation was done outside its welcome page.

## Connect another interface

- **Claude, Codex, Hermes, Antigravity or LM Studio:** select your client on the welcome page and copy the connection for this actual folder and port. Enable local creation only if wanted. Merge it into the client's MCP settings and reconnect there. Visual-panel support depends on the client. An already-running client can retain its previous plugin until it reloads.
- **ComfyUI:** download the extension from the welcome page, unzip it into the active `custom_nodes` folder and restart ComfyUI when idle. Quick tools opens a selected workflow beside the native graph. Full Studio is one button away.
- **Cloud/Civitai:** no provider secrets are stored. Official templates and prepared graphs/prompts use external handoffs. Custom Comfy Cloud App Mode links must be published using the owner's Cloud account; opening a local JSON does not publish it.

## What is downloaded

The website has no npm dependencies. Only a missing Node runtime is fetched at first launch. Python/uv and CPU packages require the separate install button or explicit setup command. Weights require their workflow-specific download review and terms. All generated media, runtimes, models, personal configuration and provider credentials remain excluded from the source release.

Sources: [Node runtime archives](https://nodejs.org/download/release/), [managed Python](https://docs.astral.sh/uv/guides/install-python/), [official Comfy Desktop](https://github.com/Comfy-Org/Comfy-Desktop#download), [Comfy Cloud App Mode](https://github.com/Comfy-Org/docs/blob/main/interface/app-mode.mdx).
