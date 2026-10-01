# Demo video script (target 3:00, max 4:00)

Record in one take on the deployed URL in a clean browser window at 1280×800, using OBS or Win+G. Record **once, early** (budget: ≤ 8 AI credits). Speak plainly; the on-screen text does the work.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Landing. Hover the before/after. | "Small sellers in India shoot products on a bedsheet. Every marketplace wants a different photo. AI tools can redraw your product, and buyers punish that. Zomato banned AI dish photos for exactly this reason." |
| 0:15–0:30 | Tap the **Steel tumbler** sample, or upload a real phone photo. Cutting-out state shows. | "RealStage starts with one phone photo. Cloudinary removes the background once." |
| 0:30–1:00 | Three stages land (the motion moment). Point at the mono lines. | "Here's the same real product on three AI stages from three different models: flux, nano-banana and recraft. Each card shows its model and seed. That's Cloudinary's model choice, on screen." |
| 1:00–1:20 | Press **Compare**. | "Compare puts your original pixels next to the staged product at the same scale. We never redraw the product." |
| 1:20–1:50 | **Relight with AI**. Progress line, then the "Alignment 0.9x · real pixels locked" chip. | "Relight sends the scene to Cloudinary's image-to-image model. Then we check the AI didn't move the product, and lock your original pixels back on top. If the AI moves it, we keep the exact photo and tell you." |
| 1:50–2:20 | Type "brass thali table, festive evening" → **Generate 3 new stages**. Three cards generate side by side. | "Need a festive look? One prompt fans out to three models at once, live." |
| 2:20–2:45 | **Download all**. Open the zip; open the Amazon file at 2000×2000 on pure white, then the Story file. | "One click gives the full kit: Amazon white, Instagram, Story and WhatsApp, each correctly sized and named." |
| 2:45–3:00 | README feature map, scrolled. | "Cloudinary is the whole backend: upload, background removal, generation, layers, crops, metadata, delivery. It runs on the free tier for zero rupees. RealStage: your real product, studio stages, every marketplace size." |

**Checklist before recording**
- `npm run smoke` passes on production.
- `/design-review` has no P1 visual issues on the deployed URL (T-D7).
- Production budget badge shows ≥ 6 AI credits.
- Browser zoom 100%, bookmarks bar hidden, notifications off.

**After recording**
- Set `LIVE_AI=off` in Vercel if the remaining credits are below the judge reserve.
- Upload the video unlisted on YouTube and paste the link in the README and the form.
