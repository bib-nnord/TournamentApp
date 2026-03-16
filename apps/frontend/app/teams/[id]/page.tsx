"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFetch } from "@/hooks/useFetch";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiFetch } from "@/lib/api";
import { teamRoleColors } from "@/lib/colors";
import { getUserInitial, getTeamPermissions } from "@/lib/helpers";
import { teamRoleLabel } from "@/constants/labels";
import type { TeamRelation as TeamRole } from "@/types";
import {
  LABEL_BACK_TO_TEAMS,
  LABEL_JOIN_TEAM,
  LABEL_REQUEST_TO_JOIN,
  LABEL_LEAVE_TEAM,
  LABEL_INVITE_MEMBER,
  LABEL_EDIT_TEAM,
  LABEL_DEMOTE,
  LABEL_PROMOTE,
  LABEL_KICK,
} from "@/constants/labels";

interface TeamMemberDto {
  id: number;
  username: string;
  displayName: string | null;
  role: "lead" | "moderator" | "member";
}

interface TeamDetailDto {
  id: number;
  name: string;
  description: string | null;
  open: boolean;
  disciplines: string[];
  members: TeamMemberDto[];
  membersCount: number;
  myRole: TeamRole;
}

interface TeamNewsItem {
  id: number;
  subject: string;
  body: string;
  read: boolean;
  time: string;
}

