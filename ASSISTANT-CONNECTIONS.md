# Bring your own AI

**Ollama is optional.** Frameforge has two independent connection paths. Neither requires downloading another model if you already have a suitable model or agent.

## Power the website guide

Open **Setup & models → Use the AI you already have**, or **Studio guide → AI & agent connections**.

1. Start the API server in your preferred model application.
2. Choose its preset, or enter its actual local address. **Find running servers** checks only the standard local model-list endpoints; it does not install, load or generate anything.
3. Choose **Connect & list models**.
4. In Studio guide, choose **Answer with** and select a chat/instruct model advertised by that server. Ask your question.

| Server | Default API address | Protocol |
| --- | --- | --- |
| Ollama | `http://127.0.0.1:11434` | Native Ollama |
| LM Studio | `http://127.0.0.1:1234/v1` | Compatible models + chat completions |
| llama.cpp | `http://127.0.0.1:8080/v1` | Compatible models + chat completions |
| vLLM | `http://127.0.0.1:8000/v1` | Compatible models + chat completions |
| Other local compatible server | Your loopback address ending in `/v1` | Same compatible API |

In LM Studio, use **Developer → Start server**. Its model list can include downloaded models that load on the first chat request when JIT loading is enabled. Use the exact identifier shown in the dropdown. If your server supports JSON schema, enable that setting; it is selected by default for LM Studio. Otherwise, the model is asked for the same JSON advice without the schema extension. Unsupported or malformed answers produce an explicit error, with guided matching still available; no inference request is silently retried.

Model size, quality, context capacity, GPU offload, loading and unloading belong to your server. Only the native Ollama route requests CPU execution and unloading. A compatible connection does not imply the model is installed, good at structured advice or guaranteed to fit alongside ComfyUI. No automatic model downloads occur.

Connections accept local HTTP loopback addresses only. Redirects, embedded credentials, query-string keys and nonlocal URLs are rejected. If the local server requires a token, set `FRAMEFORGE_ASSISTANT_API_KEY` in the studio process environment and restart; the website neither requests nor stores that key. Provider/address settings live in private `data/assistant-connection.json`, which is excluded from publication. Changing connections invalidates stale model selections.

The question, bounded recent chat, supported task catalog and ComfyUI queue status go to the selected endpoint. The website guide returns verified catalog links; it does not execute agents or shell commands, start jobs, install files or spend credits. A local URL cannot attest the server's internal proxy behavior, model residency, license or open-weight provenance. The **Open weights only** profile retains guided matching until additional chat-model dependencies are audited.

## Use your existing agent through MCP

**Antigravity and Hermes Agent** are MCP clients. Connect them to Frameforge and keep their current model/provider/subscription inside the agent. If “Hermes” means a Hermes model rather than Hermes Agent, serve that model through one of the compatible model servers above.

Open **Use Antigravity, Hermes or another agent instead** in the connection panel:

1. Select Antigravity, Hermes Agent, LM Studio or Claude Desktop.
2. Leave **Enable local creation tools** off for inspection only, or select it for local generation and project tools.
3. Optionally lock that agent connection to open-weight workflows.
4. Choose **Prepare agent connection**, then copy or download the generated configuration. It uses the actual checkout and Node paths on the computer running Frameforge, without API keys.
5. Merge the entry into the chosen agent's existing configuration and refresh/restart its MCP connection. Do not replace other entries. Move/download the source to its final location before exporting configuration; regenerate it if you relocate the checkout. For a WSL/remote agent, replace Windows executable/script/import paths with paths accessible in that environment.

| Agent | Where to merge the entry |
| --- | --- |
| Antigravity | MCP Servers → Manage MCP Servers → View raw config; `mcpServers` in its MCP JSON |
| Hermes Agent | `mcp_servers` in `~/.hermes/config.yaml` |
| LM Studio | Its `mcp.json` configuration editor; choose a tool-capable model |
| Claude Desktop | Its local MCP configuration, then restart |

The export does not install/register the agent, accept permissions or start generation. Only explicitly enabled local tools can create results. Import access starts with the project's original example-art folder; replace it with a folder you authorize before importing personal media. A tool connection is distinct from embedded visual MCP Apps support: see [actual Claude acceptance](MCP-CLIENT-ACCEPTANCE.md) and [the MCP guide](MCP-GUIDE.md).

## Tested scope

The Ollama adapter retains its regression checks. New tests cover compatible model discovery/chat payloads, JSON schema and plain JSON replies, response validation, saved connection/restart behavior, stale-model rejection, local URL/redirect limits, read-only configuration exports and strict-profile guided mode. A real local HTTP fixture exercises the website-to-server network path. A fixture is not an installed LM Studio/vLLM/llama.cpp model. Physical inference on each of those applications and Antigravity/Hermes client acceptance remain separate checks. No server was found on this development machine's standard model ports during this change; no model or agent was installed automatically. All 162 application tests and real ComfyUI readiness checks pass. Browser checks cover LM Studio preset selection, offline discovery, a no-model guided chain, the agent configuration export/download and a phone layout with the chat input visible and no panel overflow. The downloaded Hermes YAML was parsed independently.

Sources checked October 25, 2026: [LM Studio server](https://lmstudio.ai/docs/developer/core/server), [compatible API](https://lmstudio.ai/docs/developer/openai-compat), [visible/JIT models](https://lmstudio.ai/docs/developer/openai-compat/models), [structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output), [LM Studio MCP](https://lmstudio.ai/blog/lmstudio-v0.3.17), [Antigravity MCP](https://antigravity.google/docs/mcp), [Hermes Agent MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).
