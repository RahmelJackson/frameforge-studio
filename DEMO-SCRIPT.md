# Frameforge Studio: 112-Second Showcase Video & Demo Script
*Duration: 1 minute 52 seconds (Strictly under 2 minutes)*  
*Total Narration Word Count: 246 words (Target: ~130 WPM natural speaking pace)*

---

## 🎬 Narrative Arc & Pacing Overview

| Act | Timecode | Focus | Narration Words | Key Emotional & Technical Takeaway |
| :--- | :---: | :--- | :---: | :--- |
| **Act 1** | `0:00 – 0:18` (18s) | **The Hook & Problem** | 40 words | The power of ComfyUI without the node spaghetti; open-source Higgsfield. |
| **Act 2** | `0:18 – 0:48` (30s) | **The Core Journey** | 65 words | Single prompt → multi-shot breakdown → FLUX + Wan + Kokoro → final cut. |
| **Act 3** | `0:48 – 1:12` (24s) | **Under the Hood** | 52 words | Full graph transparency + Smart Remix dependency caching (no wasted GPU). |
| **Act 4** | `1:12 – 1:38` (26s) | **The 4 Integrations** | 55 words | Web UI, ComfyUI Quick Tools, Claude/Codex MCP, and Phone Remote. |
| **Act 5** | `1:38 – 1:52` (14s) | **Hackathon Climax** | 34 words | 100% open weights, local execution, zero subscriptions, community future. |
| **Fade** | `1:52 – 1:56` (4s) | **Outro Title & Links** | — | Clean music resolve on GitHub URL & project credits. |

---

## 📜 Scene-by-Scene Storyboard & Script

### **ACT 1: THE HOOK & VISION (0:00 – 0:18)**
- **0:00 – 0:08 (8s)**
  - **Show:** Rapid zoom-in of tangled ComfyUI noodles wipe-transitioning into sleek, dark-mode Frameforge Studio home screen (`http://127.0.0.1:4317`). Hover over *"What do you want to make?"*.
  - **Text Overlay:** `COMFYUI POWER. ZERO NOODLES.`
  - **Say:** *"ComfyUI has incredible power, but creators shouldn’t have to wire fifty nodes just to direct a short film."*
  - **Audio:** Cinematic synth drone; subtle digital glitch/whoosh on transition.

- **0:08 – 0:18 (10s)**
  - **Show:** Smooth pan across visual personalities (`Cinematic`, `Fruit Romance`, `Satisfying Loop`). Click **Produce Mode** and select **"A small cinematic story" (16:9 Landscape)**.
  - **Text Overlay:** `OPEN-SOURCE HIGGSFIELD · POWERED BY LOCAL OPEN WEIGHTS`
  - **Say:** *"Frameforge Studio brings the fluid, cinematic creator experience of Higgsfield directly to open-source AI, running 100% locally on your own GPU."*
  - **Audio:** Driving modern electronic groove kicks in at low volume (-24 dB).

---

### **ACT 2: FROM IDEA TO FILM — THE PRODUCE PIPELINE (0:18 – 0:48)**
- **0:18 – 0:28 (10s)**
  - **Show:** Type prompt: *"A vintage red sports car escapes across a sun-drenched desert highway."* Click **Start Production**. 3-beat story arc generates with timed directions.
  - **Text Overlay:** `AUTOMATED STORY PLANNING · 3 TIMED BEATS`
  - **Say:** *"With Produce, one creative prompt plans out a complete multi-shot story with structured beats and camera directions."*
  - **Audio:** Soft rhythmic UI clicks as cards populate.

- **0:28 – 0:38 (10s)**
  - **Show:** Progress cut: consistent FLUX keyframes arrive, Wan 2.2 generates dynamic video clips, Kokoro synthesizes dialogue, word-highlighted captions appear.
  - **Text Overlay:** `FLUX.1 · WAN 2.2 · KOKORO TTS · FFMPEG STITCH`
  - **Say:** *"Frameforge orchestrates your local open-weight models—generating consistent keyframes with FLUX, cinematic motion with Wan, and synchronized speech with Kokoro."*
  - **Audio:** Subtle engine hum and motion whoosh from the rendered clip.

