# Frameforge as a plugin

The plugin packages the same Frameforge MCP server with a branded plugin entry, three starter prompts, a setup skill and creative workflow guidance. Its visual MCP panel already includes original artwork, explained recipe cards, editable-graph inspection and saved-result previews. The website remains independently usable.

## Install from GitHub

Install Node.js 22+ first. In a supported local Codex installation:

```sh
codex plugin marketplace add RahmelJackson/frameforge-studio --ref main
codex plugin add frameforge-studio@frameforge-community
```

Restart the desktop client, open its Plugins directory, choose the **Frameforge Studio** marketplace source and find **Frameforge Studio**. It is a local/community plugin, not an approved listing in OpenAI's universal public directory. Try its setup action or ask **"Open Frameforge Studio and show me the visual workflow library."** The host decides how to display plugin pages and MCP Apps panels; a manifest cannot force the exact Higgsfield landing-page layout.

For a downloaded source release, add the clean extracted folder instead of GitHub:

```sh
codex plugin marketplace add C:/projects/frameforge-studio
codex plugin add frameforge-studio@frameforge-community
```

Use a clean source release. Do not register a development folder containing model/runtime junctions or private files: plugin installation copies its source into the client's plugin cache. This repository's source packager excludes those files. Local source changes require refreshing/reinstalling the plugin and restarting the client; editing a source folder alone does not prove the installed copy changed.

The root `plugin.json`, `mcp.json`, `skills/`, `assets/` and `.agents/plugins/marketplace.json` form the portable plugin package. No app/connector IDs or hosted endpoints have been invented. The server uses `${PLUGIN_ROOT}` paths and connects to the studio at `http://127.0.0.1:4317`. It reuses an already-running studio; otherwise `--start-studio` starts the bundled Node website backend. It does not start ComfyUI or install models. A backend started by MCP stops when that connection closes; start the website separately for long sessions and recovery.

## Permissions and setup

The plugin enables the same 17 tools as the creation-enabled standalone MCP connection. The host's normal tool permissions still apply. Simply opening the plugin does not request a render. No shell, model installer, paid submission, deletion or creative-approval tools are exposed.

Direct imports are initially confined to `public/explore-art` in the installed plugin. Upload personal media through the website or configure a deliberately chosen import folder. Do not broaden the root to a home directory just to avoid a missing-file error. Local media previews shared in a chat are sent to that assistant provider under its privacy settings; local generation does not mean an external assistant is offline.

Keep only one active Frameforge studio MCP connection when possible. After confirming this plugin is installed with its bundled server, a duplicate standalone `frameforge` entry can be removed using `codex mcp remove frameforge`. Leave the separate `frameforge-comfy` engine connector alone. Uninstalling the plugin later does not remove the studio's independently stored jobs or models.

Use the website's **Open weights only** toggle when wanted. This plugin does not force that profile at installation. A locked server/connection still cannot be unlocked by a tool request. Comfy Cloud and Civitai remain external handoffs; source/model availability and account-side runs need their own checks.

## Local installation versus public listing

Local/repository marketplace distribution is available without publishing a universal-directory listing. Public desktop-only MCP submission currently requires approved-partner access, developer verification and review. A GitHub release or a local plugin install is not that approval. The screenshot-rich visual panel is also distinct from the directory card and the host's plugin landing page.

References checked October 25, 2026: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [desktop-only submission](https://developers.openai.com/plugins/deploy/desktop-only), [Frameforge MCP tools and limits](MCP-GUIDE.md).
