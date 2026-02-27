"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface VideoSummary {
  id: number;
  youtube_id: string;
  title: string;
  thumbnail: string;
  summary_en: string;
  summary_zh: string;
  favorited: number;
  created_at: string;
  tags: Tag[];
}

interface TimeGroup {
  label: string;
  videos: VideoSummary[];
}

function groupByTime(videos: VideoSummary[]): TimeGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneDay = 86400000;

  const buckets: { label: string; maxAge: number }[] = [
    { label: "Today", maxAge: oneDay },
    { label: "Yesterday", maxAge: 2 * oneDay },
    { label: "This Week", maxAge: 7 * oneDay },
    { label: "Two Weeks Ago", maxAge: 14 * oneDay },
    { label: "This Month", maxAge: 30 * oneDay },
    { label: "Last Month", maxAge: 60 * oneDay },
    { label: "Older", maxAge: Infinity },
  ];

  const groups: Map<string, VideoSummary[]> = new Map();

  for (const video of videos) {
    const created = new Date(video.created_at + "Z");
    const age = today.getTime() - new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();

    for (const bucket of buckets) {
      if (age < bucket.maxAge) {
        if (!groups.has(bucket.label)) groups.set(bucket.label, []);
        groups.get(bucket.label)!.push(video);
        break;
      }
    }
  }

  return buckets
    .filter((b) => groups.has(b.label))
    .map((b) => ({ label: b.label, videos: groups.get(b.label)! }));
}

export default function HistoryPage() {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/history");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setVideos(data.videos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const handleDelete = useCallback(async (youtubeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this video summary?")) return;
    try {
      await fetch(`/api/videos/${youtubeId}`, { method: "DELETE" });
      setVideos((prev) => prev.filter((v) => v.youtube_id !== youtubeId));
    } catch { /* ignore */ }
  }, []);

  const handleFavorite = useCallback(async (youtubeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/videos/${youtubeId}/favorite`, { method: "POST" });
      const data = await res.json();
      setVideos((prev) =>
        prev.map((v) =>
          v.youtube_id === youtubeId ? { ...v, favorited: data.favorited ? 1 : 0 } : v
        )
      );
    } catch { /* ignore */ }
  }, []);

  // Collect all unique tags from videos
  const allTags = useMemo(() => {
    const map = new Map<number, Tag>();
    for (const v of videos) {
      for (const t of (v.tags || [])) {
        if (!map.has(t.id)) map.set(t.id, t);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [videos]);

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let result = videos;
    if (showFavOnly) {
      result = result.filter((v) => v.favorited);
    }
    if (selectedTagIds.size > 0) {
      result = result.filter((v) =>
        (v.tags || []).some(t => selectedTagIds.has(t.id))
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.summary_en && v.summary_en.toLowerCase().includes(q)) ||
          (v.summary_zh && v.summary_zh.toLowerCase().includes(q))
      );
    }
    return result;
  }, [videos, search, showFavOnly, selectedTagIds]);

  const groups = useMemo(() => groupByTime(filtered), [filtered]);
  const favCount = useMemo(() => videos.filter((v) => v.favorited).length, [videos]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <svg className="animate-spin mx-auto h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-zinc-400 mt-4">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">History</h1>
        <span className="text-sm text-zinc-500">
          {videos.length} video{videos.length !== 1 ? "s" : ""} analyzed
        </span>
      </div>

      {/* Search + Filter */}
      {videos.length > 0 && (
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by title or summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-colors text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFavOnly(!showFavOnly)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all shrink-0 ${
              showFavOnly
                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            <span>{showFavOnly ? "★" : "☆"}</span>
            <span>Favorites{favCount > 0 ? ` (${favCount})` : ""}</span>
          </button>
        </div>
      )}

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedTagIds.has(tag.id)
                  ? "text-white border-transparent"
                  : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
              }`}
              style={selectedTagIds.has(tag.id) ? { backgroundColor: tag.color } : {}}
            >
              {tag.name}
            </button>
          ))}
          {selectedTagIds.size > 0 && (
            <button
              onClick={() => setSelectedTagIds(new Set())}
              className="px-3 py-1.5 rounded-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Empty States */}
      {videos.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <p className="text-lg mb-2">No videos analyzed yet</p>
          <Link href="/" className="text-blue-500 hover:text-blue-400 transition-colors">
            Summarize your first video
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <p className="text-lg mb-2">
            {showFavOnly ? "No favorites yet" : `No results for "${search}"`}
          </p>
          <button
            onClick={() => { setSearch(""); setShowFavOnly(false); }}
            className="text-blue-500 hover:text-blue-400 transition-colors text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        /* Grouped Results */
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  {group.label}
                </h2>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800/60" />
                <span className="text-xs text-zinc-600">{group.videos.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {group.videos.map((video) => (
                  <Link
                    key={video.id}
                    href={`/?v=${video.youtube_id}`}
                    className="group relative block bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg hover:shadow-zinc-300/20 dark:hover:shadow-black/20 transition-all"
                  >
                    <div className="relative aspect-video">
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleFavorite(video.youtube_id, e)}
                          className={`p-1.5 rounded-lg backdrop-blur-sm transition-all ${
                            video.favorited
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-black/50 text-zinc-400 hover:text-yellow-400"
                          }`}
                          title={video.favorited ? "Unfavorite" : "Favorite"}
                        >
                          <span className="text-sm">{video.favorited ? "★" : "☆"}</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(video.youtube_id, e)}
                          className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-zinc-400 hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {video.favorited ? (
                        <div className="absolute top-2 left-2 text-yellow-400 text-sm group-hover:opacity-0 transition-opacity">
                          ★
                        </div>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 mb-2 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-sm text-zinc-500 line-clamp-2 mb-3">
                        {video.summary_en || video.summary_zh || ""}
                      </p>
                      {video.tags && video.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {video.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-zinc-600">
                        <span>
                          {new Date(video.created_at + "Z").toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
