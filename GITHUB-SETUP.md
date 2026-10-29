# Frameforge on another computer

Frameforge is a local web interface over your own ComfyUI. The source includes workflow graphs and model download manifests, not a ComfyUI installation, model weights or the original user's saved work. No cloud service is required to browse it.

## Start the interface

The easiest route is [Quick start](QUICKSTART.md): extract the source ZIP and open **Start Frameforge.cmd** on Windows, or **Start Frameforge.command** on macOS/Linux. The launcher can fetch a checksum-verified private Node runtime. The welcome page offers existing ComfyUI, fresh ComfyUI installation and online-only paths. No GPU or weights are needed just to browse.

If you already have Node.js 22+, run `npm run quickstart`. `npm start` still serves the plain website. There are no npm dependencies to install.

For local media imports, previews and export checks, use **Install media tools** on the welcome page. This can fetch private Python 3.12 through a pinned uv helper and installs only the CPU media profile. Completion updates the running Studio immediately. The command-line alternative is `npm run setup:media`; restart a previously running Studio after an external installation. Extract Frameforge onto the drive where you want its runtime and saved work to live.

Choose a workflow, review the missing-model list, select the existing model directory your ComfyUI scans, accept its terms and download only that workflow’s required missing files. Installing CPU helpers does not download weights or GPU packages.

The website can browse workflows without a GPU. Generation still depends on the selected model, hardware and installed nodes. Setup checks names, not model hashes, GPU memory fit or creative quality. `workflows/models.json` includes SHA-256 values for manual verification. External model folders, including another drive, are configured inside ComfyUI, not copied into this repository.

## Four ways to begin

Home and Setup offer four choices: connect existing ComfyUI, install ComfyUI, use Comfy Cloud only, or prepare an image for Civitai. **Find running ComfyUI** checks the common local ports 8188 and 8000; select the detected address, then save it. It does not scan your network or change a connection automatically.

**Comfy Cloud without a local engine:** open **Create online** from Home, Setup or a creation tool. Text-only Seedream image, Seedance video and Seed Audio speech recipes embed your prompt in a downloadable graph without ComfyUI, Python or local weights. Reference-based recipes provide starter graphs; replace their example inputs and paste your prompt directly in Cloud. Native graphs are also offered, but require matching models/nodes in your Cloud environment. Import the JSON at https://cloud.comfy.org/, check availability and cost, and choose to run there. Opening a template link does not import your edited graph or upload inputs. There is no Cloud key store or paid submission in Frameforge.

**Civitai images:** choose Civitai in Create online, or use **Prepare this image prompt for Civitai** on an Explore example with a shared prompt. Copy the prompt or download its text brief; open https://civitai.com/generate, choose a generation-enabled model and review Buzz cost there. Original example and model links remain available. This is an external handoff, not a ComfyUI import or direct Civitai API integration; reproduction and model availability are not guaranteed. No media, tokens or paid requests are sent by this flow. Provider generation remains an account-side acceptance check.

**Local model downloads:** the four native starter graphs and prepared native graphs include ComfyUI's `properties.models` download metadata (filename, source URL and model subfolder). In the tested ComfyUI 0.22.3 frontend, import the JSON, click **View details** on the setup-error notice, then open **Issues → Missing Models**. Each missing file has its folder, **Copy URL**, **Download** and node-location controls, plus **Download all**. A CPU-only instance with empty model folders correctly listed all three Z-Image dependencies. No download or render was started. Setup still lists direct sources, file sizes, exact destinations and hashes. Review downloads in ComfyUI or your browser, then refresh model availability; installation behavior can vary between desktop and standalone editions.

**Additional tools:** native ComfyUI image/video graphs are portable. Some speech, segmentation, compositing and finishing tasks use separate Python processors. Their setup scripts/lock manifests are included, but the Python environments and model weights are not. Existing full-engine setup scripts are Windows-specific and can download large files; run only the setup you need. Use `npm start` for the lightweight interface, not the original machine's bundled-engine launcher.

## Model folders on your computer

Beside a workflow, open **Download missing files**, review its file list and choose **Change download folder**. Select the existing `models` directory that your ComfyUI scans. Frameforge saves this machine-only choice as `modelRoot` in ignored `config.local.json`. An engine URL alone cannot reveal its filesystem location. If you use another model folder, configure ComfyUI’s `extra_model_paths.yaml` too. Changing a download directory does not move existing files.

