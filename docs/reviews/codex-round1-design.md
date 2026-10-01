# codex-round1-design (Codex gpt-5.6-terra, read-only, 2026-10-01)

Verbatim output. Every finding is resolved in docs/designs/realstage.md → "Outside Voice Round".

Overall: HYBRID. The pre-upload surface is a marketing/landing composition; the studio and mobile studio are app UI.

Hard rejection: **none triggered.** The landing is one composed scene with a clear upload action; the studio’s three cards are necessary selectable model options, not a generic SaaS grid.

Litmus checks:

1. Brand/product unmistakable in first screen? **YES** — RealStage, the product-specific headline, upload CTA, and before/after make the purpose clear.
2. One strong visual anchor present? **YES** — the before/after pair on landing; the selected staged product in-app.
3. Page understandable by scanning headlines only? **YES** — headline, “Export kit,” and marketplace labels communicate the flow.
4. Each section has one job? **YES** — upload, choose stage, export.
5. Are cards actually necessary? **YES** — stage cards are mutually exclusive model choices.
6. Does motion improve hierarchy or atmosphere? **YES** — the single cutout-to-stage reveal reinforces the core promise.
7. Would design feel premium with all decorative shadows removed? **YES** — it deliberately relies on spacing, type, borders, and imagery instead.

Key findings:

1. **Credit language makes the zero-cost default path look costly.** The header says “Live AI left today: 7,” while each pre-rendered stage advertises “6 cr / 4 cr / 5 cr.” This contradicts the plan’s zero-generation-credit library path and its global, not daily, reserve. Users will hesitate to select stages or assume they are spending scarce credits. Fix: label library options “Library stage · $0 to use,” reserve credits only for relight/new-generation actions, and make “Generate 3 new stages” disclose its exact spend before activation. Evidence: [sketch.html](/C:/Hackathons/Pixels%20to%20Products%20%E2%80%94%20Cloudinary%20AI%20Hackathon%202026/docs/designs/assets/sketch.html:60), [sketch.html](/C:/Hackathons/Pixels%20to%20Products%20%E2%80%94%20Cloudinary%20AI%20Hackathon%202026/docs/designs/assets/sketch.html:84).

2. **The mobile sticky export implementation is unreliable.** `.frame` has `overflow:hidden`; the sticky CTA sits inside it. That overflow ancestor can prevent the bar from sticking to the viewport during document scroll. A user can lose the conversion action precisely when browsing stages on a phone. Fix: make the mobile export bar `position:fixed` with bottom safe-area padding, reserve bottom content space, or move it outside the overflow-clipped frame. Evidence: [sketch.html](/C:/Hackathons/Pixels%20to%20Products%20%E2%80%94%20Cloudinary%20AI%20Hackathon%202026/docs/designs/assets/sketch.html:13), [sketch.html](/C:/Hackathons/Pixels%20to%20Products%20%E2%80%94%20Cloudinary%20AI%20Hackathon%202026/docs/designs/assets/sketch.html:52).

3. **The wireframe contradicts the accessibility and design-system handoff.** It uses default system fonts, non-semantic `span`/`div` buttons, and radiogroup children without `role="radio"` or state. The design review promises the opposite. If builders treat this as the source of truth, keyboard operation and visual identity will regress. Fix: update the wireframe to use tokenized font families and semantic controls (`button`, labelled file input, `role="radio"`, `aria-checked`, keyboard focus styles). Evidence: [sketch.html](/C:/Hackathons/Pixels%20to%20Products%20%E2%80%94%20Cloudinary%20AI%20Hackathon%202026/docs/designs/assets/sketch.html:8), [sketch.html](/C:/Hackathons/Pixels%20to%20Products%20%E2%80%94%20Cloudinary%20AI%20Hackathon%202026/docs/designs/assets/sketch.html:83).

4. **The reference artifact fails the stated contrast rule.** Placeholder text `#8A909C` on `#F5F6F8` is roughly 2.9:1, below the required 4.5:1. If placeholder styling survives into loading/error imagery, status labels will be difficult to read. Fix: use a dark semantic muted text token that passes contrast on every surface; reserve pale gray for non-text decoration. Evidence: [sketch.html](/C:/Hackathons/Pixels%20to%20Products%20%E2%80%94%20Cloudinary%20AI%20Hackathon%202026/docs/designs/assets/sketch.html:21).

5. **The 768–1199px layout is specified but not visualized.** That breakpoint is where the export column moves and density changes most. Without a 900px reference, it is likely to become an accidental stacked-card layout or leave an awkward detached export panel. Fix: add a 900px wireframe showing the exact two-column thumbnails/export block, stage height, tab order, and sticky/non-sticky export behavior.

6. **“Hold to compare” needs a touch-safe alternative, not only a screen-reader fallback.** Long press risks browser text selection/context-menu behavior and is undiscoverable on many phones. Fix: provide a visible “Compare original” press-and-hold control with an explicit “Tap to toggle” alternative for all touch users, not solely assistive-technology users.

Scores:

| Dimension | Score | What makes it 10 |
|---|---:|---|
| Information architecture | 8/10 | Add a verified tablet composition and make library-versus-live AI cost unmistakable. |
| Interaction states | 7/10 | Specify credit confirmation, touch comparison behavior, and retry/spend behavior. |
| User journey | 8/10 | Preserve confidence by showing “$0 to try” before any costly action. |
| AI-slop resistance | 7/10 | Curate a recognizably RealStage art direction beyond generic marble/brass/pastel scenes, with real product photography in the landing proof. |
| Design-system specificity | 7/10 | Make the wireframe itself conform to the tokens, semantic controls, and contrast requirements. |
| Responsive + accessibility | 6/10 | Validate and document 390/900/1280 layouts; fix sticky behavior, semantics, contrast, and touch compare. |

Recommendation: **revise the design handoff before implementation** because the product concept and hierarchy are strong, but credit ambiguity and mobile/accessibility gaps directly threaten trust and conversion.
