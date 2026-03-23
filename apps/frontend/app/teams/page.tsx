"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useFetch } from "@/hooks/useFetch";
import { apiFetch } from "@/lib/api";
import { teamRoleColors } from "@/lib/colors";
import type { TeamRole } from "@/types";

interface MyTeam {
  id: number;
  name: string;
  role: TeamRole;
  members: number;
  open: boolean;
}

interface PublicTeam {
  id: number;
  name: string;
  open: boolean;
  members: number;
}

export default function TeamsPage() {
  const user = useRequireAuth();
  const { data, loading, error } = useFetch<{ teams: MyTeam[] }>(user ? "/teams/my" : null);
  const { data: allData, loading: allLoading } = useFetch<{ teams: PublicTeam[] }>(
    user ? "/teams?limit=20" : null
  );

  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<number>>(new Set());
  const [joinError, setJoinError] = useState<string | null>(null);

  const myTeams = data?.teams ?? [];
  const myTeamIds = new Set(myTeams.map((t) => t.id));
  const discoverTeams = (allData?.teams ?? []).filter(
    (t) => !myTeamIds.has(t.id) && !joinedIds.has(t.id)
  );

  async function handleJoin(team: PublicTeam) {
    setJoiningId(team.id);
    setJoinError(null);
    try {
      const res = await apiFetch(`/teams/${team.id}/join`, { method: "POST" });
      if (res.ok) {
        setJoinedIds((prev) => new Set([...prev, team.id]));
      } else {
        const body = await res.json().catch(() => ({}));
        setJoinError(body.error ?? "Failed to join team");
      }
    } catch {
      setJoinError("Failed to join team");
    } finally {
      setJoiningId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-10 px-4">

        {/* ── My Teams ── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Teams</h1>
          <Link
            href="/teams/create"
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Create team
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm mb-10">
          {loading ? (
            <p className="text-sm text-gray-400">Loading teams…</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : myTeams.length === 0 ? (
            <p className="text-gray-500">You are not part of any teams yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {myTeams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{team.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{team.members} members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${team.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {team.open ? "Open" : "Closed"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${teamRoleColors[team.role]}`}>
                      {team.role}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Discover Teams ── */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Discover Teams</h2>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {joinError && (
            <p className="text-sm text-red-500 mb-4">{joinError}</p>
          )}
          {allLoading ? (
            <p className="text-sm text-gray-400">Loading teams…</p>
          ) : discoverTeams.length === 0 ? (
            <p className="text-gray-500">No other teams to discover right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {discoverTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{team.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{team.members} members</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${team.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {team.open ? "Open" : "Closed"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Link
                      href={`/teams/${team.id}`}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                    >
                      View
                    </Link>
                    {team.open && (
                      <button
                        onClick={() => handleJoin(team)}
                        disabled={joiningId === team.id}
                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {joiningId === team.id ? "Joining…" : "Join"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
