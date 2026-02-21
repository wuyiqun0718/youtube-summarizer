"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  onReady?: () => void;
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function loadYouTubeAPI() {
  if (apiLoaded) return;
  apiLoaded = true;

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks.length = 0;
  };
}

function onAPIReady(cb: () => void) {
  if (apiReady) {
    cb();
  } else {
    readyCallbacks.push(cb);
  }
}

export function seekTo(seconds: number) {
  if (playerInstance) {
    playerInstance.seekTo(seconds, true);
    playerInstance.playVideo();
  }
}

let playerInstance: YT.Player | null = null;

export default function YouTubePlayer({ videoId, onReady }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);

  const initPlayer = useCallback(() => {
    if (!containerRef.current) return;

    // Clear previous player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
      playerInstance = null;
    }

    const div = document.createElement("div");
    div.id = "yt-player-" + videoId;
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(div);

    const player = new window.YT.Player(div.id, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          playerRef.current = player;
          playerInstance = player;
          onReady?.();
        },
      },
    });
  }, [videoId, onReady]);

  useEffect(() => {
    loadYouTubeAPI();
    onAPIReady(initPlayer);

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        playerInstance = null;
      }
    };
  }, [initPlayer]);

  return (
    <div
      ref={containerRef}
      className="aspect-video w-full rounded-lg overflow-hidden bg-zinc-900"
    />
  );
}
