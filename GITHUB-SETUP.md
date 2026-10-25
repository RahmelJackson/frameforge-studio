# Frameforge on another computer

Frameforge is a local web interface over your own ComfyUI. The source includes workflow graphs and model download manifests, not a ComfyUI installation, model weights or the original user's saved work. No cloud service is required to browse it.

## Start the interface

1. Install Node.js 22 or newer from https://nodejs.org/en/download.
2. Download/extract the source, or clone your published repository.
3. In the Frameforge folder run `npm start`. There are no npm dependencies to install.
4. Open http://127.0.0.1:4317 and choose **Setup & models**.
5. Install/start ComfyUI from https://www.comfy.org/download, or connect your existing local installation. Enter its local address in Setup. Common ports are 8188 and 8000; use the address of your actual installation.
6. To upload and verify images/video **inside the studio**, install Python 3.12 and run `npm run setup:media`, then restart the studio. This adds only PyAV, NumPy and Pillow; it does not install ComfyUI, Torch or model weights. For another drive set `STUDIO_MEDIA_ENV` to the desired environment folder before running it. Graph downloads and external native-editor/Cloud handoffs work without this helper environment.
7. Select a workflow. Setup reports the model names and node types advertised by that ComfyUI. Download missing files from the provided sources, read their terms, place them in the listed folders, refresh/restart ComfyUI and check again.

The website can browse workflows without a GPU. Generation still depends on the selected model, hardware and installed nodes. Setup checks names, not model hashes, GPU memory fit or creative quality. `workflows/models.json` includes SHA-256 values for manual verification. External model folders, including another drive, are configured inside ComfyUI, not copied into this repository.

## Four ways to begin

Home and Setup offer four choices: connect existing ComfyUI, install ComfyUI, use Comfy Cloud only, or prepare an image for Civitai. **Find running ComfyUI** checks the common local ports 8188 and 8000; select the detected address, then save it. It does not scan your network or change a connection automatically.

**Comfy Cloud without a local engine:** open **Create online** from Home, Setup or a creation tool. Text-only Seedream image, Seedance video and Seed Audio speech recipes embed your prompt in a downloadable graph without ComfyUI, Python or local weights. Reference-based recipes provide starter graphs; replace their example inputs and paste your prompt directly in Cloud. Native graphs are also offered, but require matching models/nodes in your Cloud environment. Import the JSON at https://cloud.comfy.org/, check availability and cost, and choose to run there. Opening a template link does not import your edited graph or upload inputs. There is no Cloud key store or paid submission in Frameforge.

**Civitai images:** choose Civitai in Create online, or use **Prepare this image prompt for Civitai** on an Explore example with a shared prompt. Copy the prompt or download its text brief; open https://civitai.com/generate, choose a generation-enabled model and review Buzz cost there. Original example and model links remain available. This is an external handoff, not a ComfyUI import or direct Civitai API integration; reproduction and model availability are not guaranteed. No media, tokens or paid requests are sent by this flow. Provider generation remains an account-side acceptance check.

**Local model downloads:** the four native starter graphs and prepared native graphs include ComfyUI's `properties.models` download metadata (filename, source URL and model subfolder). In the tested ComfyUI 0.22.3 frontend, import the JSON, click **View details** on the setup-error notice, then open **Issues → Missing Models**. Each missing file has its folder, **Copy URL**, **Download** and node-location controls, plus **Download all**. A CPU-only instance with empty model folders correctly listed all three Z-Image dependencies. No download or render was started. Setup still lists direct sources, file sizes, exact destinations and hashes. Review downloads in ComfyUI or your browser, then refresh model availability; installation behavior can vary between desktop and standalone editions.

**Additional tools:** native ComfyUI image/video graphs are portable. Some speech, segmentation, compositing and finishing tasks use separate Python processors. Their setup scripts/lock manifests are included, but the Python environments and model weights are not. Existing full-engine setup scripts are Windows-specific and can download large files; run only the setup you need. Use `npm start` for the lightweight interface, not the original machine's bundled-engine launcher.

## Optional local language model

