# Use Frameforge from your assistant

Frameforge 0.8.13 provides a local STDIO MCP server and a visual MCP Apps panel. It uses the same task catalog, model requirements, graphs and saved productions as your Studio. It does not require Ollama, a paid Cloud key or a second copy of the model weights.

## Recommended connection

1. Start Frameforge normally with **Start Frameforge.cmd** or the macOS/Linux launcher.
2. Open **Settings → Use from Claude or Codex** and choose your assistant.
3. Click **Copy connection** and follow that client's local MCP configuration instructions.

The copied configuration uses the running Studio's exact address and Node executable, including a private launcher runtime or a port other than 4317. Restart or reconnect the client after editing its configuration. Do not paste keys or passwords in chat.

The optional marketplace plugin uses `node` from PATH. Its configuration explicitly includes `--allow-writes`, so requested local creation works with the host's normal tool approvals. Without an explicit `STUDIO_URL`, startup reads its installation's `config.local.json` port. A plugin cache and a separate source download are different installations; use the copied connection to select the Studio holding your work.

## Permissions

The raw server is **read-only by default**. Add `--allow-writes` only to enable local production tools. The bundled marketplace plugin includes that flag deliberately. Read-only tool access and write-enabled plugin behavior are different configurations, rather than an implicit permission change.

| Read-only tools | Purpose |
| --- | --- |
| `studio_workflows`, `studio_recipe_library` | Find explained tasks, recipes and capabilities |
| `comfy_status`, `workflow_requirements` | Check engine, node and model availability |
| `studio_explore`, `studio_guide` | Browse credited inspiration and get workflow guidance |
| `studio_graph`, `studio_library` | Inspect graphs and saved work |
| `studio_job`, `studio_preview`, `studio_media` | Poll and inspect bounded saved results |

| Additional tools with `--allow-writes` | Purpose |
| --- | --- |
| `studio_prepare_workflow`, `studio_run_workflow` | Prepare an editable graph, then explicitly run a supported adapter |
| `studio_generate`, `studio_audio` | Create local images/video or audio |
| `studio_import_asset`, `studio_export_workflow` | Import authorized media and export graph packages |
| `studio_project`, `studio_director`, `studio_recipe` | Save film plans, selected clips and recipe stages |
| `studio_cancel`, `studio_policy` | Cancel a known job or change the Studio execution profile |

There are **11 read-only tools and 11 additional production tools**. A native graph marked **Open in ComfyUI** needs the native editor; the generic run tool does not pretend to execute every imported graph. Model-name checks do not guarantee hardware fit or creative quality.

No tool provides shell execution, automatic model installation, paid submission or creative approval. Production calls can create files and use your GPU. Client permissions still apply, and local assistants share the selected Studio's saved work and engine. This is a personal local integration, not a public multi-user endpoint.

## Visual panel

Ask **“Open Frameforge Studio and show the visual workflow library.”** A supported MCP Apps client can open a self-contained panel with Explore, Images, Video, Audio, Library and Advanced, original artwork and motion, explained tasks, graph controls and saved results. The current UI resource is `ui://frameforge/studio-v13.html`; earlier resource addresses remain compatible.

The panel uses MCP tool calls, with no nested website, loopback frame exception or browser redirect required for supported operations. Some advanced audio/video and film settings use JSON controls instead of every specialized website editor. The host controls whether the panel appears inline, full-screen or in a plugin page. Clients without MCP Apps still get the text tools.

After updating, close the old panel and reconnect the plugin/server. The new server and resource version do not replace code already running in an old panel. A browser bridge fixture checks protocol behavior; it is not evidence that a specific Codex/Claude version rendered the panel. See [client acceptance](MCP-CLIENT-ACCEPTANCE.md).

## A reliable creation loop

1. Describe the result and ask `studio_workflows` for the right recipe.
2. Check `comfy_status` and `workflow_requirements`. Review missing files and their terms beside that workflow.
3. With writes enabled, import only media the user authorized, prepare the graph and inspect its inputs/settings.
4. Run deliberately with a fresh UUID `requestId`. Reuse it after an ambiguous response to avoid duplicate submissions.
5. Poll `studio_job`, then inspect the preview/report. Distinguish technical completion from visual quality; leave creative approval to the user.

Saved film edits retain composition signatures. A recipe queue requires a saved-plan signature and a request ID. Media inspection accepts fixed saved-output routes, not arbitrary network/file URLs; larger media stays available in Studio. Open-weights connections enforce their reviewed execution profile server-side.

## Your own LLM is optional

Guide works through catalog matching without a model. For LLM-backed planning, connect a supported local chat endpoint in Settings. Existing compatible Ollama, LM Studio or other endpoints can be used without downloading a new LLM. Claude/Codex MCP and website chat endpoints are separate integrations; a desktop agent is not automatically an HTTP inference server. [Connection details](ASSISTANT-CONNECTIONS.md).

## Troubleshooting

- **Node not found:** prefer Copy connection, which includes the private runtime's full path, or install Node 22+ for the marketplace route.
- **Wrong or empty library:** point the client at the running Studio you intend to use with its copied address. Separate installations keep separate data.
- **Missing nodes/models:** open that workflow's requirements and resolve them in your own ComfyUI. A model visible in another folder must be registered in ComfyUI.
- **Old visual panel:** reconnect the server and reopen the panel after installing the update.
- **Read-only controls:** the connection omitted `--allow-writes`, or the client's permissions deny production tools.
- **Online generation:** Comfy Cloud/Civitai account sign-in, inputs and costs remain on their external websites.

[Quick start](QUICKSTART.md) · [Plugin guide](PLUGIN-GUIDE.md) · [Open weights](OPEN-WEIGHTS.md) · [Remaining checklist](REMAINING-CHECKLIST.md)
