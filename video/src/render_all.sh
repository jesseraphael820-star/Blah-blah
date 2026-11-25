#!/bin/bash
# Renders all scene chunks (skips finished ones), then concatenates and muxes audio + subtitles.
set -e
cd "$(dirname "$0")/.."
CUTS=(0 15 40 65 90 115 145 165)
for i in 0 1 2 3 4 5 6; do
  name=$(printf "c%d" $i)
  [ -f out/chunks/$name.mp4 ] || python3 src/render.py chunk ${CUTS[$i]} ${CUTS[$((i+1))]} $name 3
done
ls out/chunks/c*.mp4 | sort | sed "s|^out/chunks/|file '|; s|$|'|" > out/chunks/list.txt
python3 src/render.py srt out/the_power_of_opus_5_5.srt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/chunks/list.txt -i assets/mix_norm.wav -i out/the_power_of_opus_5_5.srt \
  -map 0:v -map 1:a -map 2:s -c:v copy -c:a aac -b:a 320k -ar 48000 -c:s mov_text \
  -metadata title="THE POWER OF OPUS 5.5" -metadata:s:a:0 language=por -metadata:s:s:0 language=por \
  -movflags +faststart out/THE_POWER_OF_OPUS_5.5_4K60.mp4
echo DONE
