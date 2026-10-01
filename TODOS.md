# TODOS

## Product

### Public share page for kits

**What:** A `/k/<kitId>` page listing the 4 kit files and the zip, readable by anyone with the link until the kit expires.

**Why:** Sellers can send a kit to a helper or open it on another device without downloading a zip.

**Context:** Deferred in the CEO review (CEO-D1, 2026-10-01) to protect the Oct 3 deadline; the zip download covers delivery for v1. Kit files are already tagged `kit-<kitId>`, so the page reads them via Admin API by tag. See docs/designs/realstage.md.

**Effort:** S (human) / S (CC)
**Priority:** P3
**Depends on:** Kit export tagging

## Infrastructure

### Per-session caps

**What:** Signed httpOnly cookie limiting uploads, relights and new-stage fan-outs per browser session.

**Why:** Stops one visitor from spending the whole day's global live-AI budget.

**Context:** Deferred in the CEO review (CEO-D3). Global daily caps are the real guard in v1; cookies are bypassable anyway. Revisit if the global cap is hit by a single visitor during judging.

**Effort:** S (human) / S (CC)
**Priority:** P3
**Depends on:** Global caps

### HEIC polish

**What:** Client-side HEIC preview before upload and explicit HEIC handling in any server step.

**Why:** iPhone photos preview only in Safari before upload.

**Context:** Deferred in the CEO review (CEO-D4). Baseline: direct browser-to-Cloudinary upload converts HEIC, and every preview uses f_auto delivery URLs, so no browser or sharp HEIC decoding is required.

**Effort:** S (human) / S (CC)
**Priority:** P4
**Depends on:** None

## Completed

### Scheduled cleanup of expired session assets
Pulled back into v1 scope by the Outside Voice Round (X7, 2026-10-01): the daily Vercel Hobby cron ships.

### Replace tag-count caps with an atomic counter
Superseded by the Outside Voice Round (X3, 2026-10-01): Cloudinary create-if-absent slot claims are atomic and free; no KV needed.
