"use client";

import { useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useFetch } from "@/hooks/useFetch";
import { useNotify } from "@/hooks/useNotify";
import { apiFetch } from "@/lib/api";
import {
  LABEL_SEND_REQUEST,
  LABEL_ACCEPT,
  LABEL_DECLINE,
  LABEL_CANCEL,
  LABEL_REMOVE,
} from "@/constants/labels";
import UserListItem from "@/components/UserListItem";
import UserSearchInput from "@/components/UserSearchInput";
import type { Friend, FriendRequest } from "@/types";

export default function FriendsPage() {
  const user = useRequireAuth();
  const notify = useNotify();
  const { data: friendsData, setData: setFriendsData, loading: friendsLoading } =
    useFetch<{ friends: Friend[] }>("/friends");
  const { data: requestsData, setData: setRequestsData, loading: requestsLoading } =
    useFetch<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/friends/requests");

  const [search, setSearch] = useState("");
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!user) return null;

  const friends = friendsData?.friends ?? [];
  const incoming = requestsData?.incoming ?? [];
  const outgoing = requestsData?.outgoing ?? [];

  const filtered = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSendRequest() {
    const username = addInput.trim();
    if (!username) return;
    setSending(true);
    setAddError(null);
    try {
      const res = await apiFetch("/friends/request", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message = body.error ?? "Failed to send request";
        setAddError(message);
        notify.error(message);
        return;
      }
      setAddInput("");
      notify.success(`Friend request sent to ${username}.`);
      setRequestsData((prev) =>
        prev
          ? { ...prev, outgoing: [body.friendship, ...prev.outgoing] }
          : prev
      );
    } catch {
      const message = "Network error";
      setAddError(message);
      notify.error(message);
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(id: number) {
    try {
      const res = await apiFetch(`/friends/${id}/accept`, { method: "PATCH" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to accept friend request");
        return;
      }
      const body = await res.json();
      // Move from incoming to friends
      setRequestsData((prev) =>
        prev
          ? { ...prev, incoming: prev.incoming.filter((r) => r.id !== id) }
          : prev
      );
      setFriendsData((prev) =>
        prev
          ? { ...prev, friends: [body.friendship, ...prev.friends] }
          : prev
      );
      notify.success(`You are now friends with ${body.friendship.username}.`);
    } catch {
      notify.error("Network error");
    }
  }

  async function handleDecline(id: number) {
    try {
      const res = await apiFetch(`/friends/${id}/decline`, { method: "PATCH" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to decline friend request");
        return;
      }
      setRequestsData((prev) =>
        prev
          ? { ...prev, incoming: prev.incoming.filter((r) => r.id !== id) }
          : prev
      );
      notify.info("Friend request declined.");
    } catch {
      notify.error("Network error");
    }
  }

  async function handleCancelOutgoing(id: number) {
    try {
      const res = await apiFetch(`/friends/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to cancel request");
        return;
      }
      setRequestsData((prev) =>
        prev
          ? { ...prev, outgoing: prev.outgoing.filter((r) => r.id !== id) }
          : prev
      );
      notify.info("Friend request cancelled.");
    } catch {
      notify.error("Network error");
    }
  }

  async function handleRemoveFriend(id: number) {
    try {
      const res = await apiFetch(`/friends/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to remove friend");
        return;
      }
      setFriendsData((prev) =>
        prev
          ? { ...prev, friends: prev.friends.filter((f) => f.id !== id) }
          : prev
      );
      notify.info("Friend removed.");
    } catch {
      notify.error("Network error");
    }
  }

  const loading = friendsLoading || requestsLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>

        {/* Add friend */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Add friend</h2>
          <div className="flex gap-2">
            {addInput ? (
              <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-800 font-medium truncate">{addInput}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAddInput("");
                    setAddError(null);
                  }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <UserSearchInput
                onSelect={(username) => {
                  setAddInput(username);
                  setAddError(null);
                }}
                placeholder="Search users..."
                className="flex-1"
              />
            )}
            <button
              onClick={handleSendRequest}
              disabled={sending || !addInput.trim()}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? "Sending…" : LABEL_SEND_REQUEST}
            </button>
          </div>
          {addError && <p className="text-xs text-red-500 mt-2">{addError}</p>}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">
                  Incoming requests
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                    {incoming.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-2">
                  {incoming.map((r) => (
                    <UserListItem
                      key={r.id}
                      username={r.username}
                      className="bg-gray-50"
                      actions={
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(r.id)}
                            className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            {LABEL_ACCEPT}
                          </button>
                          <button
                            onClick={() => handleDecline(r.id)}
                            className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100"
                          >
                            {LABEL_DECLINE}
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing requests */}
            {outgoing.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Pending</h2>
                <div className="flex flex-col gap-2">
                  {outgoing.map((r) => (
                    <UserListItem
                      key={r.id}
                      username={r.username}
                      className="bg-gray-50"
                      actions={
                        <button
                          onClick={() => handleCancelOutgoing(r.id)}
                          className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-500"
                        >
                          {LABEL_CANCEL}
                        </button>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  Friends <span className="text-gray-400 font-normal">({friends.length})</span>
                </h2>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {friends.length === 0 ? "No friends yet." : "No friends found."}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map((f) => (
                    <UserListItem
                      key={f.id}
                      username={f.username}
                      actions={
                        <button
                          onClick={() => handleRemoveFriend(f.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          {LABEL_REMOVE}
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
