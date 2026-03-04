"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";
import type { RootState } from "@/store/store";
import type { TeamRole } from "@/types";
import { tournamentStatusLabel } from "@/types";
import { LABEL_EDIT_PROFILE, LABEL_VIEW_ALL } from "@/constants/labels";
import { teamRoleColors, tournamentStatusColors } from "@/lib/colors";
import { getUserInitial } from "@/lib/helpers";
import { useFetch } from "@/hooks/useFetch";
import UserListItem from "@/components/UserListItem";
import type { TournamentSummary } from "@/components/TournamentList/types";

// Placeholder data — replace with API calls once endpoints are ready
const friends = [
  { id: "u1", username: "alice", online: true },
  { id: "u2", username: "bob", online: false },
  { id: "u3", username: "charlie", online: true },
];

const myTeams = [
  { id: "t1", name: "The Knights", role: "lead" as TeamRole },
  { id: "t2", name: "Storm Squad", role: "member" as TeamRole },
];

const followedTeams = [
  { id: "t3", name: "Iron Bishops", members: 3, open: true },
  { id: "t4", name: "Rapid Rookies", members: 8, open: false },
];



export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const user = useSelector((state: RootState) => state.auth.user);
  const isOwnProfile = user?.username === username;

  const { data: tournamentsData, loading: tournamentsLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?limit=20");
  const myTournaments = (tournamentsData?.tournaments ?? []).filter(
    (t) => t.creator.username === username
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Profile header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex items-center gap-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
            {getUserInitial(username)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{username}</h1>
            {isOwnProfile && user && (
              <p className="text-sm text-gray-500">{user.email}</p>
            )}
          </div>
          {isOwnProfile && (
            <button className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              {LABEL_EDIT_PROFILE}
            </button>
          )}
        </div>

        {/* Friends */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Friends <span className="text-gray-400 font-normal">({friends.length})</span>
            </h2>
            <Link href="/friends" className="text-xs text-blue-600 hover:underline">{LABEL_VIEW_ALL}</Link>
          </div>
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <UserListItem key={f.id} username={f.username} online={f.online} showStatus />
            ))}
          </div>
        </div>

        {/* My teams */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{isOwnProfile ? "My teams" : "Teams"}</h2>
          <div className="flex flex-col gap-2">
            {myTeams.map((t) => (
              <Link
                key={t.id}
                href={`/teams/${t.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-800">{t.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${teamRoleColors[t.role]}`}>
                  {t.role}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Followed teams */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Followed teams</h2>
          {followedTeams.length === 0 ? (
            <p className="text-sm text-gray-400">No followed teams yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {followedTeams.map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{t.members} members</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {t.open ? "Open" : "Closed"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tournaments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{isOwnProfile ? "My tournaments" : "Tournaments"}</h2>
          {tournamentsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : myTournaments.length === 0 ? (
            <p className="text-sm text-gray-400">No tournaments yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {myTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/view/${t.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{t.game}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tournamentStatusColors[t.status]}`}>
                      {tournamentStatusLabel[t.status]}
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