export default function TeamPage() {
  const user = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, setData } = useFetch<{ team: TeamDetailDto }>(id ? `/teams/${id}` : null);
  const { data: newsData, loading: newsLoading, setData: setNewsData } = useFetch<{ news: TeamNewsItem[] }>(
    id ? `/teams/${id}/news?limit=10` : null
  );
  const team = data?.team;
  const teamNews = newsData?.news ?? [];

  if (!user) return null;
  const userId = user.id;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-sm text-gray-400">Loading team…</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link href="/teams" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
            {LABEL_BACK_TO_TEAMS}
          </Link>
          <p className="text-sm text-red-500">{error || "Team not found"}</p>
        </div>
      </div>
    );
  }

  const currentUserRole = team.myRole;
  const { isLead, isModerator, isMember, isUnrelated, canManage } = getTeamPermissions(currentUserRole);

  async function doAction(key: string, fn: () => Promise<void>) {
    setActionLoading(key);
    setActionError(null);
    try {
      await fn();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleJoin() {
    await doAction("join", async () => {
      const res = await apiFetch(`/teams/${id}/join`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? "Failed to join");
        return;
      }
      const { team: updated } = await res.json();
      setData({ team: updated });
    });
  }

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this team?")) return;
    await doAction("leave", async () => {
      const res = await apiFetch(`/teams/${id}/leave`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? "Failed to leave");
        return;
      }
      setData((prev) =>
        prev
          ? {
              team: {
                ...prev.team,
                myRole: "none" as TeamRole,
                membersCount: prev.team.membersCount - 1,
                members: prev.team.members.filter((m) => m.id !== userId),
              },
            }
          : prev
      );
    });
  }

  async function handleKick(memberId: number) {
    await doAction(`kick-${memberId}`, async () => {
      const res = await apiFetch(`/teams/${id}/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? "Failed to kick member");
        return;
      }
      setData((prev) =>
        prev
          ? {
              team: {
                ...prev.team,
                membersCount: prev.team.membersCount - 1,
                members: prev.team.members.filter((m) => m.id !== memberId),
              },
            }
          : prev
      );
    });
  }

  async function handleChangeRole(memberId: number, newRole: "moderator" | "member") {
    await doAction(`role-${memberId}`, async () => {
      const res = await apiFetch(`/teams/${id}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? "Failed to update role");
        return;
      }
      const { member } = await res.json();
      setData((prev) =>
        prev
          ? {
              team: {
                ...prev.team,
                members: prev.team.members.map((m) => (m.id === memberId ? { ...m, role: member.role } : m)),
              },
            }
          : prev
      );
    });
  }

  async function handleInviteMember() {
    const username = window.prompt("Enter the username to invite:")?.trim();
    if (!username) return;

    await doAction("invite", async () => {
      const res = await apiFetch(`/teams/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? "Failed to send invite");
        return;
      }

      window.alert(`Invitation sent to ${username}.`);
    });
  }

  async function handleMarkAllNewsRead() {
    await doAction("news-read-all", async () => {
      const res = await apiFetch(`/teams/${id}/news/read-all`, { method: "PATCH" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? "Failed to mark team news as read");
        return;
      }

      setNewsData((prev) =>
        prev
          ? {
              news: prev.news.map((item) => ({ ...item, read: true })),
            }
          : prev
      );
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/teams" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          {LABEL_BACK_TO_TEAMS}
        </Link>

        {actionError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {actionError}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{team.description || "No description yet."}</p>
            </div>

            <div className="flex items-center gap-2">
              {currentUserRole !== "none" && (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${teamRoleColors[currentUserRole as "lead" | "moderator" | "member"]}`}>
                  {teamRoleLabel[currentUserRole as "lead" | "moderator" | "member"]}
                </span>
              )}
              {currentUserRole !== "none" && (
                <Link
                  href={`/teams/${team.id}/settings`}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500"
                  title={LABEL_EDIT_TEAM}
                >
                  {LABEL_EDIT_TEAM}
                </Link>
              )}
            </div>
          </div>

          {/* Disciplines */}
          {team.disciplines.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {team.disciplines.map((d) => (
                <span key={d} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Open/closed */}
          <div className="mt-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${team.open ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
              {team.open ? "Open" : "Closed"}
            </span>
          </div>

          <div className="flex gap-2 mt-5 flex-wrap">
            {isUnrelated && (
              <button
                onClick={handleJoin}
                disabled={!team.open || actionLoading === "join"}
                title={!team.open ? "This team is closed — join by invitation only" : undefined}
                className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                {actionLoading === "join" ? "Joining…" : team.open ? LABEL_JOIN_TEAM : LABEL_REQUEST_TO_JOIN}
              </button>
            )}

            {(isMember || isModerator) && (
              <button
                onClick={handleLeave}
                disabled={actionLoading === "leave"}
                className="text-sm px-4 py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-60"
              >
                {actionLoading === "leave" ? "Leaving…" : LABEL_LEAVE_TEAM}
              </button>
            )}

            {(isModerator || isLead) && (
              <button
                onClick={handleInviteMember}
                disabled={actionLoading === "invite"}
                className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                {actionLoading === "invite" ? "Sending…" : LABEL_INVITE_MEMBER}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Team news</h2>
            {teamNews.some((item) => !item.read) && (
              <button
                onClick={handleMarkAllNewsRead}
                disabled={actionLoading === "news-read-all"}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 disabled:opacity-60"
              >
                {actionLoading === "news-read-all" ? "Marking…" : "Mark all as read"}
              </button>
            )}
          </div>
          {newsLoading ? (
            <p className="text-sm text-gray-400 mb-5">Loading team news…</p>
          ) : teamNews.length === 0 ? (
            <p className="text-sm text-gray-500 mb-5">No team news yet.</p>
          ) : (
            <div className="mb-5 flex flex-col gap-3">
              {teamNews.map((item) => (
                <div key={item.id} className={`px-3 py-2 rounded-lg border ${item.read ? "border-gray-100 bg-gray-50" : "border-indigo-100 bg-indigo-50"}`}>
                  <p className="text-sm font-medium text-gray-800">{item.subject}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{item.body}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(item.time).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-base font-semibold text-gray-800 mb-4">Members ({team.membersCount})</h2>
          <div className="flex flex-col gap-2">
            {team.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                    {getUserInitial(member.username)}
                  </div>
                  <Link href={`/profile/${member.username}`} className="text-sm text-gray-800 hover:underline">
                    {member.displayName || member.username}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teamRoleColors[member.role]}`}>
                    {teamRoleLabel[member.role]}
                  </span>
                </div>

                {canManage && member.role !== "lead" && member.id !== userId && (
                  <div className="flex gap-2">
                    {isLead && (
                      <button
                        onClick={() => handleChangeRole(member.id, member.role === "moderator" ? "member" : "moderator")}
                        disabled={!!actionLoading}
                        className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-60"
                      >
                        {actionLoading === `role-${member.id}` ? "…" : member.role === "moderator" ? LABEL_DEMOTE : LABEL_PROMOTE}
                      </button>
                    )}
                    {(isLead || (isModerator && member.role === "member")) && (
                      <button
                        onClick={() => handleKick(member.id)}
                        disabled={!!actionLoading}
                        className="text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 text-red-500 disabled:opacity-60"
                      >
                        {actionLoading === `kick-${member.id}` ? "…" : LABEL_KICK}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
