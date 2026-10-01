# RealStage — the idea in one page

**One rough phone photo in. Professional, marketplace-ready product photos out. The product itself is never redrawn by AI.**

Hackathon: Pixels to Products — Cloudinary AI Hackathon 2026 (HackIndia). **Track 2 — Generative Content Workflows.**

## The problem
- Small Indian online sellers (Meesho resellers, Instagram and WhatsApp shops, first-time Amazon sellers) photograph products on a bedsheet or kitchen floor, so their listings look cheap.
- Every channel wants a different image. Amazon wants a pure-white 2000×2000 main image; Instagram wants 4:5; Stories want 9:16; WhatsApp and Meesho want square.
- A pro photoshoot costs ₹4,000–5,000.
- Generic AI photo tools can quietly redraw the product, so the label, colour or shape changes. Buyers punish that: Zomato banned AI-generated dish images in Sept 2024 after complaints, refunds and bad ratings.

## What the seller does
1. **Upload** one phone photo. No photo handy? Tap one of 3 samples: steel tumbler, saree, pickle jar.
2. **Cloudinary cuts the product out** of the background.
3. **Pick a stage.** The real product appears on studio backgrounds made by **3 different AI models**, side by side: kota stone, teak shelf, terracotta. Each card shows which model made it.
4. **Compare** shows the original photo and the staged version side by side, as proof the product pixels are untouched.
5. **Relight with AI** (optional) adds natural light and a contact shadow. The app then checks the AI didn't move the product; if it did, it keeps the exact original.
6. **Generate 3 new stages** from a text prompt, live, on 3 models.
7. **Download the kit**: Amazon white 2000×2000, Instagram post, Story, WhatsApp/Meesho. Each file can be downloaded on its own, or all 4 with one "Download all".

## Why it should win
- **Matches the track spec exactly:** "AI image generation including variations and model choice". We show 3 model families side by side, live.
- **Cloudinary does almost everything:**
  - upload
  - background removal
  - AI generation (text-to-image and image-to-image)
  - layering and compositing
  - smart crops and padding
  - f_auto/q_auto delivery
  - tags, context and structured metadata as the database
  - Admin/Usage API
- **A real problem with a clear user.** The "real pixels" promise answers the Zomato lesson.
- **Judges can always try it.** The default flow uses ready-made stages, spends zero AI credits, and works even when live AI is paused.
- **Completely free.** Cloudinary free plan plus 50 free AI credits, Vercel Hobby, GitHub. **$0.**

## Where everything is
See [docs/README.md](README.md).