Install/start Ollama (https://ollama.com/download) and install a local chat model in it. Open **Studio guide → Local AI & connections → Refresh models**, then select it. No LLM is selected automatically. Questions, up to four recent messages and a catalog/status snapshot go only to `127.0.0.1:11434`. Chat is kept in page memory and clears on reload. CPU inference and `keep_alive: 0` avoid retaining GPU memory needed by ComfyUI. Cloud-tagged/remote Ollama models are refused. CPU answers may be slow; model size/quality vary.

Without Ollama, guided catalog matching remains available and is clearly labeled. This is not an LLM response. Suggested chains are navigation plans: save/review each result and bring it to the next tool. They do not automatically render, approve, download or spend credits.

`npm run assistant:start` starts the installed Ollama service if it is not already running. It respects `OLLAMA_MODELS`, or an optional `ollamaModels` folder in your ignored `config.local.json`, so you can keep text models on another drive. It does not install or download a model. An already-running Ollama service keeps its own model directory. This machine's tested Qwen3 4B model is about 2.5 GB and is stored on D:, outside the source archive; small models can still make poor suggestions.

## Optional MCP for an external agent

Run Frameforge, then register this stdio server in your MCP client (replace the absolute path):

```json
{
  "mcpServers": {
    "frameforge-studio": {
      "command": "node",
      "args": ["C:/path/to/frameforge/scripts/studio-mcp.mjs"],
      "env": {"STUDIO_URL": "http://127.0.0.1:4317"}
    }
  }
}
```

Tools: `studio_workflows`, `comfy_status`, `workflow_requirements`. All are read-only and use the same bounded tool layer as the in-app guide. No shell execution, generation, arbitrary URLs, model installation or paid calls. A separate ComfyUI MCP can be registered in your external agent for generation; it is not silently inherited by the website. Existing Codex/ChatGPT MCP connections are owned by their host application.

## Expanded MCP and open-weight profile

The three-tool adapter above remains compatible. For graph preparation, generation, native previews, speech and production tools, register `scripts/frameforge-mcp.mjs`. It defaults to seven read-only tools. Add `--allow-writes` for the nine local creation tools and `--open-weights-only` to restrict this connection. `--start-studio` can launch the website backend, but never installs or launches ComfyUI. Full Codex/Claude configurations, import permissions and recovery behavior are in [MCP-GUIDE.md](MCP-GUIDE.md).

The website also has an **Open weights only** toggle. Use `npm run start:open` for a locked demonstration profile. [OPEN-WEIGHTS.md](OPEN-WEIGHTS.md) explains the exact included routes and distinction between open application code, downloadable weights and model licenses.

## Prepare a GitHub upload

Run `npm test`, then `npm run package:source`. The latter writes `dist/frameforge-source-<timestamp>.zip` and a SHA-256 inventory. It selects source roots explicitly, refuses symlinks/junctions and unreviewed public media, checks source sizes and credential patterns, and excludes private data, models, environments, logs, evidence, backups, local configuration and Git history. This pattern scan is a practical check, not a complete secret audit.

The archive is the easiest clean starting point: extract it into a new folder, review the manifest and initialize a new Git repository there. Do not publish the original working directory or its old Git history blindly. Keep the development checkout separate from the clean publishing checkout. The source release preserves file bytes across Git clones so its manifest hashes remain meaningful.

Public repository: **[RahmelJackson/frameforge-studio](https://github.com/RahmelJackson/frameforge-studio)**. The owner explicitly selected public visibility for the open-source Higgsfield-inspired submission. Upload a clean source snapshot from the archive rather than the original working checkout or its history. Keep model weights, local settings, generated media and credentials outside the repository.

The original studio code is licensed under **MIT**; the root `LICENSE` and package metadata are included in the source archive. Third-party files, templates, models and services keep their own terms; see THIRD-PARTY-NOTICES.md and the bundled notices. This does not relicense ComfyUI, its frontend, optional tools or weights. No model files belong in Git or Git LFS for this source distribution.

The server binds to loopback and validates Host/Origin. It is intended for a local personal studio. Do not expose it to a public network without adding authentication and a deployment security review.

References: https://docs.ollama.com/api/chat · https://docs.ollama.com/api/tags · https://modelcontextprotocol.io/specification/2025-06-18/basic/transports · https://docs.comfy.org/installation/desktop/windows
