# Find a workflow and follow it through the studio

Updated October 27, 2026. The main navigation has five destinations. Top bar and Side bar remain mutually exclusive, and both expose the navigation switch, Local only control and My work link.

| Workspace | Purpose | Start here |
| --- | --- | --- |
| Home | Start, continue and discover inspiration | Describe an idea in the guide box, use a quick start, reopen recent work or browse community examples. |
| Library | Different tasks and their model options | Choose a task, compare model/run-location options, inspect the exact graph and get setup/downloads. My work is the separate saved-results view. |
| Images | Stills and reference organization | Create & edit, saved images, moodboards, characters, photo sets and scene references. |
| Video | Clips and film projects | Generate, Edit & finish, Story, Director and Timeline. A secondary row holds the current page's clip utilities. |
| Audio | Voice, words and dialogue | Speech, transcription, translation, dubbing and lip sync with the actual source material. |

## One Studio guide

Studio guide, Ctrl+K, the Home idea box and Help me choose buttons all open the same non-modal side panel.

- Typing searches supported tasks immediately. No model or generation is needed.
- Enter asks for a suggested plan. Guided matching works without an LLM; choose a connected local model under Answer with for conversational planning.
- With an empty question, starting-material chips and task choices suggest a compatible route for Studio, your ComfyUI editor or an external provider.
- The plan remains open when following a tool link. Close the panel to reclaim its space. The plan is kept in this browser tab's session and Clear plan removes it.
- Model-server and agent connection settings live in Setup. The guide only suggests routes; it does not run media jobs, download models or spend credits.

## Video and film context

The five main steps are always in the same order: Generate, Edit & finish, Story, Director and Timeline. Saved clips, Compare takes, Make variations, References, Checks and other creation utilities are below them on Generate. Edit & finish exposes its own edited clips and narrated storyboard. Existing deep links and panel controls remain supported.

Opening a saved film shows its name, working storyboard shot and next incomplete stage in the project bar. Selecting a working shot carries that context into the main steps. Single clip mode leaves the film context.

In Story, save plan edits before following Generate this shot. The generation tool loads the saved shot notes. If those notes are empty, it can reuse the selected take's original prompt and available image reference. It does not fabricate a brief or start a render. Review the controls before generating.

After selecting a checked clip, Use selected clip for this shot saves only that frame's take selection. The existing saved-story signature rejects stale updates from another tab. Media approval and assembled-film review remain separate; selecting a take does not approve it or rebuild the timeline automatically.

Director still has a separate production plan. Its approved-take assembly creates a film; grouping the views does not silently merge unrelated plans.

## Home and inspiration

Home is ordered as Start, Continue, local model examples and Inspiration. The short getting-started explanation appears on the first visit and can be dismissed. New installations without saved work get a setup starting point in Continue.

The full Civitai browser includes image/video and sort filters, shared prompts, creator/model links and prompt handoffs into the guide or a tool. It requests community metadata when the section enters view. Local only disables the external feed. Remote pictures and playback depend on the source and the browser's independent media policy; source links remain available.

Old /explore links redirect to Home's inspiration section and preserve filter parameters. Old studio-recipe links redirect to Library. Home's original artwork and motion remain separate from community work and from saved model test results.

## Verification scope

Source tests cover distinct workflow grouping, legacy redirects, five-step navigation, valid project/shot context, non-mutating take selection, saved-story persistence and stale-tab rejection. Browser checks cover instant guide search, guided planning without inference, a plan surviving a tool handoff, the inspiration browser and a saved shot brief opening in Generate. No new paid Cloud run or creative-quality acceptance is implied by these interface checks.
