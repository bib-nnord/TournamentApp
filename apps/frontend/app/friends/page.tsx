"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import UserListItem from "@/components/UserListItem";
import UserSearchInput from "@/components/UserSearchInput";
import {
  LABEL_SEND_REQUEST,
  LABEL_ACCEPT,
  LABEL_DECLINE,
  LABEL_CANCEL,
  LABEL_REMOVE,
} from "@/constants/labels";
import { useFetch } from "@/hooks/useFetch";
import { useNotify } from "@/hooks/useNotify";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiFetch } from "@/lib/api";
import type { Friend, FriendRequest } from "@/types";

export default function FriendsPage() {
  const user = useRequireAuth();
  const notify = useNotify();
  const { data: friendsData, setData: setFriendsData, loading: friendsLoading } =
    useFetch<{ friends: Friend[] }>("/friends");
  const { data: requestsData, setData: setRequestsData, loading: requestsLoading } =
    useFetch<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/friends/requests");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  if (!user) return null;

  const friends = friendsData?.friends ?? [];
  const incoming = requestsData?.incoming ?? [];
  const outgoing = requestsData?.outgoing ?? [];

  const filtered = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );
  const sortedFriends = [...filtered].sort((a, b) =>
    sort === "asc"
      ? a.username.localeCompare(b.username, undefined, { sensitivity: "base" })
      : b.username.localeCompare(a.username, undefined, { sensitivity: "base" })
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
    } finally {
      setConfirmRemoveId(null);
    }
  }

  const loading = friendsLoading || requestsLoading;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>

          {/* Add friend */}
          <div className="bg-white border border-gray-100 shadow-sm p-4 mb-0 rounded-t-2xl rounded-b-none">
            <div className="flex flex-row items-center gap-4 w-full">
              <span className="text-base font-semibold text-gray-800 whitespace-nowrap mr-2">Add friend</span>
              {addInput ? (
                <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-2 min-w-0 max-w-xl">
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
                  className="flex-1 w-80 max-w-xl text-sm h-11 px-4 py-2"
                  size="sm"
                />
              )}
              <button
                onClick={handleSendRequest}
                disabled={sending || !addInput.trim()}
                className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap ml-2"
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
                        className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
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
                        className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
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
              <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-b-2xl rounded-t-none">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-800">
                    Friends <span className="text-gray-400 font-normal">({friends.length})</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                    />
                    <button
                      onClick={() => setSort("asc")}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                        sort === "asc"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 text-gray-600 hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
                      }`}
                      title="Sort A → Z"
                    >
                      A→Z
                    </button>
                    <button
                      onClick={() => setSort("desc")}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                        sort === "desc"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 text-gray-600 hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
                      }`}
                      title="Sort Z → A"
                    >
                      Z→A
                    </button>
                  </div>
                </div>

                {sortedFriends.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    {friends.length === 0 ? "No friends yet." : "No friends found."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sortedFriends.map((f) => (
                      <UserListItem
                        key={f.id}
                        username={f.username}
                        actions={
                          <button
                            onClick={() => setConfirmRemoveId(f.id)}
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
      {/* Remove Friend Confirmation Modal */}
      <Modal
        isOpen={confirmRemoveId !== null}
        onClose={() => setConfirmRemoveId(null)}
        title="Remove Friend"
        size="sm"
      >
        <div className="mb-4">Are you sure you want to remove this friend?</div>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
            onClick={() => setConfirmRemoveId(null)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
            onClick={() => confirmRemoveId !== null && handleRemoveFriend(confirmRemoveId)}
          >
            Remove
          </button>
        </div>
      </Modal>
    </>
  );
}
