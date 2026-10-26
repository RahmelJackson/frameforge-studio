# Frameforge judge demo

An isolated, invitation-only front end for a small set of real Frameforge jobs. It shares the existing local engine but does not expose the complete studio server.

Start Frameforge and ComfyUI first. From the source checkout, run `node scripts/judge-demo/server.mjs`. It listens only on `127.0.0.1:4328`. The normal studio remains on port 4317.

The first start creates an access code, session secret, expiry and job ledger under `data/judge-demo/state.json`. That file is private and must not be committed or uploaded. The default allowance is 10 submissions and the expiry is 14 days. The creator can supply the code privately to judges. A link ending in `#access=CODE` signs in and immediately removes the fragment from the visible page; the code is not sent as an HTTP URL path or query. Access then uses an HttpOnly, SameSite cookie. Treat the code as a private invitation.

The demo allows only a square Z-Image preview, a short Wan animation of bundled original artwork, or a bounded Kokoro narration. No user-supplied graph, installation, engine configuration, model download, paid submission, personal-library listing or file upload endpoint is exposed. One job runs at a time. A persistent UUID request ledger prevents accidental repeat submissions. Failed or ambiguous submissions retain their budget slot for inspection. All upstream generation uses the strict open-weight input profile.

The outer page and original concept artwork are viewable before sign-in. Saved generated media requires the invite session and ownership in this judge ledger. Job responses omit personal paths, unrelated records and full internal reports. Prompts, quotas and expiries are enforced by the server, not merely by the interface. Review and approval remain human tasks.

## Publishing

Use a dedicated HTTPS tunnel to **this judge port only**, never to the full studio or ComfyUI. Set `JUDGE_PUBLIC_ORIGIN` to the exact published HTTPS origin before accepting public requests. Unknown host headers and cross-site requests are refused. Public session cookies require HTTPS. Port 4328 stays bound to loopback.

Example environment options: `PORT`, `FRAMEFORGE_ROOT`, `JUDGE_STATE_DIR`, `JUDGE_BACKEND` (loopback HTTP only), and `JUDGE_PUBLIC_ORIGIN` (one exact HTTPS origin). No cloud account keys are needed. Publishing the tunnel is a separate action, with the creator's approval after reviewing the local demo.

For a self-hosted judging link, this PC, the studio, engine, judge process and tunnel must remain running and the PC must stay awake. A static GitHub Pages page cannot execute these local GPU jobs. Hosting the same app on a rented GPU avoids that uptime dependency, but requires a separate deployment and budget.

## Verification

Run `node --test scripts/judge-demo/server.test.mjs`. Tests use a fake local engine and check sign-in, Host/Origin rejection, request deduplication, quota exhaustion and private job/media isolation. Run a separate real job before publication. Do not reset an active judge ledger to hide or retry an uncertain submission.

## Provider bonus evidence

The exact upstream LTX, FLUX 3 and MiniMax H3 graphs and provenance are in `workflows/bonus/`. They are preparation assets. They establish no successful generation or contest eligibility by themselves. A qualifying submission must use the named model as its core generator, save its actual result and reproducible workflow, and demonstrate that result. Model terms are separate from this application's MIT license.
