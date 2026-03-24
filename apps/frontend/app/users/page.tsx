"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { getUserInitial } from "@/lib/helpers";
import Link from "next/link";

interface UserItem {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    pointerId: -1,
    startY: 0,
    startScrollTop: 0,
    dragged: false,
  });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [isDraggingList, setIsDraggingList] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20", sort });
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await apiFetch(`/users?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, sort]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  function handleListPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const blockedTarget = target.closest("input, textarea, select, label, a, button");
    if (blockedTarget || !listRef.current) return;

    dragStateRef.current.pointerId = e.pointerId;
    dragStateRef.current.startY = e.clientY;
    dragStateRef.current.startScrollTop = listRef.current.scrollTop;
    dragStateRef.current.dragged = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleListPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current.pointerId !== e.pointerId || !listRef.current) return;

    const deltaY = e.clientY - dragStateRef.current.startY;
    if (!dragStateRef.current.dragged && Math.abs(deltaY) > 4) {
      dragStateRef.current.dragged = true;
      setIsDraggingList(true);
    }

    if (!dragStateRef.current.dragged) return;

    const container = listRef.current;
    container.scrollTop = dragStateRef.current.startScrollTop - deltaY;
  }

  function handleListPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStateRef.current.pointerId = -1;
    dragStateRef.current.dragged = false;
    setIsDraggingList(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            {total > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                {total}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or display name…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => {
              setSort("asc");
              setPage(1);
            }}
            className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
              sort === "asc"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
            title="Sort A → Z"
          >
            A→Z
          </button>
          <button
            onClick={() => {
              setSort("desc");
              setPage(1);
            }}
            className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
              sort === "desc"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
            title="Sort Z → A"
          >
            Z→A
          </button>
        </div>

        {/* User list */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500">No users found.</p>
        ) : (
          <div
            ref={listRef}
            onPointerDown={handleListPointerDown}
            onPointerMove={handleListPointerMove}
            onPointerUp={handleListPointerUp}
            onPointerCancel={handleListPointerUp}
            onPointerLeave={(e) => {
              if (dragStateRef.current.pointerId === e.pointerId) {
                handleListPointerUp(e);
              }
            }}
            className={`bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-y-auto min-h-[26rem] max-h-[calc(100vh-14rem)] overscroll-none touch-pan-y ${
              isDraggingList ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
          >
            {users.map((u) => (
              <Link
                key={u.id}
                href={`/profile/${u.username}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                  {getUserInitial(u.username)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{u.displayName || u.username}</span>
                    <span className="text-xs text-gray-400">@{u.username}</span>
                  </div>
                  {u.bio && (
                    <p className="text-xs text-gray-500 truncate">{u.bio}</p>
                  )}
                </div>
                {u.location && (
                  <span className="text-xs text-gray-400 shrink-0">{u.location}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
