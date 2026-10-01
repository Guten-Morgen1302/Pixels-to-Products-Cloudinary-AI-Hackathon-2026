"""English voice-over for the demo via Gemini TTS, one clip per scene → video/out/vo/NN.wav + timing.json.

  python make_vo.py            # all lines, then a transcription check
  python make_vo.py 7 8        # only re-generate lines 7 and 8 (then check them)
  python make_vo.py --check    # only re-run the transcription check

Each line has the start (seconds on the video timeline) and the max length it may take.
The key comes from GEMINI_API_KEY in the project root .env (gitignored).
"""

from __future__ import annotations

import difflib
import json
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")
OUT = HERE / "out" / "vo"
MODEL = os.getenv("VO_MODEL", "gemini-3.8-flash-tts")
VOICE = os.getenv("VO_VOICE", "Fenrir")
CHECK_MODEL = os.getenv("VO_CHECK_MODEL", "gemini-3.5-flash")

# (start_seconds, max_seconds, text). Scene starts: Root.tsx (Logo 6.0, Problem 10.5, footage 18.5 … 95.3, Pipeline 95.3,
# Stats 107.3, End 116.3, total 124.3).
LINES: list[tuple[float, float, str]] = [
    (0.3, 5.4, "One real product photo. Four marketplaces, four different sizes."),
    (6.2, 4.0, "This is RealStage."),
    (10.7, 7.8, "AI tools redraw your product. Zomato even banned AI food photos. Real Stage never touches it."),
    (18.8, 4.5, "I upload a real teapot photo."),
    (23.7, 4.6, "Cloudinary's background removal cuts it out, once."),
    (28.8, 9.4, "Same product, same scene, from three AI models: Flux, Nano Banana and Recraft. My real pixels sit on top."),
    (38.6, 3.2, "Compare proves it: identical pixels."),
    (42.3, 9.4, "Relight runs Cloudinary's image-to-image model. Here the AI moved the teapot, so RealStage rejected it and kept my exact photo."),
    (52.3, 10.4, "Now a festive look. Each model shows its real credit price. Flux gives three variations, generated live."),
    (63.3, 8.4, "A brass thali table, festive lights. The teapot is still the real teapot."),
    (72.3, 5.4, "One click builds the whole kit."),
    (78.3, 9.2, "Amazon pure white at two thousand pixels, Instagram, Story and WhatsApp. Ready to list."),
    (88.1, 7.0, "Every Cloudinary call is mapped to a file in the README."),
    (95.5, 11.4, "Cloudinary is the entire backend, with no database. Upload, background removal, text-to-image, image-to-image, layers and delivery."),
    (107.5, 8.4, "Sixty-eight tests, a hard credit cap, and it runs on the free tier for zero rupees."),
    (116.5, 6.4, "RealStage. Your real product, on every marketplace."),
]


def tts(client: genai.Client, text: str) -> bytes:
    cfg = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE))),
    )
    for attempt in range(4):
        try:
            r = client.models.generate_content(model=MODEL, contents=text, config=cfg)
            return r.candidates[0].content.parts[0].inline_data.data
        except Exception as e:  # noqa: BLE001 (rate limits / transient errors: back off and retry)
            print(f"   retry {attempt + 1}: {type(e).__name__}: {str(e)[:120]}")
            time.sleep(6 * (attempt + 1))
    raise SystemExit(f"TTS failed for: {text[:60]}")


def write_wav(path: Path, pcm: bytes) -> float:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm)
    return len(pcm) / 2 / 24000


def trim_and_fit(src: Path, dst: Path, max_s: float) -> float:
    """Trim silence at both ends; speed up (≤ 1.25×) only if the line would overrun its scene."""
    tmp = dst.with_suffix(".trim.wav")
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", trim, str(tmp)], check=True)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(tmp)]))
    tempo = max(1.0, dur / max_s)
    if tempo > 1.25:
        print(f"   ⚠️ {dst.name}: {dur:.1f}s for a {max_s}s slot, even 1.25× overruns; shorten the text")
        tempo = 1.25
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"atempo={tempo:.3f}", "-ar", "44100", str(dst)], check=True)
    tmp.unlink()
    return dur / tempo


def words(t: str) -> list[str]:
    t = t.lower().replace("-", " ").replace("real stage", "realstage")
    return re.sub(r"[^a-z0-9 ]", " ", t).split()


def check(client: genai.Client, only: set[int]) -> list[int]:
    """Transcribe each wav with Gemini and flag lines that don't match their script (TTS sometimes skips or garbles words)."""
    bad = []
    for i, (_, _, text) in enumerate(LINES, 1):
        if only and i not in only:
            continue
        audio = (OUT / f"{i:02d}.wav").read_bytes()
        r = client.models.generate_content(
            model=CHECK_MODEL,
            contents=[types.Part.from_bytes(data=audio, mime_type="audio/wav"), "Transcribe this speech verbatim. Spell numbers as words. Output only the words."],
        )
        heard = (r.text or "").strip()
        score = difflib.SequenceMatcher(None, words(text), words(heard)).ratio()
        flag = "OK " if score >= 0.85 else "BAD"
        print(f"{flag} {i:02d} {score:.2f}  heard: {heard}")
        if score < 0.85:
            bad.append(i)
    return bad


def main(args: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    only = {int(a) for a in args if a.isdigit()}
    if "--check" not in args:
        timing_path = OUT / "timing.json"
        timing = json.loads(timing_path.read_text()) if timing_path.exists() else {}
        for i, (start, max_s, text) in enumerate(LINES, 1):
            if only and i not in only:
                continue
            raw = OUT / f"{i:02d}.raw.wav"
            final = OUT / f"{i:02d}.wav"
            print(f"{i:02d} @ {start:6.1f}s  {text[:70]}")
            write_wav(raw, tts(client, text))
            dur = trim_and_fit(raw, final, max_s)
            raw.unlink()
            timing[f"{i:02d}"] = {"start": start, "dur": round(dur, 2), "max": max_s}
            print(f"   → {dur:.1f}s (slot {max_s}s)")
        timing_path.write_text(json.dumps(timing, indent=1))
    bad = check(client, only)
    print("all lines match" if not bad else f"regenerate: python make_vo.py {' '.join(map(str, bad))}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
