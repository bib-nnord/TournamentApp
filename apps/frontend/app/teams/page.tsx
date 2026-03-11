"use client";

import React from "react";

export default function TeamsPage() {
  // TODO: Fetch and display user's teams
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Teams</h1>
        <a
          href="/teams/create"
          className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Create team
        </a>
      </div>
      {/* Teams list will go here */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-gray-500">You are not part of any teams yet.</p>
      </div>
    </div>
  );
}
