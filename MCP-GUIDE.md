> **0.7.4:** Explore includes Civitai inspiration; Guide finds/chains workflows in the website and native MCP panel. Canvas Proof view shows actual changed pixels. Rough cut exports selected film clips without new generation. Video/audio ComfyUI return nodes and per-workflow download labels are included. Ten read-only MCP tools plus ten opt-in production tools. No paid generation is submitted automatically.

# Frameforge in Codex and Claude

Release **0.7.4** adds direct local LTX/H3/FLUX execution, reviewed model downloads, early dependency lists, per-assistant setup and a native ComfyUI image/video/audio bridge. See [the integration guide](INTEGRATION-UPGRADE.md) for tested profiles and remaining work.

Want a named plugin entry with an icon, starter prompts and setup guidance? [Install the Frameforge Studio plugin](PLUGIN-GUIDE.md). It bundles this same MCP server. Avoid keeping duplicate standalone and plugin Frameforge studio connections active. The separate ComfyUI engine connector is independent.

Use the website normally, or connect its **local STDIO MCP server** to an agent. Both use the same ComfyUI connection, saved jobs, graph compiler and review gates. No Frameforge account, hosted MCP endpoint or Cloud key is required. This is a source checkout, not a published npm package.

## Native visual studio · 0.7.4

The global entrypoint declares `header: { enabled: false }` to suppress the surrounding Codex title strip. This changes host presentation metadata, not the studio layout or the plugin’s name in the directory.

Calling `studio_workflows` advertises `ui://frameforge/studio-v6.html`. The host renders a self-contained native MCP Apps document with original artwork and a moving cover. **There is no nested website, loopback frame permission or browser redirect.** Every panel operation uses the host's MCP tool bridge. Older v2–v4 resource requests resolve to this native view too.

The panel includes explained image/video workflows, model download cards, connected graph nodes with editable settings and graph JSON, prepared local graph runs, video finishing, saved images and bounded video/audio playback, narration/transcription, film project creation, clip order/trims, composition saves and draft exports. Open weights only uses the same server enforcement as the website. Advanced audio/video requests and film layers use JSON controls; this is not every specialized website editor reproduced pixel-for-pixel. Personal imports stay inside the deliberately configured media folder. Cloud graphs can be downloaded for an external Comfy Cloud handoff; no paid submission or credentials are collected here.

`studio_media` transfers only fixed saved output routes, up to 12 MiB, for playback/transcript inspection. Larger files remain available in the normal website. Eight tools are read-only; 18 are available with local writes enabled. Opening the panel does not render or change the execution profile. Ambiguous creation retries reuse their request IDs, and film saves retain composition signatures.

The owner reported **content blocked** with the former 0.5 nested website. That implementation is superseded. The 0.6 native view is tested separately in a direct-document MCP bridge fixture; native Codex/Claude rendering still needs its own acceptance check after updating/restarting. Do not infer it from a browser preview. See [client acceptance](MCP-CLIENT-ACCEPTANCE.md). Run `node scripts/preview-mcp-ui.mjs` for the read-only fixture; add `--allow-writes` for creation controls. The fixture has no frames and explicitly labels itself as a test host.

## Install once

1. Clone this repository and install Node.js 22 or newer.
2. In the repository, run `npm start`, then visit http://127.0.0.1:4317/setup.
3. Connect your own running ComfyUI. Choose a recipe, install its listed nodes/models in ComfyUI and recheck readiness. Model files are downloaded separately under their own terms. The MCP server does not install them.
4. Image/video processing and speech also need the documented Python environments. See [setup](GITHUB-SETUP.md). A fresh source clone can browse graphs and prepare supported Cloud handoffs without having local generation ready.

## Connect Codex

Replace the example checkout path with your actual path. This enables local creation; omit `--allow-writes` for a read-only connection.

```sh
codex mcp add frameforge --env STUDIO_URL=http://127.0.0.1:4317 -- node C:/projects/frameforge-studio/scripts/frameforge-mcp.mjs --start-studio --allow-writes --open-weights-only
```

Or add to your Codex MCP configuration:

```toml
[mcp_servers.frameforge]
command = "node"
args = ["C:/projects/frameforge-studio/scripts/frameforge-mcp.mjs", "--start-studio", "--allow-writes", "--open-weights-only"]
env = { STUDIO_URL = "http://127.0.0.1:4317", FRAMEFORGE_IMPORT_ROOT = "C:/projects/my-film-inputs" }
```

## Connect Claude Code

```sh
claude mcp add --transport stdio frameforge -- node C:/projects/frameforge-studio/scripts/frameforge-mcp.mjs --start-studio --allow-writes --open-weights-only
```

For Claude Desktop, merge this entry into its existing MCP configuration, then restart the client:

```json
{
  "mcpServers": {
    "frameforge": {
      "command": "node",
      "args": ["C:/projects/frameforge-studio/scripts/frameforge-mcp.mjs", "--start-studio", "--allow-writes", "--open-weights-only"],
      "env": {
        "STUDIO_URL": "http://127.0.0.1:4317",
        "FRAMEFORGE_IMPORT_ROOT": "C:/projects/my-film-inputs"
      }
    }
  }
}
```

Use absolute paths and an import folder containing only media you authorize the agent to read. Without `FRAMEFORGE_IMPORT_ROOT`, imports are restricted to the client's working directory. Canonical path checks reject traversal and symlink escapes. Imports support PNG/JPEG/WebP, MP4/WebM and WAV, up to 100 MiB; the studio performs additional media validation. Files and previews go to the connected assistant, so use your client provider's privacy settings.

## Tools and creation loop

| Task | Tools |
| --- | --- |
| Discover and understand | `studio_workflows`, `workflow_requirements`, `comfy_status` |
| Inspect graphs and saved work | `studio_graph`, `studio_library`, `studio_job`, `studio_preview`, `studio_media` |
| Prepare and generate | `studio_import_asset`, `studio_prepare_workflow`, `studio_run_workflow`, `studio_generate` |
| Sound and production | `studio_audio`, `studio_project`, `studio_director` |
| Native editor and recovery | `studio_export_workflow`, `studio_cancel` |
| Execution profile | `studio_policy` (write enabled; changes the shared studio profile) |

The first eight are available by default. The other ten require `--allow-writes`; GPU rendering and local file creation can then happen at the assistant's request. Paid generation, shell execution, model installation, deleting assets and approving creative results are not exposed. Tool permission controls in your client still apply. Project/Director list and get operations share their write-enabled tool; use `studio_library` for read-only browsing.

Ask: **“Find an open-weight workflow for a cinematic product still. Explain the models and check my setup. Prepare the graph, show me what it will do, then make one preview and inspect the result.”**

1. Discover a recipe and check dependencies. Do not substitute a closed model silently.
2. Import an authorized source if needed. Use the returned filename/ID in the next tool.
3. Prepare a local plan, inspect its graph and input bindings. A prepared plan is not a completed render.
4. Run with a new UUID `requestId`. After a timeout, reuse that same ID and inspect saved jobs before retrying. Never invent a new ID just because a response was lost.
5. Poll `studio_job`. `studio_preview` returns a native image/audio block when small enough. Video previews are posters/contact sheets; watch the actual local video for motion quality.
6. Keep technical checks distinct from human creative approval. Film exports preserve the existing approval/signature gates.

Some advanced tools combine ComfyUI stages with local Python processing; those are explicitly described as processors. They are not falsely presented as one portable ComfyUI graph. Their complete pipelines use `studio_generate`/`studio_audio`, while `studio_export_workflow` exports supported graph stages and their inputs.

`--start-studio` starts the website backend only when no compatible studio is running. It never starts ComfyUI or downloads models. An owned backend stops when the MCP connection closes; an already-running studio is left alone. ComfyUI can continue a submitted render after disconnect. Restart the studio and inspect the same saved job; interrupted submissions become attention items instead of being blindly replayed. Start the website separately for long sessions.

`--open-weights-only` adds server-enforced restrictions to every request from this connection, even when the website is in ordinary mode. If it starts its own backend, that backend is locked to the strict profile. [Profile scope and limitations](OPEN-WEIGHTS.md).

