# DESIGN.md — RealStage

Source of truth for visual and interaction decisions. Derived from the design review in [docs/designs/realstage.md](docs/designs/realstage.md) (DR1–DR12, D1–D7, X13). The reference wireframe is [docs/designs/assets/sketch.png](docs/designs/assets/sketch.png).

## Use scene
Small Indian online sellers photographing and listing products on a phone in daylight, plus hackathon judges on a laptop. The surface is OPERATE (app UI) with one HYBRID landing state. Light theme.

## Color tokens
| Token | Value | Use | Contrast |
|---|---|---|---|
| `--bg` | `#FFFFFF` | page | — |
| `--surface` | `#F5F6F8` | image wells, skeletons | decoration only |
| `--ink` | `#16181D` | primary text, selected border | 17.8:1 on bg |
| `--ink-2` | `#5B6270` | secondary text, meta | 6.1:1 on bg, 5.7:1 on surface |
| `--line` | `#E4E6EB` | dividers, unselected borders | decoration only |
| `--accent` | `#0B6E4F` | primary button, wordmark accent, focus | 6.3:1 with white text |
| `--accent-ink` | `#FFFFFF` | text on accent | — |
| `--danger` | `#B42318` | error text | 6.6:1 on bg |
| `--focus` | `#0B6E4F` | 2 px focus ring, 2 px offset | — |

