# Frameforge inside ComfyUI

Use the complete running Frameforge website inside ComfyUI, with its Images, Video, Audio, Library, Guide, saved work, model checks and settings. This extension connects to your existing Studio, rather than installing a second copy or a different media library.

## Install and open

1. Start Frameforge, normally at `http://127.0.0.1:4317`.
2. Copy this `comfyui-frameforge` folder into the active ComfyUI `custom_nodes` folder. For a separate `--base-directory`, use that base directory. Restart ComfyUI only when idle.
3. Open ComfyUI on the same computer. Select its Frameforge sparkle icon, then choose a **Quick tool** or press **Alt+Shift+F**.
4. Quick opens the selected tool first. Choose **Full Studio** for the full app, **Split** for the app beside your graph, or **Graph** to return to ComfyUI. The graph and embedded app stay in place when switching. Drag the divider, or focus it and use arrow keys, to resize split view. Narrow windows use the full Studio layout.

**Connection** changes the local Studio address. If Studio was stopped when ComfyUI first opened, or Studio restarted on a different view address, the panel offers **Reload ComfyUI & open Studio**. Save unsaved graphs before reloading. Both apps must remain running. No weights or extra Python packages are installed by this extension.

## Bring a graph's output into the embedded editor

- Connect `FrameforgeStudioOutput` to IMAGE. It saves a PNG with graph metadata.
- Connect `FrameforgeStudioVideoOutput` to VIDEO. Use native Create Video when starting from frames. It saves MP4/H.264.
- Connect `FrameforgeStudioAudioOutput` to AUDIO. It saves one PCM16 WAV, up to five minutes, eight channels and 25 MiB.

Run the connected graph, then explicitly press **Send saved image/video/audio → Studio**. The validated file opens in the embedded Images, Video or Audio editor and also appears in My work. The original stays in ComfyUI. This does not generate more media or approve quality. Studio graphs can still be downloaded and imported into ComfyUI; simply switching to Graph does not import or replace a graph.

## Local connection and external services

The normal Studio retains its anti-framing policy. A separate loopback view permits only this exact local ComfyUI origin; ComfyUI's frame policy adds only that view's exact address. Unrelated origins, redirects, environment proxies and remote Studio addresses are refused. Upload handoffs accept only existing files inside this ComfyUI's output directory: PNG up to 20 MiB, video 100 MiB, WAV 25 MiB.

Comfy Cloud and Civitai remain external services with their own sign-in and payment. External links appear in a visible **Open website** banner. Opening Studio does not upload to them, spend credits, run a workflow or download models. Individual tools retain their existing hardware, model and processor requirements.

## Quick tools and graph handoff

The compact **F↗ Quick tools** toolbar stays available on the graph. Pick Video, Images or Audio to jump to the matching editor. **Full Studio** returns to the complete interface; **Export graph** downloads the current native graph JSON. The same quick menu is available from the embedded mode bar and the Frameforge sidebar.

Beside the selected workflow’s model check, **Open graph in ComfyUI** prepares the current settings, checks input hashes, uploads inputs using unique filenames and opens the graph in a separate ComfyUI tab. It refreshes the native file picker first. Existing graph tabs remain available. Review missing nodes/models and press Run yourself. Library graphs and the local LTX/FLUX/H3 sample details have the same handoff. Starter graphs without prepared files still need their placeholder media selected. A generation-stage graph does not include Studio’s later protected-pixel, timing or audio finalization.

Direct handoff supports native canvas and API-format graphs up to 4 MiB and 500 nodes, with up to 20 PNG/JPEG/WebP/MP4/WebM/WAV inputs, 80 MiB per input and 100 MiB total. Larger or nonportable pipelines retain the download package or their Studio controls. In the regular website, the adjacent **Workflow + inputs** button downloads the current graph, inputs and model list as a package. No render or model download starts from an export or handoff.

## Quick workspace (0.8.7)

Start with **Quick tools** in ComfyUI, or press **Alt+Shift+F**. Pick Images, Video, Audio or 3D. A tool opens in **Quick** by default, beside the graph on a wide screen. Quick uses the actual Studio forms with upload, settings, per-workflow downloads, generation and separate **Controls / Result** views. **Full Studio** expands the same page without reloading it or clearing inputs. **Graph** returns to the canvas. The shortcut also works while focus is inside Quick.

Preparing a supported local Studio graph, including when generating in Quick, copies the current graph and its inputs to a separately named ComfyUI tab. It does not overwrite your other workflows. This is a snapshot at preparation time, not live two-way editing: changes made directly in ComfyUI are not copied back into Studio. Studio processors without a portable graph remain usable in Quick; their final processing steps stay in Studio.

The new native workflow controls cover 3D props, scene meshes, background removal, music, talking photographs, H3 reference/control modes, FLUX creation/layout and LTX adapters. Choose inputs and simple settings, then **Prepare & open in ComfyUI**. Use the native graph's controls for tracks, layout boxes and guide timing, and press ComfyUI's **Run**. These are pinned upstream graphs, not a claim that every model is installed or every output quality-tested. LTX custom-node graphs can include optional API branches and are excluded from the reviewed open-weights filter. Nothing collects an API key here.
