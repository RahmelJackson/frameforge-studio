# Frameforge inside ComfyUI

Use the complete running Frameforge website inside ComfyUI, with its Images, Video, Audio, Library, Guide, saved work, model checks and settings. This extension connects to your existing Studio, rather than installing a second copy or a different media library.

## Install and open

1. Start Frameforge, normally at `http://127.0.0.1:4317`.
2. Copy this `comfyui-frameforge` folder into the active ComfyUI `custom_nodes` folder. For a separate `--base-directory`, use that base directory. Restart ComfyUI only when idle.
3. Open ComfyUI on the same computer. Select its Frameforge sparkle icon, then **Open full Studio**.
4. Choose **Studio** for the full app, **Split** for the app beside your graph, or **Graph** to return to ComfyUI. The graph and embedded app stay in place when switching. Drag the divider, or focus it and use arrow keys, to resize split view. Narrow windows use the full Studio layout.

**Connection** changes the local Studio address. If Studio was stopped when ComfyUI first opened, or Studio restarted on a different view address, the panel offers **Reload ComfyUI & open Studio**. Save unsaved graphs before reloading. Both apps must remain running. No weights or extra Python packages are installed by this extension.

## Bring a graph's output into the embedded editor

- Connect `FrameforgeStudioOutput` to IMAGE. It saves a PNG with graph metadata.
- Connect `FrameforgeStudioVideoOutput` to VIDEO. Use native Create Video when starting from frames. It saves MP4/H.264.
- Connect `FrameforgeStudioAudioOutput` to AUDIO. It saves one PCM16 WAV, up to five minutes, eight channels and 25 MiB.

Run the connected graph, then explicitly press **Send saved image/video/audio → Studio**. The validated file opens in the embedded Images, Video or Audio editor and also appears in My work. The original stays in ComfyUI. This does not generate more media or approve quality. Studio graphs can still be downloaded and imported into ComfyUI; simply switching to Graph does not import or replace a graph.

## Local connection and external services

The normal Studio retains its anti-framing policy. A separate loopback view permits only this exact local ComfyUI origin; ComfyUI's frame policy adds only that view's exact address. Unrelated origins, redirects, environment proxies and remote Studio addresses are refused. Upload handoffs accept only existing files inside this ComfyUI's output directory: PNG up to 20 MiB, video 100 MiB, WAV 25 MiB.

Comfy Cloud and Civitai remain external services with their own sign-in and payment. External links appear in a visible **Open website** banner. Opening Studio does not upload to them, spend credits, run a workflow or download models. Individual tools retain their existing hardware, model and processor requirements.
