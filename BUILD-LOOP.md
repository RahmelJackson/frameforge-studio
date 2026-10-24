# Build, generate, inspect, improve

The first milestone is a local image-to-video studio: real upload, real ComfyUI render, motion presets, persistent library, downloadable MP4, technical evidence, and a distinct visual review. The running app does this. Further feature expansion follows FEATURE-MAP.md and a chosen next milestone.

## Loop contract

1. Read the current evidence and choose one observable failure or accepted feature.
2. Reproduce it on the real surface. Record the expected result before changing implementation.
3. Make one narrow change. Keep the model, seed, input image, and generation settings fixed unless the hypothesis explicitly concerns one of them.
4. Run relevant tests. `npm run verify` checks application behavior and engine readiness without spending GPU time.
5. For generation changes, render one bounded preview and inspect its actual output. `node scripts/verify-loop.mjs --render` runs the first fixed benchmark; `--resume` reconnects to the saved run. Archive a completed evidence state intentionally before a new benchmark.
6. Inspect playback, the six-frame contact sheet, and the check report. Technical success alone does not satisfy movement or visual quality.
7. Record the hypothesis, change, evidence paths, result, and next action. Keep a failed candidate separate from the accepted baseline. After two failed fixes sharing a premise, test that premise instead of repeating it.
8. Stop when the chosen acceptance criteria pass, when the bounded render limit is reached, or when a named external prerequisite is unavailable. Never weaken the criterion to end the loop.

## Four evidence levels

- **App check:** tests cover graph validity, request validation, host/origin controls, upload type rejection, job deduplication, approval gates, and media-check positive/negative controls.
- **Engine check:** ComfyUI actually exposes every required node and the three model files.
- **Artifact check:** the real saved video decodes with the expected frames, dimensions, frame rate, and timestamps. Save SHA-256 and sampled frames.
- **Creative check:** watch the clip; inspect identity, requested motion, flicker, anatomy/geometry, and composition. Log uncertain findings as uncertain. Only deliberate review marks a take approved.

## Persistence and recovery

The studio stores job parameters before submitting the workflow, then stores the returned ComfyUI prompt ID. On restart it monitors that same job. An interruption during an unacknowledged submission is ambiguous; it becomes `needs-attention`, and the loop must inspect engine history before any new generation. It must not automatically replay a possibly successful submission.

The CLI state is `evidence/live-state.json`. The app queue is under `data/jobs/`. Local server shutdown pauses monitoring; ComfyUI may continue rendering. Relaunch the studio to collect its existing output. The CLI stops polling after 30 minutes. It does not cancel or duplicate an in-progress render.

## Improving the workflow itself

Keep a small set of portrait, architecture, landscape, and product references. Use a fixed rubric and held-out prompts. Compare acceptance rate, failure types, render time, and GPU memory before and after a change. Repeat stochastic comparisons. Preserve baselines and checksums. Promote a new skill or workflow only when it improves the chosen metric without regressing the others. A self-critique is a proposed explanation, not evidence.

This loop is executable locally and has been run for the initial milestone. It is not a background agent that rewrites the application indefinitely. A scheduled agent can invoke it later with a bounded milestone and render budget.
