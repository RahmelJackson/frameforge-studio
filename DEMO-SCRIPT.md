# Frameforge: 2-minute demonstration — one production, every place

Record at 1080p (or 1440p with Appearance → Text size: Default). Follow **one production** from idea to finished cut, then remix it. A complete journey is more convincing than a feature montage. Use original or cleared media. Cut render waits with a visible “time shortened” caption. Render the hero production on your own GPU before recording.

**Hero idea (example):** Desert highway preset → “a red vintage car escapes across the desert at noon”.

| Time | Show | Say | Judging criterion |
| --- | --- | --- | --- |
| 0:00–0:10 | Home → “What do you want to make?” Hover **Video** to show the hover menu. | “Frameforge is an open-source creative studio built on ComfyUI. You start from what you want to make, not from a node graph.” | Delight |
| 0:10–0:28 | **3D scene** → Desert highway preset. Scrub the timeline: the hero car drives, the camera travels with it. Drag the camera body, then **Look through camera**. | “Block the shot in 3D. Scrub to a moment, drag the car or the camera, and Studio records the motion. The camera can follow or watch any object.” | Innovation |
| 0:28–0:40 | **Make the image** → FLUX 3 turns the grey layout into a finished frame; **Make the layout clip** → Finish with Layout to Render. | “Every tagged stand-in becomes a layout box for FLUX 3, and the camera move drives LTX Layout to Render. Real open-weight models do the core work.” | Model bonus · Technical |
| 0:40–0:58 | **Produce**: pick a format, type the idea, start. Show keyframes arriving, approve, clips, narration, finished cut playing. | “Produce plans the beats and renders every keyframe, clip, narration line and caption on my GPU, one at a time, stopping for review.” | Technical |
| 0:58–1:10 | Phone: scan the **Phone remote** QR, approve a shot from the phone. | “The same production is on my phone over Wi-Fi. I can approve, remake or play the cut from the couch.” | Delight |
| 1:10–1:25 | Claude or Codex over MCP: “Remix this production: keep everything, change shot two to a night scene.” Show the preview reply (“remakes 1 keyframe and 1 clip, reuses the rest”). | “Claude works on the same production through MCP, and tells me exactly what it will remake before it runs.” | Innovation |
| 1:25–1:40 | **Remix** dialog in Studio: the reused/remade badges, then the remix finishing with only shot two re-rendered. Click **keyframe graph** on a shot. | “Any finished film can be taken apart and remixed. Only the stages that depend on your change re-render. Every shot opens as its real ComfyUI graph.” | Sharing · Technical |
| 1:40–1:52 | ComfyUI: right-click a Save Image node → **✦ Frameforge → Animate this**. Studio opens with the image loaded. | “It works the other way too. Right-click any result in ComfyUI and send it straight into Studio to animate, edit or turn into a 3D prop.” | Community usefulness |
| 1:52–2:00 | Templates with “Ready on this computer” badges, then GitHub. | “Every template says what you bring, what you get and whether it’s ready on your computer. It’s all open source.” | Community usefulness |

## Recording prompts

Produce idea: **“a red vintage car escapes across the desert at noon”** (format: A small cinematic story, 15 s, Landscape).

MCP client: **“Use Frameforge. List my productions, then preview a remix of the latest one that rewrites shot 2 as the same car at night under neon signs. Tell me what will be remade and what is reused. Don’t start it until I say so.”**

## Claims and fallbacks

- **Open weights only is not a universal “local only” or privacy switch.** It restricts reviewed execution routes; model licenses still apply.
- Comfy Cloud uses an external workflow/import handoff. Civitai uses a prompt/model-reference brief, not a ComfyUI graph import.
- Remix reuses unchanged keyframes, clips and narration and always re-cuts the film. Say “only what changed re-renders”, not “instant”.
- The phone remote is Wi-Fi only and pairs with a code; it reaches Produce actions and its results, not the full Studio or ComfyUI.
- Right-click actions on ComfyUI *preview* images need ComfyUI restarted once after the bridge update; saved outputs work immediately.
- The illustrations on starters and goal cards are original presentation artwork, not evidence of a model’s output. Use real renders for output shots.
- Check the film for black frames and play video and audio before recording. A technical pass does not prove motion or creative quality.

## Before recording

- [ ] Render the hero production fully on your GPU (keyframes, clips, narration, cut).
- [ ] Render the Desert highway still and layout clip; finish one with Layout to Render.
- [ ] Pair the phone remote on the same Wi-Fi and test one approval.
- [ ] Connect Claude or Codex over MCP and run the remix preview prompt once.
- [ ] Restart ComfyUI once so the right-click actions also work on preview images.
- [ ] Preview the final video and speech; remove any black or failed samples.
- [ ] Keep the final cut near two minutes and review the challenge checklist; this script does not submit an entry.