- **0:38 – 0:48 (10s)**
  - **Show:** Studio video player loads the completed cut. Hit **Play**. Scrub through the 15-second multi-shot film with captions and dialogue.
  - **Text Overlay:** `FINISHED ROUGH CUT · MULTI-SHOT CONTINUITY`
  - **Say:** *"In minutes, you get a fully sequenced, color-timed rough cut ready to watch, review, or refine."*
  - **Audio:** Clip audio briefly surfaces (vintage car revving + desert wind), then ducks back under narration.

---

### **ACT 3: UNDER THE HOOD — GRAPH TRANSPARENCY & SMART REMIX (0:48 – 1:12)**
- **0:48 – 0:58 (10s)**
  - **Show:** Hover over Shot 2 and click **"View ComfyUI Graph"**. Reveal the full native ComfyUI node network behind that exact shot.
  - **Text Overlay:** `ZERO BLACK BOXES · 100% NATIVE COMFYUI GRAPH`
  - **Say:** *"Here’s the breakthrough: there are no black boxes. Every single shot exposes its real, underlying ComfyUI graph for full inspection and tweakability."*
  - **Audio:** Satisfying sliding glass panel UI sound.

- **0:58 – 1:12 (14s)**
  - **Show:** Click **Remix**. Change Shot 2: *"Change shot 2 to the same car speeding through neon rain at night."* Show badges: Shots 1 & 3 `Reused` (Cached 🟢), Shot 2 `Remake` (Diffing 🟡). Click Run Remix; only Shot 2 re-renders and re-cuts in seconds.
  - **Text Overlay:** `SMART REMIX · SELECTIVE DEPENDENCY CACHING · ZERO WASTED GPU`
  - **Say:** *"And with Smart Remix, you don’t re-render everything to make a change. The engine computes the exact dependency delta, caching unchanged shots and rendering only what changed. Zero wasted GPU compute."*
  - **Audio:** Quick render chime; neon rain audio snippet.

---

### **ACT 4: FOUR CONNECTED SURFACES & INTEGRATIONS (1:12 – 1:38)**
- **1:12 – 1:18 (6s) — ComfyUI Extension**
  - **Show:** In ComfyUI (`:8188`), right-click a Save Image node → `✦ Frameforge → Animate this`. Studio immediately opens with the image loaded into the timeline.
  - **Text Overlay:** `SURFACE 1: COMFYUI EXTENSION · RIGHT-CLICK BRIDGING`
  - **Say:** *"Frameforge lives across your entire workflow. Inside ComfyUI, right-click any generated image to send it straight to Studio to animate."*
  - **Audio:** Snappy mouse clicks; smooth UI tab switch.

- **1:18 – 1:28 (10s) — Model Context Protocol (MCP)**
  - **Show:** Claude Desktop / Codex terminal side-by-side with Studio. Prompt: *"Use Frameforge to preview a remix of my latest production with a golden-hour look."* Claude calls `frameforge_remix_preview` and returns the exact shot delta.
  - **Text Overlay:** `SURFACE 2: MODEL CONTEXT PROTOCOL (MCP) · CLAUDE & CODEX`
  - **Say:** *"In Claude or Codex, the Model Context Protocol gives your AI agents full creative control to plan, inspect, and remix productions using natural language."*
  - **Audio:** Subtle keyboard keystrokes and MCP tool-call sparkle chime.

- **1:28 – 1:38 (10s) — Mobile Phone Remote**
  - **Show:** Studio **Phone Remote** drawer with QR code. Cut to smartphone on local Wi-Fi. User taps **"Approve Shot"** and **"Play Cut"** from the phone; Studio responds instantly.
  - **Text Overlay:** `SURFACE 3: PHONE REMOTE · WI-FI ZERO-INSTALL REVIEW`
  - **Say:** *"And with the local Wi-Fi Phone Remote, you can review keyframes and approve cuts right from your phone while your PC renders."*
  - **Audio:** Mobile tap haptic sound; desktop playback trigger chime.

