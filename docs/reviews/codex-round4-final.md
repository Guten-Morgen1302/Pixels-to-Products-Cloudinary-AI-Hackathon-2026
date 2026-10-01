# codex-round4-final (Codex gpt-5.6-terra, read-only, 2026-10-01)

Verbatim output. Every finding is resolved in docs/designs/realstage.md → "Outside Voice Round".

- R3-1 cutout geometry — RESOLVED. Later authoritative text makes `e_background_removal/e_trim/f_png` canonical, derives `_core` at identical dimensions, and computes coverage as trimmed opaque pixels ÷ original frame area.
- R3-2 deletion — RESOLVED. Cleanup specifies `delete_resources_by_tag(..., { invalidate: true })` and T-X10 requires a deployed cron, Admin not-found result, and CDN-delivery check; it is an acceptable named production gate.
- X10 blurred-backdrop upscale claim — RESOLVED. The guarantee now excludes only the intentionally scaled, blurred backdrop; the stage/product layer uses `c_limit` at native 1024px and outputs are labelled “Social preview.”

New P1 blockers: None.

Scores:

| Dimension | Score | Remaining gap |
|---|---:|---|
| IA | 10 | — |
| States | 9 | Pending/error/paused visual treatments are described functionally but not fully component-specified; closable on paper. |
| Journey | 10 | — |
| AI-slop resistance | 9 | The art direction is strong, but actual stage quality can only be proven after generation/bake-off. |
| Design system | 10 | — |
| Responsive + a11y | 9 | Mobile behavior and semantics are specified; cross-device and assistive-technology validation is only possible after implementation. |

Recommendation: start implementation because the authoritative Outside Voice Round resolves all three prior blockers and leaves only an explicit post-deploy verification gate.
