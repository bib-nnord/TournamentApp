"use client";

import React from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useFetch } from "@/hooks/useFetch";
import { teamRoleColors } from "@/lib/colors";
import type { TeamRole } from "@/types";

interface MyTeam {
  id: number;
  name: string;
  role: TeamRole;
  members: number;
  open: boolean;
}

export default function TeamsPage() {
  const user = useRequireAuth();
  const { data, loading, error } = useFetch<{ teams: MyTeam[] }>(user ? "/teams/my" : null);
  const teams = data?.teams ?? [];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Teams</h1>
          <Link
            href="/teams/create"
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Create team
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-400">Loading teams…</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : teams.length === 0 ? (
            <p className="text-gray-500">You are not part of any teams yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {teams.map((team) => (
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
      </div>
    </div>
  );
}