Text never uses a color lighter than `--ink-2`. Ratios were computed with the WCAG 2.x relative-luminance formula on 2026-10-01. The old wireframe placeholder (#8A909C on surface, 2.96:1) has been removed.

## Typography
- **Bricolage Grotesque** 800: wordmark and H1 only. H1 is 44/48 px desktop and 30/34 px mobile, tracking −0.02em.
- **Instrument Sans** 400/600: all UI and body text. Body 16/24, small 14/20, caption 13/18.
- **JetBrains Mono** 400, 13/18 with `tabular-nums`: model id, seed, sizes and credit counts only.
- Fonts load through `next/font/google` (self-hosted at build time, OFL, $0). Never fall back to `system-ui` as the display face.

## Spacing, radius, depth
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64. Page padding is 32 desktop, 24 tablet, 16 mobile. Space above a heading is at least 2× the space below it.
- Radius: stage images and option cards 10, buttons and inputs 8, thumbnails 6.
- No decorative shadows. A selected option gets a 2 px `--ink` border. Focus is a 2 px `--focus` ring with a 2 px offset.
- Browser surfaces: `::selection` uses `rgb(11 110 79 / .18)`, `caret-color: var(--accent)`, thin scrollbars in `--line`/`--ink-2`, and `text-underline-offset: 3px`.

## Motion
There is exactly one authored moment. When the cutout is ready, the product lands on the stage options: opacity 0→1, translateY 12→0 px, 240 ms, `cubic-bezier(.16,1,.3,1)`, with a 60 ms stagger. With `prefers-reduced-motion`, the swap is instant. Nothing else animates; loading uses static skeletons.

## Components
| Component | Contract |
|---|---|
| `UploadColumn` | Landing state: H1, one sentence, primary "Upload a product photo" button (a labelled `<input type="file">`), drop zone, "No photo handy? Try a sample" with 3 sample buttons, and a real before/after pair. After upload it shrinks to 56 px thumbnails plus a "New photo" link. |
| `StageGrid` | Large selected stage. Below it, a `role="radiogroup"` of option cards (`role="radio"`, `aria-checked`, arrow keys). Card content: stage name (Instrument Sans 600 14), provenance (mono 13, "flux-2-klein-9b · seed 42"), and "Free to use". The selected stage carries the "Relight with AI · uses 1 of 15 shared AI credits" button and the "Compare" toggle. Below the strip: a labelled prompt input and "Generate 3 new stages · uses 3". |
| `ComparePanel` | Toggle (button, `aria-pressed`). Shows two equal crops: "Your photo" and "On stage". Same scale, product bounding box. |
| `ExportKit` | 4 rows: 44 px preview, label, mono size, individual download link. Primary button "Download all · 4 files" (client zip). Social sizes are labelled "Social preview" when built by padding (1K stages). |
| `BudgetBadge` | Mono "AI credits left: N of 15", shown only while live AI is on. Otherwise hidden; the AI buttons show the paused message. |

## State visuals (per component)
Copy for every state is in the plan's DR5 state table. This section fixes how each state looks.

| Component · state | Visual treatment |
|---|---|
| Any image well · loading | `--surface` block at final size (no layout shift). Centred Instrument Sans 14 `--ink-2` status line, e.g. "Cutting out your product…". No spinner and no shimmer gradient. Status text sits in an `aria-live="polite"` region. |
| Option card · pending (generating) | Card border `--line`, image well as loading, mono line shows the model id plus "Generating… ~30 s". The card is not selectable (`aria-disabled="true"`). |
| Option card · error | Well keeps `--surface`. Message in `--danger` 14/20, "This model didn't respond", with a secondary button "Retry" (44 px) inside the card. The other cards stay selectable. |
| Stage · relighting | The current image stays visible at 100%. A 1 px `--ink` progress line runs along the top edge, determinate via elapsed/expected seconds. The Relight button changes to "Relighting…" and is disabled. |
| Stage · relight fallback | The exact composite stays visible. Chip bottom-right on `#fff`: "We kept your exact photo" in Instrument Sans 600 14, with a `--ink-2` subline "AI moved the product, so we didn't use its lighting". |
| AI buttons · paused | The button keeps its outline but uses `--ink-2` text and a dashed `--line` border, `aria-disabled="true"`. Helper text below in `--ink-2` 14: "Live AI paused to save credits. Library stages still work." The header badge is hidden. |
| Upload · error | The drop-zone border switches from `--ink-2` dashed to a 1.5 px solid `--danger`. Message below in `--danger` 14 with an action link ("Use a sample"). Focus moves to the message. |
| Export · preparing | The primary button label becomes "Preparing 2/4…" with the same accent fill. Kit rows show a 44 px loading well until each derived URL loads. |
| Export · done | The button label becomes "Downloaded · Download again" with the same accent fill. A one-line `--ink-2` note "Files are named realstage-<product>-…". No toast, no confetti. |

## Layout per viewport (standalone mobile reference: docs/designs/assets/mockup-mobile.html)
- **≥1200 px:** grid `minmax(0,1fr) 320px`, gap 32. Stage 520 px tall. The option strip shows 3 across.
- **768–1199 px:** single main column with a 440 px stage and 3 options across, then a two-column block: product thumbnails and compare on the left, export kit on the right. Tab order: stage → options → AI controls → export.
- **<768 px:** 4:5 stage, full width. Options become 3 square tiles with a meta line for the selected one, then Relight and New stages side by side, then the kit summary. The export bar is fixed at the bottom with `padding-bottom: env(safe-area-inset-bottom)`; content gets 88 px bottom padding.
- Touch targets are at least 44 × 44 px everywhere.

## Art direction for generated stages
The theme is Indian everyday surfaces in daylight, with an empty product area, eye-level camera, 50 mm lens and soft light from the left.

| Scene | Prompt core |
|---|---|
| Kota stone | "polished grey kota stone floor corner, plain wall, morning daylight" |
| Teak shelf | "warm teak wood shelf against a lime-washed wall, soft window light" |
| Terracotta | "terracotta tile surface, sun-dried plaster wall, afternoon light" |
| Festive brass | "brass thali and jute runner at the edges, marigold petals far left, centre empty" |
| Monsoon sill | "white window sill, rain-blurred green garden outside, cool diffuse light" |
| Marble counter | "white marble kitchen counter, blurred steel utensils far right, bright daylight" |

Every prompt ends with: "empty centre in the lower half for a product, no products, no text, no people, photographic, natural colors."

## Copy rules
- Use utility language: say what the user can do, or the status.
- No emoji, no kickers or eyebrow chips, no "Unlock" or "Supercharge".
- One term per concept: "Alignment", "AI credits", "Stage", "Kit".
- Failure copy builds trust: "We kept your exact photo. AI moved the product, so we didn't use its lighting."
