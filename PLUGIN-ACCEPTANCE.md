# Plugin package acceptance — October 25, 2026

Frameforge Studio is a local/community plugin package, not a universal-directory-approved app. It includes the existing visual MCP server, original lime film-frame icon, three starter prompts, onboarding and a creative workflow skill.

## Visual refresh — 0.4.0

The new presentation uses a large cinematic cover, editorial typography, original picture cards below it, a visual recipe detail and actual plugin-gallery screenshots. [Kling](https://kling.ai/) and [Black Forest Labs](https://bfl.ai/) were inspected directly for presentation ideas. No media, logos or proprietary website code were copied from them.

The cover is one newly requested local Wan 2.2 5B image-to-video job, using the repository-owned observatory artwork. Its 49 frames at 24 fps and 768×432 decode and pass the existing technical checks. The generated clip was inspected as a contact sheet and played in the browser. It has subtle atmosphere/camera movement, no audio, and a visible short-loop boundary can remain. This is not evidence of broader identity, camera-direction or motion realism. The published H.264 clip is 366,773 bytes. [Source, prompt, seed, dimensions and hashes](public/explore-art/observatory-motion.json) record provenance. Existing job creative approval was not changed.

The browser preview previously returned 404 for the three compact MCP PNGs. Explicit routes now serve those images and the cover MP4, including HTTP byte-range playback. A fresh source-only HTTP test checks all three image content types and the MP4 range response. The embedded MCP resource includes its own image/video bytes, remains below 2 MiB, and requires no external media domains. The local test host explicitly allows its bundled data-video source in CSP.

Browser checks covered the 1265-pixel desktop layout, a 390-pixel phone viewport (359-pixel embedded document), picture loading, cover playback/pause and pause after scrolling away, workflow search and selection, and inspection of the actual 12-node Wan graph. A portrait-crop issue caused by strict website CSP was fixed using stylesheet classes. Reduced-motion handling is implemented, but OS reduced-motion emulation was not separately exercised. The original 0.4 screenshots were labeled read-only browser previews. Version 0.5 replaces them with actual complete-website browser captures; neither set is a native Codex screenshot.

The new 0.4.0 visual layout and video still require a restarted native-client visual acceptance check. Existing Claude acceptance concerns the earlier picture panel. Plugin metadata/discovery checks and browser tests do not replace that step.

After installing 0.4.0, the Codex local plugin API confirms the enabled version, both screenshot paths, both skills and the bundled MCP server. All 163 regression tests and live ComfyUI readiness pass after this refresh. The public source snapshot contains the original cover and screenshots; model files, private job storage and runtimes stay excluded.

## Native launch registration — 0.4.1

Version 0.4.0 advertised the MCP Apps resource but omitted OpenAI's `openai/ui.entrypoints` registration. The startup composer with a selected plugin and an unsent prompt is not an accepted fullscreen studio launch. Adding screenshots did not address that route.

The read-only `studio_workflows` tool now declares a Frameforge Studio title and both `{type:"global"}` and `{type:"thread"}` entrypoints, using the existing bundled UI resource. The global entrypoint is the documented fullscreen/sidebar app route; thread supplies a conversation panel. The new regression check calls the launch tool with empty arguments, checks the actual resource, and verifies that launch never renders or changes the execution profile. [Official registration format](https://developers.openai.com/plugins/build/extensions).

**Owner confirmation:** the owner explicitly reported that version 0.4.1 opens immediately when selected from Plugins. Direct native launch is therefore user-confirmed. They also reported that the limited panel looked awkward and requested the complete studio. No agent-captured native screenshot was available in this chat.

## Complete studio — 0.5.0

The native entrypoints now reference a new `studio-v2.html` resource. It opens the actual website through a connection-owned, loopback-only view, using the same backend, files and editors. The old miniature MCP navigation and connection-status header are removed. The home page uses the original observatory video as a full-width cover, restrained typography and clear workflow actions. Existing picture recipes and every website workspace remain below it.

The resource declares its exact local iframe origin; the view permits only the actual ancestor origins passed over the MCP bridge. The regular website's anti-framing policy is unchanged. Read-only connections reject mutations, and a locked open-weights connection cannot weaken its profile. Credential headers and cookies other than the navigation preference are not forwarded. Media range requests are preserved. Connection shutdown closes the view. The old v1 resource still resolves for compatibility.

Local bridge rendering and browser checks are separate from native client acceptance. The new full-site iframe has not yet been visually confirmed in a restarted Codex or Claude client. Some clients can prohibit local nested frames or private-network access; the UI offers Open in browser without weakening client security. Public directory approval also needs an iframe justification and separate review.

## Verified

- A clean source-only copy was registered as `frameforge-community` with the Codex CLI and installed as `frameforge-studio@frameforge-community`. The CLI reports installed and enabled.
- Codex's local `plugin/read` API recognizes its display name, descriptions, brand color, icon paths, starter prompts, two namespaced skills, setup action and bundled `frameforge` MCP server. This confirms actual host parsing, beyond a JSON-file check.
- After removing the duplicate standalone studio entry, Codex's `mcpServerStatus/list` discovers `frameforge` owned by `frameforge-studio@frameforge-community`, with all 17 tools and no tool-discovery error. The separate `frameforge-comfy` connector still exposes its seven engine tools. This checks the installed plugin's real server discovery, without starting a model turn or render.
- A relocated source-release test launches the declared STDIO entry with expanded plugin paths, lists all 17 tools and reads the self-contained MCP Apps HTML with embedded original pictures. No models or private config are needed for this discovery/resource check.
- The registered standalone MCP connection was separately checked against the running studio before migration: 14 graph recipes, 28 tasks, 17 tools, four resources, embedded visual panel and a connected ComfyUI with no queued/running jobs. This was a connection check, not a new generation.
- Both packaged skills pass the Skill Creator validator. The 0.5 regression suite passes 168 tests. Required readiness verification checks the running local engine without rendering.

## Still separate

The owner has confirmed immediate Plugins launch of the earlier panel. The new 0.5 full-site frame, setup invocation and other client versions still need native acceptance. The local API metadata check is not a screenshot or proof of that UI behavior. The pre-existing MCP panel has a separate real Claude Desktop acceptance record in [MCP-CLIENT-ACCEPTANCE.md](MCP-CLIENT-ACCEPTANCE.md).

No paid jobs, model downloads, authentication changes, public-directory submission or new GPU renders were part of this installation. The existing 15 broad creative-quality research goals remain unresolved. Public desktop-only plugin eligibility and review require separate OpenAI approval; local install does not grant it.

### Full-site browser checks

The complete site rendered inside the local bridge host, including the running video cover, studio guide and existing local work. Browser automation could inspect nested content but could not activate targets through the two-level iframe, so that interaction path is not recorded as passing. On the same local view opened directly, the cover navigated to the workflow library, a real Wan graph loaded with model links, the 390×844 layout had no horizontal overflow, and side navigation hid the top bar with main content starting at y=0. The native client remains the required acceptance check for the new nested frame.

`npm test` passes 168 tests; `npm run verify` passes the suite and live ComfyUI readiness without a new render. Added tests cover exact ancestor registration, blocked cross-origin/read-only mutations, credential stripping, streaming ranges, locked-profile enforcement and listener shutdown. Existing generation/creative-quality goals have not been reclassified.


## Native origin repair — 0.5.1

The owner confirmed the 0.5.0 opening screen displayed “Use exact embed origins only.” The new full-site frame therefore failed native acceptance. Passive inspection of installed Codex 26.1007.2314.0 found its sandbox-origin factory uses the codex-sandbox scheme and an mcp-app- prefix plus 24-byte identity digest encoded as 48 hex characters beneath web-sandbox.oaiusercontent.com. The validator now accepts precisely that authority shape without a custom port; it does not allow arbitrary desktop schemes or wildcard parents. Regression tests reproduce the former rejection, reject lookalike hosts and run the native-origin chain through MCP registration. The exact runtime connection digest has not been captured; the installed factory is the evidence for the format. The v3 resource invalidates the old UI cache, with v1/v2 compatibility retained. Native successful rendering remains pending.

A broader arbitrary-scheme proposal was rejected by automatic approval review and reverted before installation. The narrower fix follows the observed installed-client factory. Client files were only read; extracted code and local diagnostic artifacts are excluded from the public source release. The REA archive scan encountered unpacked-native integrity differences; no client code was executed or modified for this inspection.


## Live panel investigation and repair — 0.5.2

The owner clarified that their repeated origin error was seen before restarting. A later report said the panel still showed only the splash and its browser button did not work. The actual 0.5.1 MCP panel was then opened through the connected tool in this chat. Root-document inspection confirmed the codex-sandbox origin, version 0.5.1, successful registration, a visible iframe assigned to a connection-owned loopback URL, and a still-visible opening cover after the ready timeout. An HTTP request to that exact view returned the full website and bridge script with status 200 and a specific native ancestor allowlist. The native iframe contents were not inspected: the browser URL policy rejected that nested-frame action, and no bypass was attempted.

Version 0.5.2 adds the documented legacy frame/redirect permission aliases alongside the existing standard fields, restricted to the same exact local origins. The cover is removed once registration finishes so a missing child-ready notification cannot obscure a functioning editor. Missing confirmation produces a small notice with Reload studio and a real local hyperlink. Client-denied browser-opening results are treated as failures and shown rather than ignored. These changes do not prove that every client allows local iframes or opens a browser successfully.

Five new behavioral tests cover visibility without a ready message, browser rejection feedback, sender validation, and matching standard/legacy permission declarations. The v4 resource avoids cached 0.5.1 markup while old resource addresses remain readable. Successful native full-site interaction remains pending owner confirmation.


The 0.5.2 release passes all 175 regression tests and live ComfyUI readiness after restarting the existing engine. The owner's session was reconnected from the clean plugin-cache backend to the original configured studio and D-drive storage; the cache copy's files were preserved. No new render, download or creative approval was performed. Native nested-frame interaction remains unverified because the inspection tool rejected that action.