Only the selected workflow’s required missing files are downloaded. Existing verified files are reused. Gated models still require accepting the provider’s terms and, when necessary, a browser download. Optional Python processor setup is separate from model installation; it is not installed by the download button. Manifests use portable `models/` and `runtime/` locations. No D: drive is required.

The lightweight website and external handoffs work without a local GPU. Media imports and export checks need `npm run setup:media`. Advanced processor installers currently target Windows. On other systems, use native ComfyUI graphs with the required nodes and models, or external provider handoffs; do not assume every optional Python processor is supported.

## Optional local language model

No LLM is required. The built-in Guide finds tasks and suggests chains using the local catalog. To use a chat model, open **Settings → Guide & LLM**, choose Ollama, LM Studio, llama.cpp, vLLM or another local compatible server, connect to its API and select an available model. Start the server in that application first. Compatible APIs normally end in `/v1`; Ollama uses its server root. No model is selected or downloaded automatically.

Questions and recent chat context go to the selected local endpoint. A local server may itself proxy requests, so review its configuration. If authentication is enabled, set `FRAMEFORGE_ASSISTANT_API_KEY` in the Studio environment; do not put it in source or shared MCP configurations. External agents such as Claude, Codex, Hermes and Antigravity connect through MCP and keep their own model settings. They do not have to power the website’s chat.

Guided suggestions and LLM plans do not automatically render, approve, download or spend credits. Save and review each result before the next stage.

`npm run assistant:start` starts the installed Ollama service if it is not already running. It respects `OLLAMA_MODELS`, or an optional `ollamaModels` folder in your ignored `config.local.json`, so you can keep text models on another drive. It does not install or download a model. An already-running Ollama service keeps its own model directory. Text model weights stay outside the source archive; small models can still make poor suggestions.

## Optional MCP for an external agent

Run Frameforge, then register this stdio server in your MCP client (replace the absolute path):

```json
{
  "mcpServers": {
    "frameforge-studio": {
      "command": "node",
      "args": ["C:/path/to/frameforge/scripts/frameforge-mcp.mjs"],
      "env": {"STUDIO_URL": "http://127.0.0.1:4317"}
    }
  }
}
```

Discovery and inspection tools are read-only by default. Add `--allow-writes` for local graph preparation, media creation and saved projects. Add `--open-weights-only` to restrict this connection to the reviewed profile. `--start-studio` can launch the website backend, but never installs or launches ComfyUI. Full configurations, native-panel support and import permissions are in [MCP-GUIDE.md](MCP-GUIDE.md).

The website also has an **Open weights only** toggle. Use `npm run start:open` for a locked demonstration profile. [OPEN-WEIGHTS.md](OPEN-WEIGHTS.md) explains the exact included routes and distinction between open application code, downloadable weights and model licenses.

## Prepare a GitHub upload

Run `npm test`, then `npm run package:source`. The latter writes `dist/frameforge-source-<timestamp>.zip` and a SHA-256 inventory. It selects source roots explicitly, refuses symlinks/junctions and unreviewed public media, checks source sizes and credential patterns, and excludes private data, models, environments, logs, evidence, backups, local configuration and Git history. This pattern scan is a practical check, not a complete secret audit.

The archive is the easiest clean starting point: extract it into a new folder, review the manifest and initialize a new Git repository there. Do not publish the original working directory or its old Git history blindly. Keep the development checkout separate from the clean publishing checkout. The source release preserves file bytes across Git clones so its manifest hashes remain meaningful.

Public repository: **[RahmelJackson/frameforge-studio](https://github.com/RahmelJackson/frameforge-studio)**. The owner explicitly selected public visibility for the open-source Higgsfield-inspired submission. Upload a clean source snapshot from the archive rather than the original working checkout or its history. Keep model weights, local settings, generated media and credentials outside the repository.

The original studio code is licensed under **MIT**; the root `LICENSE` and package metadata are included in the source archive. Third-party files, templates, models and services keep their own terms; see THIRD-PARTY-NOTICES.md and the bundled notices. This does not relicense ComfyUI, its frontend, optional tools or weights. No model files belong in Git or Git LFS for this source distribution.

The server binds to loopback and validates Host/Origin. It is intended for a local personal studio. Do not expose it to a public network without adding authentication and a deployment security review.

References: https://docs.ollama.com/api/chat · https://docs.ollama.com/api/tags · https://modelcontextprotocol.io/specification/2025-06-18/basic/transports · https://docs.comfy.org/installation/desktop/windows
