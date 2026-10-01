# codex-round2-verification (Codex gpt-5.6-terra, read-only, 2026-10-01)

Verbatim output. Every finding is resolved in docs/designs/realstage.md → "Outside Voice Round".

Several fixes are specified, but X2–X4, X6–X7, X10, and X12 remain materially open.

- X1 — RESOLVED: “Use the standard tier only… Free check #1… gates every spend.”
- X2 — NOT RESOLVED: “Two pools” is declared, but no enforced build-pool ceiling preserves the physical 50-credit quota for production.
- X3 — NOT RESOLVED: “Cloudinary’s uniqueness… is the atomic primitive” is assumed; the planned fake-client race test cannot verify Cloudinary atomicity or `existing:true`.
- X4 — NOT RESOLVED: “confirm `res.cloudinary.com` CORS allows the fetch” is only a planned check; `fl_attachment` availability on Free is not gated or demonstrated.
- X5 — RESOLVED: exact `image_to_image` body specifies `reference_images`, `[1]`, model, dimensions, seed, target, and async.
- X6 — NOT RESOLVED: the server “claims an upload slot” before upload, while per-session caps remain deferred—one client can mint and abandon all 100 slots.
- X7 — NOT RESOLVED: cron deletes only `exp-<date>` assets, but kit flow says “4 derived files tagged `kit-<id>`,” without requiring expiry tags on final/kit derivatives.
- X8 — RESOLVED: “100 uploads ≈ 11” credits plus build/library/buffer allocation and `api.usage() >= 20` backstop.
- X9 — RESOLVED: “Measure coverage on the untrimmed cutout… Reject only if < 1%… or > 98%.”
- X10 — NOT RESOLVED: it says 1K avoids upscale, yet calls “WhatsApp 1080²… unaffected”; 1024→1080 is still upscaling.
- X11 — RESOLVED: `scripts/check-cutout.ts` materializes a real cutout, checks alpha, trim, dimensions, retries, and deletes test assets.
- X12 — NOT RESOLVED: it explicitly says “Scope stays”; provenance improves Track-2 proof but does not reduce the platform-sized delivery risk.
- X13 — RESOLVED: Compare is now “two same-size crops side by side… identical scale,” with touch/keyboard/screen-reader support.
- X14 — RESOLVED: post-task `api.update` adds `lib` or `session-<id>,exp-<date>` plus geometry before display.

- D1 — RESOLVED: “Library cards… ‘Free to use’; no credit numbers.”
- D2 — NOT RESOLVED: the decision requires `position:fixed`, but `sketch.html` implements `.bar { position:absolute }`.
- D3 — RESOLVED: wireframe v3 uses declared fonts/tokens, real buttons, labelled upload input, radio roles, and focus rings.
- D4 — RESOLVED: “All text uses `--ink-2 #5B6270` or darker.”
- D5 — RESOLVED: “Wireframe v3 adds a 900 px frame.”
- D6 — RESOLVED: Compare is explicitly tap/Enter accessible.
- D7 — RESOLVED: art direction names concrete Indian daylight surfaces and a fixed prompt ending.

New material issues:

- P1: The create-if-absent slot scheme is not proven. The plan assumes `overwrite:false` returns `existing:true` and is globally atomic; neither real-account verification nor a failure-safe alternative is specified.
- P1: Upload-slot reservation is denial-of-service prone: signing, not completed upload, consumes one of only 100 permanent judging-window slots.
- P1: The seven-day deletion promise is still incomplete unless `_cut`, `_core`, materialized finals, and all four kit derivatives are explicitly assigned the same `exp-*` tag.
- P1: Delivery depends on two unverified Free-tier properties: `fl_attachment` behavior and browser CORS for Cloudinary delivery URLs. The old archive check also remains in Budget Lock despite archives being “dropped entirely.”
- P2: The fixed-bar mismatch is across separate documents, so the realstage.md precedence rule does not repair the actual wireframe.
- P2: The 1K social-output rules need exact `c_pad` transforms and labels for WhatsApp too; otherwise the claimed no-upscale guarantee is false.

Scores: IA 8/10; states 8/10; journey 8/10; AI-slop resistance 7/10; design system 7/10; responsive + a11y 7/10.

Recommendation: block implementation until real-account checks validate slot semantics and Free-tier download/CORS behavior, because those assumptions currently govern spend caps, public availability, and the only delivery path.
