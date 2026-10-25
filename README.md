# Frameforge

**An open-source creative studio inspired by Higgsfield, built around ComfyUI workflows.**

Frameforge is a local creative studio over your own ComfyUI. Turn an idea into images, moving shots, voice and a short film through a guided browser interface. Inspect the actual workflow graph, understand its inputs, find the required models, and choose where to create.

![Frameforge Studio with its original locally generated observatory video cover](assets/studio-cover.png)

*Actual browser screenshot of the studio. The cover uses original artwork and a short local Wan motion study; it is not a model-quality benchmark.*

## Why this exists

Creative AI tools offer an exciting path from an idea to a finished story. Setting up models, finding a compatible graph and connecting the results can make that path difficult to follow.

Frameforge brings those steps together: explained recipes, setup checks, editable ComfyUI graphs, saved media and a film workspace. It is an independent implementation inspired by Higgsfield's creative workflow. It is not affiliated with Higgsfield and does not include its source code, proprietary models or hosted service.

Built as an open-source Higgsfield-inspired creative studio submission.

## What you can do

| Workspace | What it helps you make |
| --- | --- |
| **Explore** | Discover Civitai examples, shared prompts and model references, with links and creator attribution. |
| **Library** | Find saved work and explained workflow recipes; inspect, edit and export graphs. |
| **Images** | Create and edit stills, paint masks, upscale, and organize character, scene and style references. |
| **Video** | Animate an image, generate from text, prepare camera/keyframe workflows, and edit or finish clips. |
| **Films** | Connect a script, storyboard selections, clips, narration, music, captions and a saved timeline; export an MP4. |
| **Audio** | Prepare narration, dialogue, transcription and translation; explore experimental lip-sync tools. |
| **Studio guide & MCP** | Find workflows in the website, or connect Codex/Claude to the same graph, generation and saved-production tools. |

The interface includes guided starting points, purpose/input/output descriptions, model source links and setup checks. Navigation can use either a top bar or a sidebar.

## Website or MCP. Your choice.

The local STDIO MCP server gives Codex, Claude and other compatible clients **17 tools** for recipe discovery, setup checks, graph preparation, local creation, native previews, speech and film projects. Seven tools are read-only by default; creation requires `--allow-writes`. No paid submissions or automatic model installs. The MCP Apps entry opens the complete studio website in compatible local clients, with the same image/video/film/audio editors, library, setup and guide. Clients that block embedded local pages can open the same studio in their browser; ordinary text tools remain available. New full-site native-client acceptance remains separate from the owner-confirmed direct Plugins launch. See [MCP setup and examples](MCP-GUIDE.md).

Use the navigation **Open weights only** toggle to limit this studio to reviewed local pipelines. `npm run start:open` locks that profile; `--open-weights-only` does the same for an MCP connection. Partner nodes and unknown model loaders are rejected server-side. [Scope, model terms and limits](OPEN-WEIGHTS.md).

This entry is being prepared for the Comfy Open Source Higgsfield challenge. [Submission requirements and remaining owner actions](CHALLENGE-CHECKLIST.md) include a two-minute demo, social link, signup and entry form. The profile is not an organizer eligibility certification.

## Four ways to start

| Your setup | How it works |
| --- | --- |
| **You already use ComfyUI** | Start it, choose **Setup & models → Find running ComfyUI**, select its address and check the recipe. Existing model folders can stay where they are. |
| **You want a local installation** | Follow the official ComfyUI install links, then download only the selected workflow's requirements. Native graphs include missing-model download metadata. |
| **You want Comfy Cloud only** | Choose **Create online**, download a graph and import it into your own Comfy Cloud account. Supported text-only image, video and speech graphs prepare without local ComfyUI, Python or model weights. |
| **You want Civitai images** | Prepare a prompt/model-reference brief, open Civitai's generator, choose a supported model and review the Buzz cost there. |

Cloud and Civitai generation happen on those services. Frameforge does not store provider credentials, upload your media or spend credits. Reference-based Cloud starter graphs require replacing example inputs; native graphs require matching nodes/models in the destination environment. A Civitai brief is a text handoff, not an importable ComfyUI graph.

