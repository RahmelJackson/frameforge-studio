> **0.7.0:** Adds the integrated local model runners and setup flow while retaining the compact visual studio and hidden surrounding client title strip.

Release **0.7.0** adds direct local LTX/H3/FLUX execution, reviewed model downloads, early dependency lists, per-assistant setup and a native ComfyUI image bridge. See [the integration guide](INTEGRATION-UPGRADE.md) for tested profiles and remaining work.

> **0.6.1:** The MCP panel now renders native controls instead of a nested website. It includes visual workflows, editable graphs, local creation, speech, saved playback and film timelines. Advanced audio/video/layers use JSON controls. The former 0.5 frame was blocked in the owner’s Codex client; the new native rendering needs a fresh client check after updating. Browser fixture checks do not establish that acceptance.

# Frameforge as a plugin

The plugin packages the same Frameforge MCP server with a branded plugin entry, three starter prompts, a setup skill and creative workflow guidance. Its visual MCP panel already includes original artwork, explained recipe cards, editable-graph inspection and saved-result previews. The website remains independently usable.

Version 0.4.0 adds a full-width cinematic cover with an original local Wan video, large picture workflow cards immediately below it, expanded visual recipe details and two actual browser-preview screenshots for the plugin's gallery. The cover video and artwork are bundled into the MCP resource; no third-party media server is needed. A client that blocks video keeps the original poster. The host controls the directory/landing-page layout and whether it displays those screenshots; the live interactive layout appears when opening the visual MCP panel.

## Opening the panel versus selecting the plugin

The Plugins directory's Use action can select the plugin and prefill a chat prompt. A composer with that unsent text is not the studio UI. Send the starter prompt to request the visual panel through `studio_workflows`. Screenshots and brand metadata alone do not replace the host's composer or register an app launch path.

Version 0.4.1 also registers OpenAI's documented global/sidebar and thread-side-panel entrypoints on the read-only `studio_workflows` tool, pointing to the actual bundled MCP Apps resource. Version 0.4.0 lacked that registration. On a host that supports these entrypoints for the connection type, the global entry opens fullscreen. The owner confirmed immediate direct opening from Plugins on their Codex installation after 0.4.1. The 0.5 website frame was subsequently reported blocked; 0.6 replaces it with native controls and needs a fresh native-client check. Tool-discovery metadata alone is not proof of visual rendering.

The current package is a local STDIO integration. Use a local desktop/Work/Codex execution context that can connect to the computer; a hosted Chat context cannot run a local process by installing a source package. Higgsfield's installed plugin additionally references a registered hosted app. This package does not invent a registered app ID or silently expose the local studio on the internet. [OpenAI entrypoint documentation](https://developers.openai.com/plugins/build/extensions) and [local execution scope](https://developers.openai.com/plugins/deploy/desktop-only).

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

The plugin enables the same 18 tools as the creation-enabled standalone MCP connection. The host's normal tool permissions still apply. Simply opening the plugin does not request a render. No shell, model installer, paid submission, deletion or creative-approval tools are exposed.

Direct imports are initially confined to `public/explore-art` in the installed plugin. Upload personal media through the website or configure a deliberately chosen import folder. Do not broaden the root to a home directory just to avoid a missing-file error. Local media previews shared in a chat are sent to that assistant provider under its privacy settings; local generation does not mean an external assistant is offline.

Keep only one active Frameforge studio MCP connection when possible. After confirming this plugin is installed with its bundled server, a duplicate standalone `frameforge` entry can be removed using `codex mcp remove frameforge`. Leave the separate `frameforge-comfy` engine connector alone. Uninstalling the plugin later does not remove the studio's independently stored jobs or models.

Use the website's **Open weights only** toggle when wanted. This plugin does not force that profile at installation. A locked server/connection still cannot be unlocked by a tool request. Comfy Cloud and Civitai remain external handoffs; source/model availability and account-side runs need their own checks.

## Local installation versus public listing

Local/repository marketplace distribution is available without publishing a universal-directory listing. Public desktop-only MCP submission currently requires approved-partner access, developer verification and review. A GitHub release or a local plugin install is not that approval. The screenshot-rich visual panel is also distinct from the directory card and the host's plugin landing page.

References checked October 25, 2026: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [desktop-only submission](https://developers.openai.com/plugins/deploy/desktop-only), [Frameforge MCP tools and limits](MCP-GUIDE.md).
