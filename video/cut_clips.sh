#!/usr/bin/env bash
# Cuts "demo video/cloudinary demo.mkv" (the 1 Oct 2026 live recording, 1280×720, not in git) into the sped-up clips.
# Every clip crops away the browser chrome (tabs + personal bookmarks bar, y < 120) and keeps only the app.
# name  source-start  source-end  speed
set -euo pipefail
cd "$(dirname "$0")/.."
IN="demo video/cloudinary demo.mkv"
OUT=video/public/clips
mkdir -p "$OUT"
ENC=(-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p)
APP="crop=1280:600:0:120"
cut() { ffmpeg -v error -y -ss "$2" -to "$3" -i "$IN" -an -vf "$APP,setpts=PTS/$4,fps=30" "${ENC[@]}" "$OUT/$1.mp4"; }

cut c1_landing   0    7.5   1.5   # landing page, cursor on "Upload a product photo" (file picker 0:08–0:15 skipped: private folders)
cut c2_cutout    15   58    8.6   # uploading → "Cutting out your product…" → studio appears
cut c3_studio    58   84    2.6   # same Kota stone scene from 3 models, clicking each card
cut c4_compare   84   87.5  1.0   # Compare panel: your photo vs on-stage crop
cut c5_relight   112  142   3.0   # Relight with AI → "We kept your exact photo" (credits 15 → 12)
cut c6_generate  160  204   4.0   # prompt, model picker with prices, Generate, 3 placeholders → 3 brass stages
cut c7_brass     204  222   2.0   # browsing the brass thali stages, picking one
cut c8_download  222  234   2.0   # Download all → Preparing → Downloaded

# The 4 downloaded files opened in Windows Photos (title bar = real file name). Zip-window frames between them are cut.
VIEW="setpts=PTS/SPEED,fps=30,scale=1067:600,pad=1280:600:106:0:color=0x202020"
seg() { ffmpeg -v error -y -ss "$2" -to "$3" -i "$IN" -an -vf "${VIEW/SPEED/$4}" "${ENC[@]}" "$OUT/$1.mp4"; }
seg f1 244   249.5 2.0   # whatsapp-1080
seg f2 254   256.5 1.3   # instagram-1080x1350
seg f3 259.5 264   2.0   # story-1080x1920
seg f4 268   271.5 1.2   # amazon-2000 (pure white)
printf "file '%s'\n" f1.mp4 f2.mp4 f3.mp4 f4.mp4 > "$OUT/files.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/files.txt" "${ENC[@]}" "$OUT/c9_files.mp4"
rm -f "$OUT"/f[1-4].mp4 "$OUT/files.txt"

cut c10_github   278.8 286.2 1.0  # README → "Cloudinary integration (feature map)" on GitHub

for f in "$OUT"/*.mp4; do printf "%-28s %ss\n" "$(basename "$f")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"; done
