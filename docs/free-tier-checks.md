# Free-tier checks

Run: 2026-10-01T12:03:50.634Z · cloud: dsozte44m

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Model credit costs | manual | manual: Console → Image Generation → Model → Change; note credits per model at 1K/2K |
| 2 | Background removal pipeline | FAIL | original upload failed: HTTP 401 Invalid Signature ff3be13009df1f4521d9b827cfa0a5545bc784c8. String to sign - 'folder=realstage/checks&public_id=orig-985ed0e9&tags=realstage-check&timestamp=1790856227'. |
| 3 | Structured metadata | FAIL | create field HTTP 401 api_secret mismatch |
| 4 | Downloads (fl_attachment + CORS) | FAIL | skipped: no asset from check 2 |
| 5 | Usage baseline | FAIL | HTTP 401 |
| 6 | Slot atomicity (create-if-absent race) | FAIL | 8 parallel uploads → 0 HTTP 200, 0 created, 0 existing:true — FAILS: set LIVE_AI=off in production (plan X3 fallback) |
