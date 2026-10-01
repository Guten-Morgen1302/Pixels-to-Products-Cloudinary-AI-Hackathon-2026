# Demo video script (target 3:00, max 4:00)

Record one take of the real app with **live AI**. In mock mode the header says "Demo AI (simulated)" and generated cards say "(mock)", and judges would notice.

**Cost: 6 AI credits** (Flux 3 variations = 3, one relight = 3). That is exactly the demo reserve.

## Before you record (5 min)
1. In `.env` set `GEN_MODE=live` and `LIVE_AI=on`, then restart `npm run dev`. The header should read **"AI credits left: 15 of 15"**.
2. Use a 1280×800 browser window at 100% zoom, with bookmarks bar, notifications and extensions off (a private window is easiest).
3. Start OBS (or Win+G) recording that window only, with your mic on.
4. Open http://localhost:3000. Have a real product photo ready on the desktop (e.g. your own steel tumbler), or use the Leather bag sample.
5. Do not do a practice run in live mode; it spends credits. Rehearse in mock mode first.

## The take

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Landing page. Point at the before/after. | "Small sellers in India shoot products on a bedsheet, and every marketplace wants a different photo. AI photo tools often redraw the product. Zomato banned AI food photos because buyers got something different. RealStage keeps your real product." |
| 0:20–0:40 | Upload your photo (or tap **Leather bag**). "Cutting out your product…" appears. | "One phone photo. Cloudinary removes the background once, with e_background_removal." |
| 0:40–1:10 | The studio opens on the **same Kota stone scene from 3 models**. Point at the mono lines (flux-2-klein-9b, nano-banana-1, recraft-v3, seeds). Click each card. | "This is Cloudinary's image generation with model choice: the same scene from three different models, side by side, each labelled with model and seed. My product is composited on top with Cloudinary layers. No AI touches it, and these stages cost nothing to use." |
| 1:10–1:25 | Click **Compare**. | "Compare puts my original pixels next to the staged product, at the same crop and scale. It's identical." |
| 1:25–1:55 | Click **Relight with AI · uses 3**. Wait for the chip "Alignment 0.9x · real pixels locked". | "Relight sends the scene to Cloudinary's image-to-image model for real lighting. Then we check the AI didn't move or reshape the product, and lock my original pixels back on top. If it moved them, the app keeps my exact photo and says so." |
| 1:55–2:25 | Type "brass thali table, festive evening". Open the **Model** dropdown to show the 3 models and prices, then pick **Flux · 3 variations · 3 credits** → **Generate**. Three cards appear. | "Need a festive look? Pick a model. Each one shows its real credit price. Flux gives three seeded variations, live." |
| 2:25–2:50 | **Download all · 4 files**. Open the zip; open the Amazon file (2000×2000, pure white), then the Story file. | "One click: Amazon white at 85% fill, Instagram, Story and WhatsApp, all sized and named. The Amazon image is checked pixel by pixel for pure white." |
| 2:50–3:10 | Switch to the README on GitHub and scroll the **Cloudinary feature map**. | "Cloudinary is the whole backend: upload, background removal, text-to-image and image-to-image generation, layers, crops, structured metadata and delivery, with no database. It runs on the free tier for zero rupees. RealStage: your real product, studio stages, every marketplace size." |

## After recording
1. Set `.env` back to `GEN_MODE=mock`, `LIVE_AI=off`, and restart.
2. Ask Claude to **release the demo's 6 judge slots**, so the deployed app keeps the full 15 credits for judges.
3. Upload the video to YouTube as unlisted and paste the link into the README and the form.
4. If a take fails mid-way, don't redo the live steps. Re-record just that part in mock mode with the header cropped out, or ask Claude first. There is no credit budget for a second full live take.
