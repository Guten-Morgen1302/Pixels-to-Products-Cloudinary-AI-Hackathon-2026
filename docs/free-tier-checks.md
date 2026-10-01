# Free-tier checks

Run: 2026-10-01T12:59:38.109Z · cloud: dsozte44m

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Model credit costs | manual | manual: Console → Image Generation → Model → Change; note credits per model at 1K/2K |
| 2 | Background removal pipeline | PASS | original 2385×1590 → _cut 1281×1339 png, alpha=true, 423 retries=0 |
| 3 | Structured metadata | PASS | created + deleted test field (delete HTTP 200) |
| 4 | Downloads (fl_attachment + CORS) | PASS | HTTP 200, content-disposition="attachment; filename="realstage-check.png"", access-control-allow-origin="*" |
| 5 | Usage baseline | PASS | plan=Free, credits used=0.17 of 25 (0.68%), transformations=0 |
| 6 | Slot atomicity (create-if-absent race) | PASS | 8 parallel uploads → 8 HTTP 200, 1 created, 7 existing:true |
