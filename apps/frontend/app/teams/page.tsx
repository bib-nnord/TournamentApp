"use client";

import React, { useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { useNotify } from "@/hooks/useNotify";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiFetch } from "@/lib/api";
import { teamRoleColors } from "@/lib/colors";
import type { TeamRole } from "@/types";
import Link from "next/link";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

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
  allowApplications?: boolean;
  members: number;
}

export default function TeamsPage() {
  const user = useRequireAuth();
  const notify = useNotify();
  const { data, loading, error, setData } = useFetch<{ teams: MyTeam[] }>(user ? "/teams/my" : null);
  const { data: allData, loading: allLoading, setData: setAllData } = useFetch<{ teams: PublicTeam[] }>(
    user ? "/teams?limit=20" : null
  );

  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());
  const [joinError, setJoinError] = useState<string | null>(null);

  const myTeams = data?.teams ?? [];
  const myTeamIds = new Set(myTeams.map((t) => t.id));
  const discoverTeams = (allData?.teams ?? []).filter(
    (t) => !myTeamIds.has(t.id) && !appliedIds.has(t.id)
  );

  async function refreshMyTeams() {
    const res = await apiFetch("/teams/my");
    if (!res.ok) return;
    const refreshed = await res.json();
    setData(refreshed);
  }

  async function handleJoin(team: PublicTeam) {
    setJoiningId(team.id);
    setJoinError(null);
    try {
      const res = await apiFetch(`/teams/${team.id}/join`, { method: "POST" });
      if (res.ok) {
        await refreshMyTeams();
        setAllData((prev) =>
          prev
            ? { teams: prev.teams.filter((t) => t.id !== team.id) }
            : prev
        );
        notify.success(`Joined ${team.name}.`);
      } else {
        const body = await res.json().catch(() => ({}));
        const message = body.error ?? "Failed to join team";
        setJoinError(message);
        notify.error(message);
      }
    } catch {
      const message = "Failed to join team";
      setJoinError(message);
      notify.error(message);
    } finally {
      setJoiningId(null);
    }
  }

  async function handleApply(team: PublicTeam) {
    setApplyingId(team.id);
    setJoinError(null);
    try {
      const res = await apiFetch(`/teams/${team.id}/apply`, { method: "POST" });
      if (res.ok) {
        setAppliedIds((prev) => new Set([...prev, team.id]));
        notify.success(`Application sent to ${team.name}.`);
      } else {
        const body = await res.json().catch(() => ({}));
        const message = body.error ?? "Failed to apply to team";
        setJoinError(message);
        notify.error(message);
      }
    } catch {
      const message = "Failed to apply to team";
      setJoinError(message);
      notify.error(message);
    } finally {
      setApplyingId(null);
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
            <Accordion type="multiple" className="flex flex-col gap-2">
              {myTeams.map((team) => (
                <AccordionItem key={team.id} value={String(team.id)} className="rounded-lg border border-gray-100">
                  <AccordionTrigger className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-800">{team.name}</span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-xs text-gray-400">{team.members} members</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${team.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {team.open ? "Open" : "Closed"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${teamRoleColors[team.role]}`}>
                        {team.role}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{team.members} members · {team.open ? "Open" : "Closed"} · {team.role}</span>
                      <Link
                        href={`/teams/${team.id}`}
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
            <Accordion type="multiple" className="flex flex-col gap-2">
              {discoverTeams.map((team) => (
                <AccordionItem key={team.id} value={String(team.id)} className="rounded-lg border border-gray-100">
                  <AccordionTrigger className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-800 truncate">{team.name}</span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-xs text-gray-400">{team.members} members</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${team.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {team.open ? "Open" : "Closed"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{team.members} members · {team.open ? "Recruiting" : "Invite only"}</span>
                      <div className="flex items-center gap-2">
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
                        {!team.open && team.allowApplications && (
                          <button
                            onClick={() => handleApply(team)}
                            disabled={applyingId === team.id}
                            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {applyingId === team.id ? "Applying…" : "Apply"}
                          </button>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

      </div>
    </div>
  );
}
