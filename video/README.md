# RealStage demo video

Motion graphics in [Remotion](https://www.remotion.dev) around the real 1 Oct 2026 live recording (live Cloudinary, live AI credits). 1920×1080, 30 fps, 2:04.

```bash
cd video
npm install
bash cut_clips.sh                      # needs "demo video/cloudinary demo.mkv" (not in git)
npx remotion studio src/index.ts       # preview + scrub in the browser
npx remotion render src/index.ts RealStage out/realstage-silent.mp4 --codec=h264 --crf=18
npx remotion still src/index.ts Thumbnail out/thumbnail.png
bash make_music.sh                     # synthesised beat, exactly 124.3 s → out/music.wav
python make_vo.py                      # English voice-over via Gemini TTS (voice Fenrir) + transcription check → out/vo/
python mix_audio.py                    # voice + music ducked under it, loudnorm -15 LUFS → out/realstage-demo.mp4
```

`make_vo.py` reads `GEMINI_API_KEY` from the project root `.env` (gitignored) and needs `google-genai` + `python-dotenv`.

Honesty rules:
- Every app screen is the unedited recording, only cropped to the app area and sped up. The speed is on the red "REAL RUN" chip in every scene.
- The browser chrome is cropped away (personal tabs and bookmarks) and replaced with a plain frame. The file-picker dialog is cut (private folders).
- The relight in this run was **rejected** by the Pixel-Lock check (the model moved the teapot), and the video says so: it shows the app keeping the exact photo.
- The downloaded-files scene is 4 short cuts of Windows Photos, labelled on screen as such.

| Scene | Source | Clip |
|---|---|---|
| Cold open, logo, problem | animation (real upload photo, real Amazon output) | |
| Landing | 0:00–0:07.5 @1.5× | c1_landing |
| Upload + cutout | 0:15–0:58 @8.6× | c2_cutout |
| 3-model studio | 0:58–1:24 @2.6× | c3_studio |
| Compare | 1:24–1:27.5 @1× | c4_compare |
| Relight (rejected, exact photo kept) | 1:52–2:22 @3× | c5_relight |
| Generate with model picker | 2:40–3:24 @4× | c6_generate |
| Brass thali stages | 3:24–3:42 @2× | c7_brass |
| Download all | 3:42–3:54 @2× | c8_download |
| 4 downloaded files | 4:04–4:31, 4 cuts @1.2–2× | c9_files |
| GitHub feature map | 4:38.8–4:46.2 @1× | c10_github |
| Pipeline, stats, end card | animation | |
