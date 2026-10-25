---
name: setup
description: Set up the Frameforge plugin, show its visual workflow library and check the user's existing ComfyUI connection and required model downloads. Use for Frameforge installation or first-run help.
---

# Start using Frameforge

Call Frameforge `studio_workflows` to open its visual panel, then `comfy_status` to check the connected local engine. An engine being online does not mean a selected recipe has all its models or nodes. For a requested recipe, call `workflow_requirements` and explain any missing downloads with their destination folders and source links.

Use the `studioUrl` returned by discovery for website links. Offer its `/setup` page to connect an existing ComfyUI or follow local-install guidance. A fresh source package includes Node application code and original concept artwork, not models, Python environments, ComfyUI or saved generations. Node.js 22 or newer must be installed before the plugin can launch.

If no local engine is available, explain that the library remains useful for inspecting workflows and preparing supported external Comfy Cloud packages or Civitai image briefs. Provider sign-in, uploads and payment happen on those websites. Avoid requesting their credentials in chat.

The plugin enables local creation tools, but opening it does not authorize a render. Start with the user's goal and existing input; inspect requirements before offering a small preview. Personal media can be uploaded through the website. Direct MCP imports are limited to the configured import folder, which initially contains bundled original artwork only. No automatic model downloads or paid submissions occur.

If the client does not render the MCP Apps panel, provide the returned website link and describe the limitation. If MCP tools are missing, have the user confirm the plugin is enabled and restart the client; do not claim installation or visual acceptance from a browser-only preview.
