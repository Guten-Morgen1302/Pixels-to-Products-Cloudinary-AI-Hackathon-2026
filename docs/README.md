# Docs index — RealStage

Read in this order.

| # | Doc | What it is |
|---|---|---|
| 1 | [IDEA.md](IDEA.md) | The idea in one page: problem, user flow, why it wins |
| 2 | [designs/realstage.md](designs/realstage.md) | **The master plan.** It holds the office-hours design, CEO review, eng review (architecture, data flow, test matrix), design review, $0 Budget Lock, Win Plan, the Codex outside-voice rounds and the final review report. Where sections conflict, the later one wins (rule on line 7). |
| 3 | [../DESIGN.md](../DESIGN.md) | Design system: colours with checked contrast, fonts, spacing, motion, components, state visuals, layouts, AI stage art direction, copy rules |
| 4 | [designs/assets/sketch.png](designs/assets/sketch.png) | Mockup v3: landing, desktop studio, tablet and mobile. Source: [sketch.html](designs/assets/sketch.html) (open in a browser) |
| 5 | [designs/assets/mockup-mobile.png](designs/assets/mockup-mobile.png) | Standalone mobile mockup with the fixed "Download all" bar. Source: [mockup-mobile.html](designs/assets/mockup-mobile.html) |
| 6 | [test-plan.md](test-plan.md) | QA test plan: pages, key interactions, edge cases, critical paths |
| 7 | [reviews/](reviews/) | Verbatim Codex (gpt-5.6-terra) reviews, round 1 engineering + design and rounds 2–4 verification |
| 8 | [designs/realstage.md.review.bCuixX/](designs/realstage.md.review.bCuixX/) | Spec-review rounds 1–2 from office hours (raw JSON verdicts) |
| 9 | [../TODOS.md](../TODOS.md) | Deferred work, with the items completed during review |
| 10 | [demo-script.md](demo-script.md) | 3-minute demo video script and checklist |
| 11 | [../scripts/free-tier-checks.mjs](../scripts/free-tier-checks.mjs) | Free-tier gate script: checks 2–6, 0 AI credits. Needs `.env.local` (see [../.env.example](../.env.example)) |
| — | `free-tier-checks.md` | Created here after the checks run |

## Status (2026-10-01)
- Planning: **complete**. CEO and design reviews CLEAR. Eng review has 0 unresolved decisions and 0 critical gaps. Codex outside voice ran 4 rounds and ended with 0 blockers.
- Waiting on:
  - `.env.local` with Cloudinary credentials, so the free-tier checks can run.
  - Per-model credit costs, read from the Console.
- Build: **v1 + phase 2 code complete** (52 tests, production build OK). Live setup is blocked on a valid Cloudinary API secret.
- Deadline: submit by **Oct 3, 20:00 IST** (code freeze Oct 4, 00:15).
