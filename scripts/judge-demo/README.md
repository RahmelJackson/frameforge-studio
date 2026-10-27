# Frameforge judge demo

An invitation-only version of the actual Frameforge website, with a visible seven-run allowance bar. Home, Library, Images, Video, film tools and Audio use the same pages as the creator’s studio. Each signed browser visitor receives a separate data folder and loopback studio process; only installed models and the existing local engine are shared.

Start Frameforge and ComfyUI first. From the source checkout, run `node scripts/judge-demo/server.mjs`. It listens only on `127.0.0.1:4329`. The normal studio remains on port 4317.

The first start creates an access code, session secret, expiry and job ledger under `data/judge-demo/state.json`. That file is private and must not be committed or uploaded. The default allowance is seven submissions per browser visitor, within a shared cap of 35 submissions and the expiry is 14 days. The creator can supply the code privately to judges. A link ending in `#access=CODE` signs in and immediately removes the fragment from the visible page; the code is not sent as an HTTP URL path or query. Access then uses an HttpOnly, SameSite cookie. Treat the code as a private invitation.

The full website is available after invitation sign-in, including graph inspection/export, the workflow guide and visitors’ own saved work. The creator’s personal library, machine settings, credentials and direct ComfyUI endpoint remain private. Shared local generation is bounded: two-second video previews, fast camera sampling, short video edits, 300 speech characters / four dialogue lines, preview images and at most 2× upscaling. Batch renders and custom graph execution are excluded on the shared GPU; graphs remain downloadable for a visitor’s own installation. Cloud and Civitai handoffs use the visitor’s own external accounts and do not spend the creator’s credits. The hosted assistant uses guided catalog matching without loading an LLM on the shared GPU.

One judge job runs at a time, across all visitor workspaces and the legacy demo endpoint. Simultaneous submissions are checked under a persistent server-side reservation lock. Busy/offline requests reserve no run. The allowance bar polls every five seconds and tells a waiting visitor to retry when the engine is free; it does not automatically submit their prompt. Accepted failures and ambiguous submissions retain their budget slot, and uncertain acknowledgements pause new runs until reconciled or inspected. Retrying the same UUID cannot generate or charge twice. Browser cookies identify visitor sessions rather than verified people; the shared 35-run cap also remains enforced.

Uploads are limited to 12 MiB each, 64 MiB per visitor and 256 MiB for the invitation ledger. Images are limited to 1.5 megapixels / 2048 pixels per side, footage to 10 seconds / 1280 pixels per side, and WAVs to 30 seconds. Mutations are rate limited. Session data is stored beneath the existing private judge state folder and excluded from GitHub. Do not erase the active ledger to reset allowances. The owner may inspect demo data locally.

The three deliberately published model examples and their workflows remain visible. Personal judge results require that visitor’s session. No arbitrary proxy, shell, installation, machine discovery, connection editing or private owner-data route is exposed. Review remains a human decision.

## Publishing

Use a dedicated HTTPS tunnel to **this judge port only**, never to the full studio or ComfyUI. Set `JUDGE_PUBLIC_ORIGIN` to the exact published HTTPS origin before accepting public requests. Unknown host headers and cross-site requests are refused. Public session cookies require HTTPS. Port 4329 stays bound to loopback.

Example environment options: `PORT`, `FRAMEFORGE_ROOT`, `JUDGE_STATE_DIR`, `JUDGE_BACKEND` (loopback HTTP only), `JUDGE_PUBLIC_ORIGIN` (one exact HTTPS origin), and `JUDGE_FULL_STUDIO=0` to temporarily restore the older limited interface. No cloud account keys are needed. Publishing the tunnel is a separate action, with the creator's approval after reviewing the local demo.

For a self-hosted judging link, this PC, the studio, engine, judge process and tunnel must remain running and the PC must stay awake. A static GitHub Pages page cannot execute these local GPU jobs. Hosting the same app on a rented GPU avoids that uptime dependency, but requires a separate deployment and budget.

## Verification

Run `npm run test:judge`. Tests use a fake local engine and check sign-in, Host/Origin rejection, request deduplication, quota exhaustion and private job/media isolation. Run a separate real job before publication. Do not reset an active judge ledger to hide or retry an uncertain submission.

## Provider bonus evidence

The exact upstream LTX, FLUX 3 and MiniMax H3 graphs and provenance are in `workflows/bonus/`. The graphs are preparation assets. The site can display saved, technically checked local LTX 2.5, FLUX 3 Image Klein and MiniMax H3 test results. Neither graphs nor a narrow test establish contest eligibility or general creative quality. A qualifying submission must use the named model as its core generator, save its actual result and reproducible workflow, and demonstrate that result. Model terms are separate from this application's MIT license.

The visitor allowance uses a signed browser cookie, not a person’s identity. Clearing cookies or using another browser starts another visitor session; the shared 35-run cap remains in force. Reopening the invitation in the same browser preserves that visitor’s allowance. A migrated older demo session may need to reopen the existing invitation once.