Four MCP resources contain this guide, the profile specification, the submission checklist and the visual studio. The `make-with-frameforge` prompt supplies a discovery → inspect → generate → verify loop. The older `scripts/studio-mcp.mjs` remains a compatible read-only adapter.

Protocol: newline-delimited JSON-RPC over STDIO; diagnostics use stderr. Local HTTP origins only. MCP protocol/tool behavior is tested automatically; client screenshots are not evidence of a live Codex/Claude session unless explicitly recorded.

References: [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [MCP tool specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

## More agent and model choices

Ollama is optional. Setup and Studio guide now have local model-server presets and copy/download configuration for Antigravity, Hermes Agent, LM Studio and Claude Desktop. [Bring your own AI](ASSISTANT-CONNECTIONS.md) separates website-chat providers from MCP agent clients and records the tested scope.


### Native Codex origin fix — 0.5.1

The owner reported that 0.5.0 stopped at the opening screen with “Use exact embed origins only.” Static inspection of installed Codex 26.1007.2314.0 found its local sandbox URL factory: the codex-sandbox scheme with an mcp-app- subdomain containing a 48-character hexadecimal digest, under web-sandbox.oaiusercontent.com. That scheme was missing from the validator. Version 0.5.1 accepts only that precise scheme/host shape, with no custom port, in addition to the original supported origins. Paths, queries, credentials, wildcard hosts and other custom schemes remain rejected. A fresh v3 resource avoids the previous UI cache; v1 and v2 resource addresses still resolve. Tests cover native-origin registration; a successful native full-site render still needs confirmation.


### Superseded history: visible editor and link feedback — 0.5.2

The live Codex 0.5.1 panel passed origin registration and assigned its exact local iframe URL, which returned the complete studio with HTTP 200. The splash still covered it because the frame-ready message had not arrived. The resource now declares both standard and documented legacy frame permissions, restricted to the same exact loopback view, plus the local studio as the trusted external-link destination. This adds compatibility metadata; it does not disable client security.

After registration, the full editor is displayed immediately. A missing ready notification creates a small connection notice with a reload control rather than a full-screen cover. This does not certify a blocked or blank frame as successfully rendered. Browser-opening responses that contain isError or opened=false now surface a visible error and a real studio hyperlink instead of silent success.

The current v4 resource avoids old UI caches, with previous v1-v3 addresses retained. Regression tests cover a missing ready notification, untrusted sender messages, denied link results and exact permission aliases. Native nested-frame inspection was blocked by the browser automation URL policy; that action was not bypassed. Human confirmation of the complete editor remains required.


The 0.5.2 release passes all 175 regression tests and live ComfyUI readiness after restarting the existing engine. The owner's session was reconnected from the clean plugin-cache backend to the original configured studio and D-drive storage; the cache copy's files were preserved. No new render, download or creative approval was performed. Native nested-frame interaction remains unverified because the inspection tool rejected that action.


## Creative recipes (0.8.0)

Open **Video → Creative recipes** (`/recipes`) for performance variations, a product campaign, source-video shot planning or saved-motion remix. Save a subject and shared direction, inspect the actual workflows, then explicitly render a preview or sequential variations. Sources and seed choices are frozen in the saved plan. Use the original samples to try the interface without finding files first.

`studio_recipe_library` reads the same subjects, motions, plans and batch states; `capabilities: true` reports supported recipes and current readiness. `studio_recipe` provides opt-in save, prepare, frame extraction, Director handoff and sequential queue operations. The MCP connection still defaults to read-only. A queue requires a saved-plan signature and a request ID; reuse the request after an ambiguous result. No result is automatically creatively approved.

Canvas offers Qwen and installed FLUX 3 Image Klein. The FLUX masked graph crops the selection, generates the edit, resizes it to the crop and composites through the mask on the source grid. Native graph downloads include both image inputs and the mask. Proof measures actual changed pixels, not identity or visual quality.

The source-reference recipe uses real decoded frames and your shot notes. It does not automatically understand video. Character/performance and motion-transfer quality remain subject to review.
