"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { messageCategoryColors } from "@/lib/colors";
import { messageCategoryLabel } from "@/constants/labels";
import {
  LABEL_BACK_TO_MESSAGES,
  LABEL_NEWER,
  LABEL_OLDER,
  LABEL_MARK_READ,
  LABEL_MARK_UNREAD,
  LABEL_MARK_ALL_AS_READ,
  LABEL_FILTER_ALL,
  LABEL_FILTER_USERS,
  LABEL_FILTER_TEAMS,
  LABEL_FILTER_TOURNAMENTS,
  LABEL_FILTER_WEBSITE,
} from "@/constants/labels";
import type { MessageCategory, Filter, Message } from "./types";

const filters: { label: string; value: Filter }[] = [
  { label: LABEL_FILTER_ALL, value: "all" },
  { label: LABEL_FILTER_USERS, value: "users" },
  { label: LABEL_FILTER_TEAMS, value: "teams" },
  { label: LABEL_FILTER_TOURNAMENTS, value: "tournaments" },
  { label: LABEL_FILTER_WEBSITE, value: "website" },
];

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const user = useRequireAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);

  // Compose state
  const [composing, setComposing] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiFetch("/messages?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages);
    } catch {
      // silently fail — user sees empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchMessages();
  }, [user, fetchMessages]);

  const filtered = messages.filter((m) =>
    activeFilter === "all" ? true : m.category === activeFilter
  );

  const unreadCount = messages.filter((m) => !m.read).length;
  const selectedCount = selected.size;
  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  const openMessage = messages.find((m) => m.id === openId) ?? null;

  async function openAndRead(id: number) {
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.read) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
      apiFetch(`/messages/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ read: true }),
      });
    }
    setOpenId(id);
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.add(m.id));
        return next;
      });
    }
  }

  async function markSelected(read: boolean) {
    const ids = [...selected];
    setMessages((prev) => prev.map((m) => (selected.has(m.id) ? { ...m, read } : m)));
    setSelected(new Set());
    await Promise.all(
      ids.map((id) =>
        apiFetch(`/messages/${id}/read`, {
          method: "PATCH",
          body: JSON.stringify({ read }),
        })
      )
    );
  }

  async function markAllRead() {
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    setSelected(new Set());
    await apiFetch("/messages/read-all", { method: "PATCH" });
  }

  function isInvitationMessage(m: Message) {
    return m.category === "tournaments" && m.subject.startsWith("You've been added") && m.referenceId != null;
  }

  async function handleInvitationResponse(message: Message, accept: boolean) {
    if (!message.referenceId) return;
    setRespondingTo(message.id);
    try {
      const res = await apiFetch(`/tournaments/${message.referenceId}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({ accept }),
      });
      if (res.ok) {
        if (accept) {
          router.push(`/tournaments/view/${message.referenceId}`);
        } else {
          setOpenId(null);
        }
      }
    } catch {
      // silently fail
    } finally {
      setRespondingTo(null);
    }
  }

  async function handleSendMessage() {
    if (!composeRecipient.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    setComposeError(null);
    try {
      const res = await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientUsername: composeRecipient.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setComposeError(data.error ?? "Failed to send message");
        return;
      }
      setComposing(false);
      setComposeRecipient("");
      setComposeSubject("");
      setComposeBody("");
      fetchMessages();
    } catch {
      setComposeError("Network error");
    } finally {
      setComposeSending(false);
    }
  }

  function handleReply(message: Message) {
    setComposeRecipient(message.from);
    setComposeSubject(message.subject.startsWith("Re: ") ? message.subject : `Re: ${message.subject}`);
    setComposeBody("");
    setComposeError(null);
    setComposing(true);
    setOpenId(null);
  }

  function handleNewMessage() {
    setComposeRecipient("");
    setComposeSubject("");
    setComposeBody("");
    setComposeError(null);
    setComposing(true);
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <p className="text-sm text-gray-500">Loading messages…</p>
        </div>
      </div>
    );
  }

  // --- Compose view ---
  if (composing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <button
            onClick={() => setComposing(false)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            {LABEL_BACK_TO_MESSAGES}
          </button>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New message</h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={composeRecipient}
                  onChange={(e) => { setComposeRecipient(e.target.value); setComposeError(null); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Subject</label>
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Message</label>
                <textarea
                  placeholder="Write your message…"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {composeError && <p className="text-xs text-red-500">{composeError}</p>}

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setComposing(false)}
                  className="text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={composeSending || !composeRecipient.trim() || !composeSubject.trim() || !composeBody.trim()}
                  className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                >
                  {composeSending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Detail view ---
  if (openMessage) {
    const idx = filtered.findIndex((m) => m.id === openMessage.id);
    const prev = filtered[idx - 1] ?? null;
    const next = filtered[idx + 1] ?? null;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* Back + navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setOpenId(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {LABEL_BACK_TO_MESSAGES}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => prev && openAndRead(prev.id)}
                disabled={!prev}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {LABEL_NEWER}
              </button>
              <button
                onClick={() => next && openAndRead(next.id)}
                disabled={!next}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {LABEL_OLDER}
              </button>
            </div>
          </div>

          {/* Message detail */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold text-gray-900">{openMessage.subject}</h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${messageCategoryColors[openMessage.category]}`}>
                    {messageCategoryLabel[openMessage.category]}
                  </span>
                  <span className="text-sm text-gray-500">from <span className="font-medium text-gray-700">{openMessage.from}</span></span>
                  <span className="text-xs text-gray-400">{relativeTime(openMessage.time)}</span>
                </div>
              </div>
              <button
                onClick={async () => {
                  const newRead = !openMessage.read;
                  setMessages((prev) => prev.map((m) => m.id === openMessage.id ? { ...m, read: newRead } : m));
                  await apiFetch(`/messages/${openMessage.id}/read`, {
                    method: "PATCH",
                    body: JSON.stringify({ read: newRead }),
                  });
                }}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 flex-shrink-0"
              >
                {openMessage.read ? LABEL_MARK_UNREAD : LABEL_MARK_READ}
              </button>
            </div>

            <hr className="border-gray-100 mb-4" />

            <p className="text-sm text-gray-700 leading-relaxed">{openMessage.body}</p>

            {isInvitationMessage(openMessage) && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleInvitationResponse(openMessage, false)}
                  disabled={respondingTo === openMessage.id}
                  className="text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleInvitationResponse(openMessage, true)}
                  disabled={respondingTo === openMessage.id}
                  className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                >
                  Accept
                </button>
              </div>
            )}

            {openMessage.senderId != null && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleReply(openMessage)}
                  className="text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Reply
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // --- List view ---
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {LABEL_MARK_ALL_AS_READ}
            </button>
            <button
              onClick={handleNewMessage}
              className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              New message
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {filters.map((f) => {
            const isActive = activeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Selection toolbar */}
        <div className="flex items-center justify-between h-9 mb-1 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-xs text-gray-500">
              {selectedCount > 0 ? `${selectedCount} selected` : "Select all"}
            </span>
          </label>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => markSelected(true)}
                className="text-xs px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                {LABEL_MARK_READ}
              </button>
              <button
                onClick={() => markSelected(false)}
                className="text-xs px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                {LABEL_MARK_UNREAD}
              </button>
            </div>
          )}
        </div>

        {/* Message list */}
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 px-1">No messages.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {filtered.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  selected.has(m.id) ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                {/* Checkbox — stops row click */}
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggleSelect(m.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 accent-indigo-600 flex-shrink-0 cursor-pointer"
                />

                {/* Clickable row content */}
                <button
                  onClick={() => openAndRead(m.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  {/* Unread dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${!m.read ? "bg-indigo-500" : "bg-transparent"}`} />

                  {/* Category badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${messageCategoryColors[m.category]}`}>
                    {messageCategoryLabel[m.category]}
                  </span>

                  {/* From */}
                  <span className={`text-sm w-28 flex-shrink-0 truncate ${!m.read ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                    {m.from}
                  </span>

                  {/* Subject + preview */}
                  <span className="text-sm flex-1 truncate min-w-0">
                    <span className={!m.read ? "font-semibold text-gray-900" : "text-gray-700"}>{m.subject}</span>
                    <span className="text-gray-400"> — {m.preview}</span>
                  </span>

                  {/* Time */}
                  <span className="text-xs text-gray-400 flex-shrink-0 w-16 text-right">{relativeTime(m.time)}</span>
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
