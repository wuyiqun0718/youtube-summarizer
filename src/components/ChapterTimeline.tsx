"use client";

import { useState, useRef } from "react";
import { seekTo } from "./YouTubePlayer";
import { formatTimestamp } from "@/lib/format";

export interface Chapter {
  title: string;
  start: number;
  end: number;
}

interface ChapterTimelineProps {
  chapters: Chapter[];
}

const COLORS = [
  { bg: "bg-indigo-500", dot: "bg-indigo-400", hover: "hover:bg-indigo-400" },
  { bg: "bg-teal-500", dot: "bg-teal-400", hover: "hover:bg-teal-400" },
  { bg: "bg-violet-500", dot: "bg-violet-400", hover: "hover:bg-violet-400" },
  { bg: "bg-pink-500", dot: "bg-pink-400", hover: "hover:bg-pink-400" },
  { bg: "bg-blue-500", dot: "bg-blue-400", hover: "hover:bg-blue-400" },
  { bg: "bg-green-500", dot: "bg-green-400", hover: "hover:bg-green-400" },
  { bg: "bg-orange-500", dot: "bg-orange-400", hover: "hover:bg-orange-400" },
  { bg: "bg-red-500", dot: "bg-red-400", hover: "hover:bg-red-400" },
];

export function TimelineBar({ chapters }: ChapterTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [tooltipX, setTooltipX] = useState(0);

  if (!chapters || chapters.length === 0) return null;

  const totalDuration = chapters[chapters.length - 1].end - chapters[0].start;
  if (totalDuration <= 0) return null;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    setTooltipX(e.clientX - rect.left);
  };

  return (
    <div className="relative">
      <div
        ref={barRef}
        onMouseMove={handleMouseMove}
        className="flex h-2.5 rounded-full overflow-hidden gap-px bg-zinc-200 dark:bg-zinc-800"
      >
        {chapters.map((ch, i) => {
          const duration = ch.end - ch.start;
          const pct = (duration / totalDuration) * 100;
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={i}
              onClick={() => seekTo(ch.start)}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`${color.bg} ${color.hover} transition-all cursor-pointer ${
                hoveredIndex === i ? "opacity-100 brightness-110" : hoveredIndex !== null ? "opacity-40" : "opacity-70"
              }`}
              style={{ width: `${pct}%`, minWidth: 4 }}
            />
          );
        })}
      </div>
      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="absolute mt-1.5 pointer-events-none -translate-x-1/2"
          style={{ left: tooltipX }}
        >
          <div className="bg-zinc-800 dark:bg-zinc-700 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap">
            <span className="font-mono text-blue-300 mr-1.5">{formatTimestamp(chapters[hoveredIndex].start)}</span>
            {chapters[hoveredIndex].title}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChapterList({ chapters }: ChapterTimelineProps) {
  if (!chapters || chapters.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {chapters.map((ch, i) => {
        const color = COLORS[i % COLORS.length];
        return (
          <button
            key={i}
            onClick={() => seekTo(ch.start)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all text-left group"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />
            <span className="text-xs font-mono text-blue-500 dark:text-blue-400/70 bg-blue-50 dark:bg-blue-500/5 px-2 py-1 rounded shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/15 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-all min-w-[52px] text-center">
              {formatTimestamp(ch.start)}
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors truncate">
              {ch.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
