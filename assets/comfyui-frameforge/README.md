# Frameforge media output bridge

Copy this folder into the active ComfyUI `custom_nodes` folder. For a separate `--base-directory`, use that base directory. Restart only when idle. No weights or extra Python packages are installed by this bridge.

- Connect `FrameforgeStudioOutput` to IMAGE. It saves a PNG with graph metadata.
- Connect `FrameforgeStudioVideoOutput` to VIDEO. Use native Create Video when starting from frames. It saves MP4/H.264.
- Connect `FrameforgeStudioAudioOutput` to AUDIO. It saves one PCM16 WAV, up to five minutes, eight channels and 25 MiB.

Run the graph, then explicitly press Send saved image/video/audio to Frameforge. The file is validated by Studio and opens in Images, Video or Audio. Imports appear in My work. This does not generate more media or approve quality.

Both apps must run on the same machine. Only loopback Studio addresses and existing files inside this ComfyUI output directory are allowed. Redirects, environment proxies and remote URLs are refused. PNG limit 20 MiB, video 100 MiB, WAV 25 MiB. The bridge cannot browse arbitrary files or contact Cloud services.
