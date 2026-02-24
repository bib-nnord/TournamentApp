"use client";

import { useState } from "react";

type MessageCategory = "users" | "teams" | "tournaments" | "website";
type Filter = "all" | MessageCategory;

interface Message {
  id: string;
  category: MessageCategory;
  from: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  read: boolean;
}

const initialMessages: Message[] = [
  { id: "m1", category: "users", from: "alice", subject: "Good game!", preview: "That was a great match, well played in the final round.", body: "That was a great match, well played in the final round. Your opening strategy really caught me off guard — I'd love to play again sometime. Let me know if you're joining any upcoming tournaments!", time: "2h ago", read: false },
  { id: "m2", category: "users", from: "bob", subject: "Weekend tournament?", preview: "Are you joining the weekend blitz? We need one more player.", body: "Are you joining the weekend blitz? We need one more player to fill the bracket. It starts Saturday at 10:00 and should wrap up by the afternoon. Let me know by Friday!", time: "Yesterday", read: true },
  { id: "m3", category: "teams", from: "The Knights", subject: "Practice session scheduled", preview: "Team practice this Saturday at 14:00. Please confirm attendance.", body: "Team practice this Saturday at 14:00. Please confirm your attendance by Friday evening so we can plan the session. We'll be focusing on endgame techniques and reviewing last week's tournament games.", time: "3h ago", read: false },
  { id: "m4", category: "teams", from: "Storm Squad", subject: "New team member", preview: "charlie has joined Storm Squad. Welcome them to the team!", body: "charlie has joined Storm Squad. Welcome them to the team! Feel free to reach out and introduce yourself. We're excited to have another player on board ahead of the Spring Open.", time: "2 days ago", read: true },
  { id: "m5", category: "tournaments", from: "Spring Open 2025", subject: "Round 3 results", preview: "Round 3 is complete. Your next match is on March 18th at 15:00.", body: "Round 3 is complete. You won your match and advance to Round 4. Your next match is scheduled for March 18th at 15:00 against player 'magnus_jr'. Good luck!", time: "1h ago", read: false },
  { id: "m6", category: "tournaments", from: "Weekly Blitz #42", subject: "Tournament starting soon", preview: "Your tournament begins in 30 minutes. Get ready!", body: "Your tournament begins in 30 minutes. Please make sure you are logged in and ready to play. The first round will be paired automatically at the scheduled start time. Good luck!", time: "4h ago", read: true },
  { id: "m7", category: "tournaments", from: "City Chess Cup", subject: "You placed 4th", preview: "Congratulations on finishing 4th out of 32 participants.", body: "Congratulations on finishing 4th out of 32 participants in the City Chess Cup! It was a strong performance throughout the event. Final standings and game records are now available on the tournament page.", time: "Jan 12", read: true },
  { id: "m8", category: "website", from: "Tournament App", subject: "Welcome to Tournament App!", preview: "Thanks for joining. Browse tournaments, create your team, and compete.", body: "Thanks for joining Tournament App! You can browse upcoming tournaments, create or join a team, and track your results all in one place. If you have any questions, visit the help section or reach out to support.", time: "Jan 2025", read: true },
  { id: "m9", category: "website", from: "Tournament App", subject: "New feature: Team chat", preview: "You can now message your team directly from the team page.", body: "You can now message your team directly from the team page. Head to any team you're a member of and look for the new Messages tab. Team leads and moderators can also pin important announcements.", time: "Feb 10", read: false },
];

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Users", value: "users" },
  { label: "Teams", value: "teams" },
  { label: "Tournaments", value: "tournaments" },
  { label: "Website", value: "website" },
];

const categoryBadge: Record<MessageCategory, string> = {
  users: "bg-indigo-100 text-indigo-700",
  teams: "bg-yellow-100 text-yellow-700",
  tournaments: "bg-blue-100 text-blue-700",
  website: "bg-gray-100 text-gray-600",
};

const categoryLabel: Record<MessageCategory, string> = {
  users: "User",
  teams: "Team",
  tournaments: "Tournament",
  website: "Website",
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = messages.filter((m) =>
    activeFilter === "all" ? true : m.category === activeFilter
  );

  const unreadCount = messages.filter((m) => !m.read).length;
  const selectedCount = selected.size;
  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  const openMessage = messages.find((m) => m.id === openId) ?? null;

  function openAndRead(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
    setOpenId(id);
  }

  function toggleSelect(id: string) {
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

  function markSelected(read: boolean) {
    setMessages((prev) => prev.map((m) => (selected.has(m.id) ? { ...m, read } : m)));
    setSelected(new Set());
  }

  function markAllRead() {
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    setSelected(new Set());
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
              ← Back to messages
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => prev && openAndRead(prev.id)}
                disabled={!prev}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ↑ Newer
              </button>
              <button
                onClick={() => next && openAndRead(next.id)}
                disabled={!next}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ↓ Older
              </button>
            </div>
          </div>

          {/* Message detail */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold text-gray-900">{openMessage.subject}</h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryBadge[openMessage.category]}`}>
                    {categoryLabel[openMessage.category]}
                  </span>
                  <span className="text-sm text-gray-500">from <span className="font-medium text-gray-700">{openMessage.from}</span></span>
                  <span className="text-xs text-gray-400">{openMessage.time}</span>
                </div>
              </div>
              <button
                onClick={() => setMessages((prev) => prev.map((m) => m.id === openMessage.id ? { ...m, read: !m.read } : m))}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 flex-shrink-0"
              >
                {openMessage.read ? "Mark unread" : "Mark read"}
              </button>
            </div>

            <hr className="border-gray-100 mb-4" />

            <p className="text-sm text-gray-700 leading-relaxed">{openMessage.body}</p>
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
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Mark all as read
          </button>
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
                Mark read
              </button>
              <button
                onClick={() => markSelected(false)}
                className="text-xs px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Mark unread
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${categoryBadge[m.category]}`}>
                    {categoryLabel[m.category]}
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
                  <span className="text-xs text-gray-400 flex-shrink-0 w-16 text-right">{m.time}</span>
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
