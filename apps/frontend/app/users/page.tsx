"use client";


import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { getUserInitial } from "@/lib/helpers";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            {total > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {total}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 flex gap-2">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or display name…"
            className="flex-1 bg-white"
          />
          <Button
            variant={sort === "asc" ? "default" : "outline"}
            onClick={() => {
              setSort("asc");
              setPage(1);
            }}
            title="Sort A → Z"
          >
            A→Z
          </Button>
          <Button
            variant={sort === "desc" ? "default" : "outline"}
            onClick={() => {
              setSort("desc");
              setPage(1);
            }}
            title="Sort Z → A"
          >
            Z→A
          </Button>
        </div>

        {/* User list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <Card className="overflow-y-auto min-h-[26rem] max-h-[calc(100vh-14rem)]">
            <CardContent className="p-0 divide-y divide-muted">
              {users.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${u.username}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-accent transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt={u.username} />
                    ) : (
                      <AvatarFallback>{getUserInitial(u.username)}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{u.displayName || u.username}</span>
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    </div>
                    {u.bio && (
                      <p className="text-xs text-muted-foreground truncate">{u.bio}</p>
                    )}
                  </div>
                  {u.location && (
                    <span className="text-xs text-muted-foreground shrink-0">{u.location}</span>
                  )}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
