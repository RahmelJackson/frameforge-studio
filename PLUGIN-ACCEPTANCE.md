# Plugin package acceptance — October 25, 2026

Frameforge Studio 0.3.0 is a local/community plugin package, not a universal-directory-approved app. It includes the existing visual MCP server, original lime film-frame icon, three starter prompts, onboarding and a creative workflow skill.

## Verified

- A clean source-only copy was registered as `frameforge-community` with the Codex CLI and installed as `frameforge-studio@frameforge-community`. The CLI reports installed and enabled.
- Codex's local `plugin/read` API recognizes its display name, descriptions, brand color, icon paths, starter prompts, two namespaced skills, setup action and bundled `frameforge` MCP server. This confirms actual host parsing, beyond a JSON-file check.
- After removing the duplicate standalone studio entry, Codex's `mcpServerStatus/list` discovers `frameforge` owned by `frameforge-studio@frameforge-community`, with all 17 tools and no tool-discovery error. The separate `frameforge-comfy` connector still exposes its seven engine tools. This checks the installed plugin's real server discovery, without starting a model turn or render.
- A relocated source-release test launches the declared STDIO entry with expanded plugin paths, lists all 17 tools and reads the self-contained MCP Apps HTML with embedded original pictures. No models or private config are needed for this discovery/resource check.
- The registered standalone MCP connection was separately checked against the running studio before migration: 14 graph recipes, 28 tasks, 17 tools, four resources, embedded visual panel and a connected ComfyUI with no queued/running jobs. This was a connection check, not a new generation.
- Both packaged skills pass the Skill Creator validator. The application regression suite passes 163 tests. Required readiness verification checks the running local engine without rendering.

## Still separate

The newly installed plugin's directory card, landing page, setup action invocation and embedded panel have not been visually exercised in a restarted Codex client. The local API metadata check is not a screenshot or proof of that UI behavior. The pre-existing MCP panel has a separate real Claude Desktop acceptance record in [MCP-CLIENT-ACCEPTANCE.md](MCP-CLIENT-ACCEPTANCE.md).

No paid jobs, model downloads, authentication changes, public-directory submission or new GPU renders were part of this installation. The existing 15 broad creative-quality research goals remain unresolved. Public desktop-only plugin eligibility and review require separate OpenAI approval; local install does not grant it.
