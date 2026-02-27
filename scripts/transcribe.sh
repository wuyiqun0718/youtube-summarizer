#!/bin/bash
# Usage: transcribe.sh <video_id_or_file_path> [model_path]
# Outputs JSON array of {start, dur, text} segments to stdout
export PATH="/opt/homebrew/bin:$PATH"

INPUT="$1"
MODEL="${2:-$(dirname "$0")/../models/ggml-small.bin}"
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Determine if input is a file path or YouTube video ID
if [ -f "$INPUT" ]; then
  INPUT_FILE="$INPUT"
else
  # YouTube video ID - download audio with yt-dlp
  COOKIES="$(dirname "$0")/../cookies.txt"
  if [ -f "$COOKIES" ]; then
    COOKIE_ARGS="--cookies $COOKIES"
  else
    COOKIE_ARGS="--cookies-from-browser firefox"
  fi
  yt-dlp -x --audio-format wav --audio-quality 0 \
    $COOKIE_ARGS \
    --proxy "http://127.0.0.1:7897" \
    -o "$TMPDIR/audio.%(ext)s" \
    "https://www.youtube.com/watch?v=$INPUT" >&2

  # Find the downloaded wav file (yt-dlp might name it differently)
  INPUT_FILE=$(find "$TMPDIR" -name "*.wav" -type f | head -1)

  if [ -z "$INPUT_FILE" ]; then
    # Maybe it's still in original format, find any audio file
    INPUT_FILE=$(find "$TMPDIR" -type f | head -1)
  fi
fi

if [ -z "$INPUT_FILE" ] || [ ! -f "$INPUT_FILE" ]; then
  echo '{"error":"Failed to get audio"}' >&2
  exit 1
fi

# Convert to 16kHz mono WAV (whisper requirement)
ffmpeg -i "$INPUT_FILE" -ar 16000 -ac 1 -y "$TMPDIR/input.wav" 2>/dev/null
if [ $? -ne 0 ]; then
  cp "$INPUT_FILE" "$TMPDIR/input.wav"
fi

# Run whisper
whisper-cli \
  --model "$MODEL" \
  --language auto \
  --output-json \
  --output-file "$TMPDIR/result" \
  "$TMPDIR/input.wav" >/dev/null 2>&1

if [ ! -f "$TMPDIR/result.json" ]; then
  echo '{"error":"Whisper transcription failed"}' >&2
  exit 1
fi

# Convert whisper JSON output to our format
python3.12 -c "
import json, sys
with open('$TMPDIR/result.json') as f:
    data = json.load(f)
segments = []
for s in data.get('transcription', []):
    start_parts = s['timestamps']['from'].replace(',','.').split(':')
    h, m, sec = float(start_parts[0]), float(start_parts[1]), float(start_parts[2])
    start = h*3600 + m*60 + sec
    
    end_parts = s['timestamps']['to'].replace(',','.').split(':')
    h2, m2, sec2 = float(end_parts[0]), float(end_parts[1]), float(end_parts[2])
    end = h2*3600 + m2*60 + sec2
    
    segments.append({'start': round(start, 3), 'dur': round(end - start, 3), 'text': s['text'].strip()})
print(json.dumps(segments))
"