## Quick start

Install [Node.js 22 or newer](https://nodejs.org/en/download), then:

    git clone https://github.com/RahmelJackson/frameforge-studio.git
    cd frameforge-studio
    npm start

Open **http://127.0.0.1:4317** and choose a setup path. The interface has no npm dependencies to install. Browse workflows and prepare supported online graphs before connecting a local engine.

For uploads and media checks **inside the studio**, install [Python 3.12](https://www.python.org/downloads/) and run:

    npm run setup:media

Restart the studio afterward. This installs only CPU media helpers, not ComfyUI, Torch or model weights. Advanced speech, segmentation and finishing tools have separate setup requirements. Local generation needs the selected recipe's hardware, models and nodes. The full bundled-engine setup scripts target Windows; the Node interface and external handoffs do not require that installation.

See [the detailed setup guide](GITHUB-SETUP.md) for model folders, another drive, optional local AI and MCP configuration.

## How the pieces fit

    Idea / reference / clip
             ↓
    Guided tool + explained recipe
             ↓
    Inspect / edit / export the workflow
             ↓
    Local ComfyUI  OR  external Comfy Cloud / Civitai
             ↓
    Save and review the result
             ↓
    Edit / assemble / add sound and captions / export

Some tasks are ComfyUI graphs; others use local Python media processors. Where a tool has several stages, the studio shows their roles instead of representing the whole pipeline as a single portable graph. Suggested chains still require choosing, running and reviewing each stage.

## Current state and limits

This is a working prototype with **164 passing application tests** at the current checkpoint. Local image/video workflows, graph export, saved projects, media checks and a demonstration film export have retained verification records. A separate empty-model ComfyUI instance verifies that importing the Z-Image graph exposes its three dependencies and download controls.

Technical checks do not guarantee a convincing creative result. Fifteen broader quality goals remain parked, including difficult character consistency, swaps, motion/occlusion, advanced relighting and speech/lip realism. Some tools have narrow acceptance or remain experimental; the [saved checklist](REMAINING-CHECKLIST.md) records those limits.

Provider account-side Cloud imports/runs and Civitai generation still need acceptance checks. API/node/model availability can change. Civitai media may be blocked by the browser; original source links remain available. There are no model weights, personal outputs, Python environments or provider keys in this repository.

## Development and verification

    npm test                # Application regression tests
    npm run verify          # Running studio + installed local engine readiness; no render
    npm run package:source  # Clean source archive and SHA-256 inventory

The readiness check needs the studio and configured engine running and is not expected to pass before local model setup. Some feature-specific tests need their documented runtimes. Follow [the verification loop](BUILD-LOOP.md) when changing generation behavior; watch/listen to real outputs separately from automated checks.

The server binds to localhost and is intended for personal local use. Public repository access does not make the running application a hosted multi-user service.

## License and credits

Original project code is [MIT licensed](LICENSE). ComfyUI, custom nodes, optional tools, model weights, hosted services and third-party templates keep their own terms. Preserve the included [third-party notices](THIRD-PARTY-NOTICES.md).

Built around the work of [ComfyUI](https://github.com/Comfy-Org/ComfyUI) and its workflow ecosystem, with optional [Ollama](https://ollama.com/) integration and [Civitai](https://civitai.com/) discovery links. Higgsfield is a product inspiration, not a project dependency or affiliation.


**Bring your own AI:** Ollama is optional. Studio guide connects to LM Studio, Ollama, llama.cpp, vLLM and custom local compatible servers. Setup includes server presets, discovery and copy/download configuration for Antigravity, Hermes Agent, LM Studio and Claude MCP clients. [Connection guide and tested scope](ASSISTANT-CONNECTIONS.md).

**Install as a plugin:** Frameforge also packages a branded local/community plugin with starter prompts, onboarding, creative skills and its visual MCP studio. Add the GitHub marketplace, install `frameforge-studio@frameforge-community`, then restart your client. Node.js 22+ is required; models remain separate. [Plugin installation, permissions and public-listing limits](PLUGIN-GUIDE.md).
