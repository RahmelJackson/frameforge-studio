> **0.6.1 header update:** The owner supplied a screenshot of the native studio rendering, confirming the prior content-blocking failure is resolved for that view. Frameforge now has one compact 60 px desktop toolbar, with responsive tab scrolling, instead of its duplicated brand/status/Expand row. The surrounding client title remains host-owned. The current revision is checked in the bridge fixture; reopening the actual plugin is the remaining presentation check.

> **Current status — 0.6.0 / October 25, 2026:** The owner reported “content is blocked” in 0.5.2. That nested website approach is replaced with a native MCP Apps document, no iframe or direct network permissions. The bridge fixture prepared a real ten-node image graph, exposed its settings, loaded local voices, opened the existing three-shot timeline and decoded a saved 768×432 MP4 (2.041667 seconds, readyState 4, no media error). No GPU render, speech job, film edit or export was submitted during these UI checks. Native client rendering of 0.6.0 remains pending; older success records below do not establish it. Advanced controls remain JSON-based where described in MCP-GUIDE.

# Visual MCP client acceptance

Checked October 24, 2026 (local date), using the actual installed **Claude Desktop 3.6556.2** on Windows. This is distinct from the local browser test host.

## Confirmed in the real client

- Added the source checkout's local STDIO server to Claude's existing configuration, preserving other settings and a local backup. The adapter was launched with `--start-studio --allow-writes`; the acceptance prompt explicitly requested only read operations.
- `studio_workflows` rendered a genuine embedded MCP Apps resource inside the Claude conversation. Its accessibility tree identifies the Frameforge embed and Claude's MCP Apps proxy. No replacement HTML artifact was authored by Claude.
- The panel displayed Frameforge branding, original concept artwork, workspace navigation, the shared open-weight setting and four reviewed local recipes while that setting was active.
- Searched for `Z-Image` in the embedded panel and opened the recipe's inputs/output/steps. Used **Inspect graph**, selected the real `UNETLoader` node and read its pinned model URL, model filename and widget values.
- `studio_preview` returned the saved observatory image for job `49439472-0c79-4d5e-93f1-e8b3edbd8828`. Claude displayed its native image attachment. This was a saved output, not another render.

The initial assistant response was interrupted after the requested tool results arrived; that narrative response is not evidence of a completed creative task. The embedded panel remained interactive. No paid run, model download, new GPU render or creative approval occurred during acceptance.

## Updated presentation

The MCP panel now shares the website's original concept imagery, with embedded compressed thumbnails and no external image-domain requirement. Recipe art is labeled **CONCEPT ART**. The Saved results workspace requests actual saved output previews through MCP. Video results show a poster and an explicit instruction to open the full studio for motion review. Audio/Films retain links to their complete editors.

Original picture sources and generation prompts are documented locally in `EXPLORE-AND-HOME.md`. The smaller `public/explore-art/mcp-*.png` files are resized copies of those already published original assets, not copied library media. The self-contained UI resource stays below 2 MiB.

## Scope and remaining checks

- This confirms one installed Claude Desktop version, not every Claude client or Codex surface. Codex's visual panel remains unverified; ordinary MCP tools and embedded UI are separate capabilities.
- Local browser checks additionally cover policy filtering, a saved image preview, the latest search correction and responsive geometry. They are labeled development-host evidence.
- The panel offers a compact workflow/preview interface. The full website remains the complete editor; do not advertise every editor as embedded inside chat.
- No automatic challenge-category certification follows from the open-weight toggle. [Profile scope](OPEN-WEIGHTS.md).

For recording, use [the 115-second shot list](DEMO-SCRIPT.md). For connection settings, see [MCP-GUIDE.md](MCP-GUIDE.md).

Sources: [Claude interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude), [Claude local MCP servers](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop), [MCP Apps client testing](https://apps.extensions.modelcontextprotocol.io/api/documents/testing-mcp-apps.html), [OpenAI MCP and optional UI quickstart](https://developers.openai.com/plugins/build/app-quickstart).
