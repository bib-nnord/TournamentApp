"use client";

import { useState } from "react";

// Placeholder — replace with real data once backend is ready
const initialFriends = [
  { id: "u1", username: "alice", online: true },
  { id: "u2", username: "bob", online: false },
  { id: "u3", username: "charlie", online: true },
  { id: "u4", username: "diana", online: false },
];

const incomingRequests = [
  { id: "u5", username: "eve" },
];

const outgoingRequests = [
  { id: "u6", username: "frank" },
];

export default function FriendsPage() {
  const [friends, setFriends] = useState(initialFriends);
  const [search, setSearch] = useState("");
  const [addInput, setAddInput] = useState("");

  const filtered = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>

        {/* Add friend */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Add friend</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter username..."
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setAddInput("")}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Send request
            </button>
          </div>
        </div>

        {/* Incoming requests */}
        {incomingRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              Incoming requests
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {incomingRequests.length}
              </span>
            </h2>
            <div className="flex flex-col gap-2">
              {incomingRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                      {r.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-800">{r.username}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      Accept
                    </button>
                    <button className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100">
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing requests */}
        {outgoingRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Pending</h2>
            <div className="flex flex-col gap-2">
              {outgoingRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                      {r.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-500">{r.username}</span>
                  </div>
                  <button className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-500">
                    Cancel
                  </button>
                </div>
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
            <p className="text-sm text-gray-400">No friends found.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {f.username[0].toUpperCase()}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${f.online ? "bg-green-500" : "bg-gray-300"}`} />
                    </div>
                    <span className="text-sm text-gray-800">{f.username}</span>
                    {f.online && <span className="text-xs text-gray-400">Online</span>}
                  </div>
                  <button
                    onClick={() => setFriends((prev) => prev.filter((x) => x.id !== f.id))}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
