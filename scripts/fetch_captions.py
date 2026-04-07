#!/usr/bin/env python3.12
"""Fetch YouTube captions and output as JSON."""
import json
import sys

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig

def fetch(video_id: str):
    proxy_config = GenericProxyConfig(https_url="http://127.0.0.1:7897")
    ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config)
    try:
        transcript = ytt_api.fetch(video_id=video_id)
        segments = [
            {"start": s.start, "dur": s.duration, "text": s.text}
            for s in transcript
        ]
        print(json.dumps(segments))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: fetch_captions.py <video_id>"}), file=sys.stderr)
        sys.exit(1)
    fetch(sys.argv[1])
