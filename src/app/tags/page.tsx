"use client";

import { useEffect, useState, useCallback } from "react";

interface Tag {
  id: number;
  name: string;
  color: string;
  videoCount: number;
}

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#14B8A6",
];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const fetchTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    const data = await res.json();
    setTags(data.tags);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    if (res.ok) {
      setNewName("");
      fetchTags();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to create tag");
    }
  };

  const handleUpdate = async (id: number) => {
    await fetch("/api/tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, color: editColor }),
    });
    setEditingId(null);
    fetchTags();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete tag "${name}"? It will be removed from all videos.`)) return;
    await fetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchTags();
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-400">Loading tags...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">Manage Tags</h1>

      {/* Create new tag */}
      <div className="flex gap-3 mb-8 items-end">
        <div className="flex-1">
          <label className="block text-xs text-zinc-500 mb-1.5">New Tag</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Tag name..."
            className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Color</label>
          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-7 h-7 rounded-md transition-all ${newColor === c ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 ring-zinc-400 dark:ring-white scale-110" : "hover:scale-105"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          Add
        </button>
      </div>

      {/* Tag list */}
      {tags.length === 0 ? (
        <p className="text-center text-zinc-500 py-8">No tags yet. Create one above or analyze a video — the AI will suggest tags automatically.</p>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl"
            >
              {editingId === tag.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(tag.id)}
                    className="flex-1 px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-800 dark:text-zinc-200"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-5 h-5 rounded transition-all ${editColor === c ? "ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 ring-zinc-400 dark:ring-white scale-110" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button onClick={() => handleUpdate(tag.id)} className="text-green-400 hover:text-green-300 text-sm">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300 text-sm">Cancel</button>
                </>
              ) : (
                <>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 font-medium">{tag.name}</span>
                  <span className="text-xs text-zinc-500">{tag.videoCount} video{tag.videoCount !== 1 ? "s" : ""}</span>
                  <button onClick={() => startEdit(tag)} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Edit</button>
                  <button onClick={() => handleDelete(tag.id, tag.name)} className="text-zinc-500 hover:text-red-400 text-sm transition-colors">Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
