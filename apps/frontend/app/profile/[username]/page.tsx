"use client";

import { useState, useCallback } from "react";
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
import { apiFetch } from "@/lib/api";
import UserListItem from "@/components/UserListItem";
import type { TournamentSummary } from "@/components/TournamentList/types";
import type { Friend } from "@/types";

interface MyTeam {
  id: number;
  name: string;
  role: TeamRole;
  members: number;
  open: boolean;
}

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "blocked" | "self";

interface FriendStatusData {
  status: FriendshipStatus;
  friendshipId?: number;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const user = useSelector((state: RootState) => state.auth.user);
  const isOwnProfile = user?.username === username;

  const friendsUrl = isOwnProfile ? "/friends" : `/friends/user/${username}`;
  const { data: friendsData, loading: friendsLoading } = useFetch<{ friends: Friend[] }>(friendsUrl);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const { data: teamsData, loading: teamsLoading } = useFetch<{ teams: MyTeam[] }>("/teams/my");
  const { data: tournamentsData, loading: tournamentsLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?limit=20");
  const { data: friendStatus, setData: setFriendStatus } = useFetch<FriendStatusData>(
    !isOwnProfile ? `/friends/status/${username}` : null
  );
  const [friendLoading, setFriendLoading] = useState(false);
  const myTournaments = (tournamentsData?.tournaments ?? []).filter(
    (t) => t.creator.username === username
  );

  const handleAddFriend = useCallback(async () => {
    setFriendLoading(true);
    try {
      const res = await apiFetch("/friends/request", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        const { friendship } = await res.json();
        setFriendStatus({ status: "pending_sent", friendshipId: friendship.id });
      }
    } catch {
      /* ignore */
    } finally {
      setFriendLoading(false);
    }
  }, [username, setFriendStatus]);

  const handleAcceptRequest = useCallback(async () => {
    if (!friendStatus?.friendshipId) return;
    setFriendLoading(true);
    try {
      const res = await apiFetch(`/friends/${friendStatus.friendshipId}/accept`, {
        method: "PATCH",
      });
      if (res.ok) {
        const { friendship } = await res.json();
        setFriendStatus({ status: "accepted", friendshipId: friendship.id });
      }
    } catch {
      /* ignore */
    } finally {
      setFriendLoading(false);
    }
  }, [friendStatus, setFriendStatus]);

  const handleDeclineRequest = useCallback(async () => {
    if (!friendStatus?.friendshipId) return;
    setFriendLoading(true);
    try {
      const res = await apiFetch(`/friends/${friendStatus.friendshipId}/decline`, {
        method: "PATCH",
      });
      if (res.ok) {
        setFriendStatus({ status: "none" });
      }
    } catch {
      /* ignore */
    } finally {
      setFriendLoading(false);
    }
  }, [friendStatus, setFriendStatus]);

  const handleRemoveFriend = useCallback(async () => {
    if (!friendStatus?.friendshipId) return;
    setFriendLoading(true);
    try {
      const res = await apiFetch(`/friends/${friendStatus.friendshipId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFriendStatus({ status: "none" });
      }
    } catch {
      /* ignore */
    } finally {
      setFriendLoading(false);
    }
  }, [friendStatus, setFriendStatus]);

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
          {!isOwnProfile && friendStatus && friendStatus.status === "none" && (
            <button
              onClick={handleAddFriend}
              disabled={friendLoading}
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {friendLoading ? "Sending…" : "Add Friend"}
            </button>
          )}
          {!isOwnProfile && friendStatus && friendStatus.status === "pending_sent" && (
            <button
              onClick={handleRemoveFriend}
              disabled={friendLoading}
              className="text-sm px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {friendLoading ? "Cancelling…" : "Request Sent"}
            </button>
          )}
          {!isOwnProfile && friendStatus && friendStatus.status === "pending_received" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAcceptRequest}
                disabled={friendLoading}
                className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {friendLoading ? "Accepting…" : "Accept Request"}
              </button>
              <button
                onClick={handleDeclineRequest}
                disabled={friendLoading}
                className="text-sm px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {friendLoading ? "Declining…" : "Decline"}
              </button>
            </div>
          )}
          {!isOwnProfile && friendStatus && friendStatus.status === "accepted" && (
            <button
              onClick={handleRemoveFriend}
              disabled={friendLoading}
              className="text-sm px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {friendLoading ? "Removing…" : "Remove Friend"}
            </button>
          )}
        </div>

        {/* Friends */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Friends <span className="text-gray-400 font-normal">({friendsData?.friends.length ?? 0})</span>
            </h2>
            {isOwnProfile ? (
              <Link href="/friends" className="text-xs text-blue-600 hover:underline">{LABEL_VIEW_ALL}</Link>
            ) : (friendsData?.friends.length ?? 0) > 3 ? (
              <button onClick={() => setShowAllFriends((v) => !v)} className="text-xs text-blue-600 hover:underline">
                {showAllFriends ? "Show less" : LABEL_VIEW_ALL}
              </button>
            ) : null}
          </div>
          {friendsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (friendsData?.friends.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400">No friends yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(showAllFriends ? friendsData!.friends : friendsData!.friends.slice(0, 3)).map((f) => (
                <UserListItem key={f.id} username={f.username} />
              ))}
            </div>
          )}
        </div>

        {/* My teams */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{isOwnProfile ? "My teams" : "Teams"}</h2>
          {teamsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (teamsData?.teams.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400">No teams yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {teamsData!.teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{t.members} members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {t.open ? "Open" : "Closed"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${teamRoleColors[t.role]}`}>
                      {t.role}
                    </span>
                  </div>
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
