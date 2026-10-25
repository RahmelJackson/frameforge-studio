# Frameforge in Codex and Claude

Want a named plugin entry with an icon, starter prompts and setup guidance? [Install the Frameforge Studio plugin](PLUGIN-GUIDE.md). It bundles this same MCP server. Avoid keeping duplicate standalone and plugin Frameforge studio connections active. The separate ComfyUI engine connector is independent.

Use the website normally, or connect its **local STDIO MCP server** to an agent. Both use the same ComfyUI connection, saved jobs, graph compiler and review gates. No Frameforge account, hosted MCP endpoint or Cloud key is required. This is a source checkout, not a published npm package.

## A visual studio in compatible MCP hosts

Calling `studio_workflows` also advertises `ui://frameforge/studio-v1.html`, an MCP Apps resource. It uses Frameforge's charcoal/lime branding, workspace tabs, explained recipe cards, graph inspection and setup checks. With creation enabled it can prepare/run native local image/video graphs and display checked images. The open-weight profile toggle uses the same server policy. Films and Audio link to the complete website editors and expose saved work; the panel does not reproduce every editor inside a chat.

The panel now embeds the same original concept imagery as the website, uses picture recipe cards, and provides a Saved results workspace that requests actual image/video-poster previews through MCP. Concept artwork is explicitly labeled and never presented as a graph result. Embedded art needs no external image domains.

MCP Apps rendering depends on the client. The ordinary tools and local website links work without it. Claude Desktop 3.6556.2 has now rendered the actual local STDIO panel and returned the native image preview. Recipe search and detail interaction were exercised in the client. Codex visual rendering and other Claude versions remain separate acceptance checks. See [the client acceptance record](MCP-CLIENT-ACCEPTANCE.md). `node scripts/preview-mcp-ui.mjs` runs a read-only local test host on port 4390. Add `--allow-writes` only when testing local creation. `/mcp-app` on the website is a labeled, read-only browser preview, not a live assistant session.

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
| Inspect graphs and saved work | `studio_graph`, `studio_library`, `studio_job`, `studio_preview` |
| Prepare and generate | `studio_import_asset`, `studio_prepare_workflow`, `studio_run_workflow`, `studio_generate` |
| Sound and production | `studio_audio`, `studio_project`, `studio_director` |
| Native editor and recovery | `studio_export_workflow`, `studio_cancel` |
| Execution profile | `studio_policy` (write enabled; changes the shared studio profile) |

The first seven are available by default. The other ten require `--allow-writes`; GPU rendering and local file creation can then happen at the assistant's request. Paid generation, shell execution, model installation, deleting assets and approving creative results are not exposed. Tool permission controls in your client still apply. Project/Director list and get operations share their write-enabled tool; use `studio_library` for read-only browsing.

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
