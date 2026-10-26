# Frameforge judge demo

An isolated, invitation-only front end for a small set of real Frameforge jobs. It shares the existing local engine but does not expose the complete studio server.

Start Frameforge and ComfyUI first. From the source checkout, run `node scripts/judge-demo/server.mjs`. It listens only on `127.0.0.1:4329`. The normal studio remains on port 4317.

The first start creates an access code, session secret, expiry and job ledger under `data/judge-demo/state.json`. That file is private and must not be committed or uploaded. The default allowance is seven submissions per browser visitor, within a shared cap of 35 submissions and the expiry is 14 days. The creator can supply the code privately to judges. A link ending in `#access=CODE` signs in and immediately removes the fragment from the visible page; the code is not sent as an HTTP URL path or query. Access then uses an HttpOnly, SameSite cookie. Treat the code as a private invitation.

The demo allows only a square Z-Image preview, a short Wan animation of bundled original artwork, or a bounded Kokoro narration. No user-supplied graph, installation, engine configuration, model download, paid submission, personal-library listing or file upload endpoint is exposed. One judge job runs at a time. Simultaneous submissions are checked under a server lock. A busy response reserves no run and asks the other judge to wait. The interface checks availability every five seconds and enables the button when it is free; it never silently submits a waiting prompt. Ambiguous submissions pause new runs until the creator inspects them. A persistent UUID request ledger prevents accidental repeat submissions. Offline/busy preflight and definite submission rejections cost no run. Accepted failures and ambiguous submissions retain a budget slot for inspection. Lost acknowledgements reconcile against the studio request ID; uncertain submissions are never blindly retried. All upstream generation uses the strict open-weight input profile.

The outer page and original concept artwork are viewable before sign-in. A fixed showcase of the three saved local bonus results is public. Personal judge results require the invite session and that visitor’s ownership in this judge ledger. Job responses omit personal paths, unrelated records and full internal reports. Prompts, quotas and expiries are enforced by the server, not merely by the interface. Review and approval remain human tasks.

## Publishing

Use a dedicated HTTPS tunnel to **this judge port only**, never to the full studio or ComfyUI. Set `JUDGE_PUBLIC_ORIGIN` to the exact published HTTPS origin before accepting public requests. Unknown host headers and cross-site requests are refused. Public session cookies require HTTPS. Port 4329 stays bound to loopback.

Example environment options: `PORT`, `FRAMEFORGE_ROOT`, `JUDGE_STATE_DIR`, `JUDGE_BACKEND` (loopback HTTP only), and `JUDGE_PUBLIC_ORIGIN` (one exact HTTPS origin). No cloud account keys are needed. Publishing the tunnel is a separate action, with the creator's approval after reviewing the local demo.

For a self-hosted judging link, this PC, the studio, engine, judge process and tunnel must remain running and the PC must stay awake. A static GitHub Pages page cannot execute these local GPU jobs. Hosting the same app on a rented GPU avoids that uptime dependency, but requires a separate deployment and budget.

## Verification

Run `node --test scripts/judge-demo/server.test.mjs`. Tests use a fake local engine and check sign-in, Host/Origin rejection, request deduplication, quota exhaustion and private job/media isolation. Run a separate real job before publication. Do not reset an active judge ledger to hide or retry an uncertain submission.

## Provider bonus evidence

The exact upstream LTX, FLUX 3 and MiniMax H3 graphs and provenance are in `workflows/bonus/`. The graphs are preparation assets. The site can display saved, technically checked local LTX 2.5, FLUX 3 Image Klein and MiniMax H3 test results. Neither graphs nor a narrow test establish contest eligibility or general creative quality. A qualifying submission must use the named model as its core generator, save its actual result and reproducible workflow, and demonstrate that result. Model terms are separate from this application's MIT license.

The visitor allowance uses a signed browser cookie, not a person’s identity. Clearing cookies or using another browser starts another visitor session; the shared 35-run cap remains in force. Reopening the invitation in the same browser preserves that visitor’s allowance. A migrated older demo session may need to reopen the existing invitation once.
