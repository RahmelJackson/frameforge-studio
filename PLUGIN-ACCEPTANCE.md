# Plugin package acceptance — October 25, 2026

Frameforge Studio 0.3.0 is a local/community plugin package, not a universal-directory-approved app. It includes the existing visual MCP server, original lime film-frame icon, three starter prompts, onboarding and a creative workflow skill.

## Visual refresh — 0.4.0

The new presentation uses a large cinematic cover, editorial typography, original picture cards below it, a visual recipe detail and actual plugin-gallery screenshots. [Kling](https://kling.ai/) and [Black Forest Labs](https://bfl.ai/) were inspected directly for presentation ideas. No media, logos or proprietary website code were copied from them.

The cover is one newly requested local Wan 2.2 5B image-to-video job, using the repository-owned observatory artwork. Its 49 frames at 24 fps and 768×432 decode and pass the existing technical checks. The generated clip was inspected as a contact sheet and played in the browser. It has subtle atmosphere/camera movement, no audio, and a visible short-loop boundary can remain. This is not evidence of broader identity, camera-direction or motion realism. The published H.264 clip is 366,773 bytes. [Source, prompt, seed, dimensions and hashes](public/explore-art/observatory-motion.json) record provenance. Existing job creative approval was not changed.

The browser preview previously returned 404 for the three compact MCP PNGs. Explicit routes now serve those images and the cover MP4, including HTTP byte-range playback. A fresh source-only HTTP test checks all three image content types and the MP4 range response. The embedded MCP resource includes its own image/video bytes, remains below 2 MiB, and requires no external media domains. The local test host explicitly allows its bundled data-video source in CSP.

Browser checks covered the 1265-pixel desktop layout, a 390-pixel phone viewport (359-pixel embedded document), picture loading, cover playback/pause and pause after scrolling away, workflow search and selection, and inspection of the actual 12-node Wan graph. A portrait-crop issue caused by strict website CSP was fixed using stylesheet classes. Reduced-motion handling is implemented, but OS reduced-motion emulation was not separately exercised. `assets/studio-cover.png` and `assets/studio-workflows.png` are real browser-preview screenshots with the read-only preview label; they do not impersonate an actual Codex client.

The new 0.4.0 visual layout and video still require a restarted native-client visual acceptance check. Existing Claude acceptance concerns the earlier picture panel. Plugin metadata/discovery checks and browser tests do not replace that step.

After installing 0.4.0, the Codex local plugin API confirms the enabled version, both screenshot paths, both skills and the bundled MCP server. All 163 regression tests and live ComfyUI readiness pass after this refresh. The public source snapshot contains the original cover and screenshots; model files, private job storage and runtimes stay excluded.

## Native launch registration — 0.4.1

Version 0.4.0 advertised the MCP Apps resource but omitted OpenAI's `openai/ui.entrypoints` registration. The startup composer with a selected plugin and an unsent prompt is not an accepted fullscreen studio launch. Adding screenshots did not address that route.

The read-only `studio_workflows` tool now declares a Frameforge Studio title and both `{type:"global"}` and `{type:"thread"}` entrypoints, using the existing bundled UI resource. The global entrypoint is the documented fullscreen/sidebar app route; thread supplies a conversation panel. The new regression check calls the launch tool with empty arguments, checks the actual resource, and verifies that launch never renders or changes the execution profile. [Official registration format](https://developers.openai.com/plugins/build/extensions).

Actual Plugins-menu routing remains an open native-client acceptance check. The UI must visibly appear after the client loads the registration before claiming that click path works. Metadata parsing, a standalone app-server check and browser preview do not establish that result. The current package uses local STDIO; a hosted Chat environment and a registered hosted app are separate connection paths. No hosted app ID, internet tunnel or credential was created to disguise that difference.

The installed 0.4.1 package was checked through a fresh Codex app-server: `mcpServerStatus/list` returns both native entrypoints, the Frameforge Studio title and the existing UI resource URI with no discovery error. `mcpServer/resource/read` returns the actual bundled artwork and video resource (approximately 1.84 MB). All 164 regression tests pass. This verifies host transport and resource availability; menu-click rendering is still pending. The current desktop's control socket was unavailable, so a hot reload into that running UI was not performed.

**Owner confirmation:** after installing 0.4.1 and being asked to reopen Codex, select Frameforge and send its starter prompt if necessary, the owner reported **"The visual studio opens."** This is user-reported successful opening in their client. The response did not separately distinguish direct menu launch from the send-prompt fallback. No agent-captured native screenshot was available in this chat; the exposed MCP Apps browser inventory contained no app tab. Direct one-click routing, if that is required, and other client versions remain distinct checks. Live local-engine readiness also passes after this change.

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