---

### **ACT 5: THE CLIMAX & HACKATHON CLOSE (1:38 – 1:52)**
- **1:38 – 1:46 (8s)**
  - **Show:** Full-screen beauty playback of the remixed desert-to-night film with sound and captions.
  - **Text Overlay:** `100% OPEN WEIGHTS · ZERO CLOUD QUEUES · YOUR HARDWARE`
  - **Say:** *"No cloud subscriptions. No black-box lock-in. Just pure creative freedom powered by local open weights on your machine."*
  - **Audio:** Music reaches its triumphant, cinematic crescendo.

- **1:46 – 1:52 (6s)**
  - **Show:** Final title slide with Frameforge Studio logo, GitHub repository link, and Comfy Community badges.
  - **Text Overlay:** `FRAMEFORGE STUDIO · GITHUB.COM/RAHMELJACKSON/FRAMEFORGE-STUDIO`
  - **Say:** *"Frameforge turns open-source generative video into an end-to-end filmmaker’s studio. Star the project on GitHub."*
  - **Audio:** Final musical chord resolves; clean fade out.

- **1:52 – 1:56 (4s)**
  - **Show:** Fade to black. Persistent GitHub URL and credits.
  - **Audio:** Music tail fades to silence.

---

## 🎙️ Verbatim Teleprompter Script (246 Words)

> "ComfyUI has incredible power, but creators shouldn’t have to wire fifty nodes just to direct a short film. Frameforge Studio brings the fluid, cinematic creator experience of Higgsfield directly to open-source AI, running 100% locally on your own GPU.
>
> With Produce, one creative prompt plans out a complete multi-shot story with structured beats and camera directions. Frameforge orchestrates your local open-weight models—generating consistent keyframes with FLUX, cinematic motion with Wan, and synchronized speech with Kokoro. In minutes, you get a fully sequenced, color-timed rough cut ready to watch, review, or refine.
>
> Here’s the breakthrough: there are no black boxes. Every single shot exposes its real, underlying ComfyUI graph for full inspection and tweakability. And with Smart Remix, you don’t re-render everything to make a change. The engine computes the exact dependency delta, caching unchanged shots and rendering only what changed. Zero wasted GPU compute.
>
> Frameforge lives across your entire workflow. Inside ComfyUI, right-click any generated image to send it straight to Studio to animate. In Claude or Codex, the Model Context Protocol gives your AI agents full creative control to plan, inspect, and remix productions using natural language. And with the local Wi-Fi Phone Remote, you can review keyframes and approve cuts right from your phone while your PC renders.
>
> No cloud subscriptions. No black-box lock-in. Just pure creative freedom powered by local open weights on your machine. Frameforge turns open-source generative video into an end-to-end filmmaker’s studio. Star the project on GitHub."

---

## 🛠️ Recording Setup Checklist

- [ ] **Pre-render the hero production:** Run `"a vintage red sports car escapes across a sun-drenched desert highway"` at `http://127.0.0.1:4317/produce.html` so all shots, clips, audio, and the rough cut are pre-rendered.
- [ ] **Pre-render the remix:** Run a remix changing Shot 2 to night with neon rain so you can show the instant swap without rendering latency.
- [ ] **Display Setup:** 1920x1080 (1080p 60fps), Dark Mode, browser in Fullscreen (F11) with zoom at 110%–125%.
- [ ] **Pair Phone Remote:** Open `http://<your-local-ip>:4317/remote.html` on your phone over Wi-Fi and verify one-tap approval works.
- [ ] **ComfyUI Bridge:** Verify right-click on an image output in ComfyUI (`:8188`) shows `✦ Frameforge → Animate this`.
- [ ] **Audio Mix:** Duck BGM to -24 dB during voiceover; swell to -14 dB during transitions; normalize master to -14 LUFS.
