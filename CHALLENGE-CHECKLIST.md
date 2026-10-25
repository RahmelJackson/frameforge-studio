# Open Source Higgsfield submission

Source of truth: [official Comfy challenge](https://comfy.org/open-source-higgsfield), checked October 24, 2026. The deadline shown there is **October 30, 2026, 9am Pacific / noon Eastern**. Winners are scheduled for November 6. Recheck the page before submitting.

## Qualification and deliverables

- [x] ComfyUI is the actual image/video engine, with downloadable native graphs and source/model requirements. The rules allow entirely local builds; Cloud hosting is optional.
- [x] Public source: https://github.com/RahmelJackson/frameforge-studio . MIT for original code, upstream notices retained.
- [x] Setup guide explains a source-only install with your own engine and separate model downloads. No weights, personal media, machine config or secrets belong in the public snapshot.
- [x] Optional agent interface: local STDIO MCP, discovery, editable graphs, generation, preview and production tools. Website remains usable independently.
- [x] Explicit local open-weight profile, with a locked launcher and server-side checks. This is an implementation feature, not an organizer eligibility ruling.
- [ ] Reproduce the selected demonstration from a clean machine/setup and the published commit. Record versions, actual model hashes, node dependencies and measured resource use. Fresh source-only setup checks do not prove every Python/GPU pipeline is portable.
- [ ] Choose original or properly licensed demonstration media; obtain any necessary likeness rights. Keep the submission SFW. Review all upstream model terms.
- [ ] Record a **demo no longer than two minutes**, showing the real app and actual result. Explain the unusual contribution and any additional tools/models used.
- [ ] Register using the challenge's [signup form](https://form.typeform.com/to/Ayn9Cwfj).
- [ ] Publish a social post linking the demo and tagged **#OpenSourceHiggsfield**. The listed platforms include X, Reddit, Instagram, LinkedIn, YouTube and TikTok.
- [ ] Submit the repository, demo and required links through the [entry form](https://form.typeform.com/to/V1dSQrkS) before the deadline. The rules specify one submission per person.
- [ ] Read the current full terms, including permission for ComfyUI and named partners to feature the entry with credit. Confirm any account/entrant restrictions in the live forms. No claim of guaranteed eligibility is made here.

No signup, social publication or final entry submission is automated by this repository. Those are owner actions.

## Compared with the official examples

[COMFY-HUB-COMPARISON.md](COMFY-HUB-COMPARISON.md) distinguishes our existing alternatives from the exact Cinematic Studio, Re-shoot, Openjutsu and Hub pipelines. Those example apps are inspiration, not a requirement to implement every catalog item. Re-shoot/CrossView/H3 and SCAIL-2 are not marked implemented merely because we have related camera or motion tools.

## Where this entry can stand out

**Demonstrate one coherent path, not the number of tabs.** The useful contribution is a guided creative layer that explains a workflow, checks a user's existing engine, supplies model links, exposes the editable graph and lets a website or an MCP client operate the same saved production work. Technical verification and human creative approval remain separate.

Suggested 115-second demo:

1. **0–15s:** State the problem: a promising workflow is difficult to understand, install and connect to a finished piece.
2. **15–35s:** Turn on the locked open-weight profile. Choose a recipe by intended result; show its explanation and exact model/setup requirements.
3. **35–60s:** Show an MCP client discovering/preparing the same graph; open it in the website/native ComfyUI. Explain that this is one shared local job system.
4. **60–85s:** Show an actual completed local render, its settings and checks. Use a disclosed time cut for generation; never present a placeholder as generated footage.
5. **85–105s:** Carry the result into a film/speech workflow and show a real export. State the narrow tested scope and visible quality limits.
6. **105–115s:** Show the public repo, startup commands and model sources. End on the finished artifact and the contribution.

An end-to-end MCP client recording, reproducible example graph/input packet, clean setup proof and a short finished result will help more than adding another unverified tool. Do not silently reuse private library media in public screenshots or demos.

## Categories and honest limits

- **Best Overall:** every entry is considered by the official rules; quality and completeness still matter.
- **Most Innovative:** the demo needs to explain what is novel. Describe the shared guided/MCP/graph/verification loop concretely; do not claim no one has built a similar tool.
- **Most Viral:** polished onboarding and a small shareable example can support this, but audience response cannot be promised.
- **Open Weights Only:** demonstrate no partner-node or closed-API generation. The ordinary app retains optional provider handoffs; obtain organizer clarification about a mixed-provider repository plus locked profile. [Exact profile scope](OPEN-WEIGHTS.md).
- **LTX / FLUX / MiniMax bonuses:** the official page requires the named model to be the core model in the qualifying workflow. The current Wan/Qwen/Z-Image demonstration does not establish those bonuses. Merely adding a download link or partner template is insufficient.

The broad image/video/speech quality goals remain tracked separately in `REMAINING-CHECKLIST.md`. Their unresolved status must not be hidden by successful software tests.
