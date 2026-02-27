"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface VideoTagEditorProps {
  videoId: string;
}

export default function VideoTagEditor({ videoId }: VideoTagEditorProps) {
  const [videoTags, setVideoTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [tagsRes, histRes] = await Promise.all([
      fetch("/api/tags"),
      fetch(`/api/history?id=${videoId}`),
    ]);
    const tagsData = await tagsRes.json();
    const histData = await histRes.json();
    setAllTags(tagsData.tags || []);
    setVideoTags(histData.video?.tags || []);
  }, [videoId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const videoTagIds = new Set(videoTags.map(t => t.id));

  const toggleTag = async (tag: Tag) => {
    const newTags = videoTagIds.has(tag.id)
      ? videoTags.filter(t => t.id !== tag.id)
      : [...videoTags, tag];
    setVideoTags(newTags);
    await fetch(`/api/videos/${videoId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: newTags.map(t => t.id) }),
    });
  };

  const createAndAdd = async () => {
    const name = input.trim();
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const { tag } = await res.json();
    setAllTags(prev => [...prev, tag]);
    const newTags = [...videoTags, tag];
    setVideoTags(newTags);
    setInput("");
    await fetch(`/api/videos/${videoId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: newTags.map((t: Tag) => t.id) }),
    });
  };

  const filtered = allTags.filter(t =>
    !input.trim() || t.name.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div ref={ref} className="relative inline-flex flex-wrap items-center gap-1.5">
      {videoTags.map(tag => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundColor: tag.color }}
          onClick={() => toggleTag(tag)}
          title="Click to remove"
        >
          {tag.name}
          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      ))}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
      >
        + Tag
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && input.trim()) {
                  const match = filtered.find(t => t.name.toLowerCase() === input.toLowerCase());
                  if (match) toggleTag(match);
                  else createAndAdd();
                }
              }}
              placeholder="Search or create..."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto px-1 pb-1">
            {filtered.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 text-zinc-800 dark:text-zinc-200">{tag.name}</span>
                {videoTagIds.has(tag.id) && (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
            {input.trim() && !filtered.some(t => t.name.toLowerCase() === input.toLowerCase()) && (
              <button
                onClick={createAndAdd}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-blue-500 transition-colors"
              >
                + Create "{input.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
