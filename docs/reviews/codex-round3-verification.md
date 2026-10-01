# codex-round3-verification (Codex gpt-5.6-terra, read-only, 2026-10-01)

Verbatim output. Every finding is resolved in docs/designs/realstage.md → "Outside Voice Round".

Applied the precedence rule: Outside Voice Round controls over earlier sections.

- X2 — RESOLVED: build scripts refuse any spend that would leave fewer than 21 credits, physically reserving 15 production credits plus the 6-credit floor.
- X3 — ACCEPTED-RISK: `check-slots.ts` must prove one winner in an 8-way race; failure forces `LIVE_AI=off`, retaining the zero-credit path.
- X4 — RESOLVED: CDN CORS and `fl_attachment` have a public probe plus an own-cloud check; individual direct downloads remain the export fallback.
- X6 — ACCEPTED-RISK: a script can exhaust the 200 signing slots; uploads pause, while samples and library stages keep the demo usable.
- X7 — NOT RESOLVED: deleting tagged assets is specified, but neither CDN invalidation nor a deployed-cron execution check is specified; public derived URLs may remain cached after the promised deletion.
- X10 — NOT RESOLVED: the claimed no-upscale recipe starts with `c_fill,w_1080,h_...` on a 1024px final, which upscales the source for the blurred background—including WhatsApp.
- X12 — RESOLVED: v1 has a concrete Oct 2 deployment gate and a defined Oct 3 fallback that cuts phase 2, not the working Track-2 fan-out.
- D2 — RESOLVED: the standalone mobile mockup uses an actual fixed bar, safe-area padding, and matching document bottom padding.

New blocking issues:

- P1 — Cutout geometry is still internally contradictory: the pipeline materializes `_cut` as `e_background_removal/f_png`, while placement assumes it is `e_trim`med. This will mis-size and misplace products unless materialization includes `e_trim` and `_core` retains identical dimensions.
- P1 — The seven-day deletion promise needs `invalidate:true` (or non-cacheable/signed delivery) and a production cron proof, not only a cleanup unit test.

Design rescore:

| Dimension | Score | What stops 10 |
|---|---:|---|
| IA | 9 | Core cutout geometry contradiction threatens the central “product on stage” hierarchy. |
| States | 9 | Retention/deletion failure lacks a user-safe fallback state. |
| Journey | 8 | The trust moment depends on geometry and real staged-image quality not yet validated. |
| AI-slop | 8 | Stage imagery remains untested; several scene prompts still risk looking like generic generated product backdrops. |
| Design system | 9 | Strong tokens/contracts, but no implemented visual QA confirms them under real images and failure states. |
| Responsive + a11y | 9 | Specifications are strong, but keyboard radio behavior and fixed-bar behavior are only planned/mockup-tested. |

Recommendation: amend the plan before implementation because the current cutout transform contradiction and unverified deletion semantics can break the product’s core placement and privacy promise.
