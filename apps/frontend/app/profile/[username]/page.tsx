"use client";

 

import { useState, useCallback, useEffect } from "react";
import { useSelector } from "react-redux";
import type { TournamentSummary } from "@/components/TournamentList/types";
import UserListItem from "@/components/UserListItem";
import { LABEL_EDIT_PROFILE, LABEL_VIEW_ALL } from "@/constants/labels";
import { useFetch } from "@/hooks/useFetch";
import { useNotify } from "@/hooks/useNotify";
import { apiFetch } from "@/lib/api";
import { teamRoleColors, tournamentStatusColors } from "@/lib/colors";
import { getUserInitial } from "@/lib/helpers";
import type { RootState } from "@/store/store";
import type { Friend } from "@/types";
import type { TeamRole } from "@/types";
import { tournamentStatusLabel } from "@/types";
import Link from "next/link";
import { useParams } from "next/navigation";

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

interface ProfileData {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  bio: string | null;
  country: string | null;
  age: number | null;
  gamesSports: string[];
  dateOfBirth?: string | null;
  visibility?: {
    bio: boolean;
    country: boolean;
    age: boolean;
    gamesSports: boolean;
  };
}

interface ProfileFormState {
  displayName: string;
  bio: string;
  country: string;
  dateOfBirth: string;
  gamesSports: string;
  visibility: {
    bio: boolean;
    country: boolean;
    age: boolean;
    gamesSports: boolean;
  };
}

const emptyProfileForm: ProfileFormState = {
  displayName: "",
  bio: "",
  country: "",
  dateOfBirth: "",
  gamesSports: "",
  visibility: {
    bio: true,
    country: true,
    age: true,
    gamesSports: true,
  },
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const user = useSelector((state: RootState) => state.user.current);
  const notify = useNotify();
  const isOwnProfile = user?.username === username;
  const {
    data: profileData,
    loading: profileLoading,
    error: profileError,
    setData: setProfileData,
  } = useFetch<{
    profile: ProfileData;
  }>(`/users/profile/${username}`);
  const profile = profileData?.profile;
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm);

  const friendsUrl = isOwnProfile
    ? (user ? "/friends" : null)
    : `/friends/user/${username}`;
  const { data: friendsData, loading: friendsLoading } = useFetch<{ friends: Friend[] }>(friendsUrl);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const teamsUrl = isOwnProfile
    ? "/teams/my"
    : profile?.id
      ? `/teams/user/${profile.id}`
      : null;
  const { data: teamsData, loading: teamsLoading } = useFetch<{ teams: MyTeam[] }>(teamsUrl);
  const { data: tournamentsData, loading: tournamentsLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?limit=20");
  const { data: friendStatus, setData: setFriendStatus } = useFetch<FriendStatusData>(
    user && !isOwnProfile ? `/friends/status/${username}` : null
  );
  const [friendLoading, setFriendLoading] = useState(false);
  const myTournaments = (tournamentsData?.tournaments ?? []).filter((t) => {
    if (isOwnProfile) return t.creator.username === username || t.isJoined;
    return t.creator.username === username;
  });

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      displayName: profile.displayName ?? "",
      bio: profile.bio ?? "",
      country: profile.country ?? "",
      dateOfBirth: profile.dateOfBirth ?? "",
      gamesSports: profile.gamesSports.join(", "),
      visibility: {
        bio: profile.visibility?.bio ?? true,
        country: profile.visibility?.country ?? true,
        age: profile.visibility?.age ?? true,
        gamesSports: profile.visibility?.gamesSports ?? true,
      },
    });
  }, [profile]);

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
        notify.success(`Friend request sent to ${username}.`);
      } else {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to send friend request");
      }
    } catch {
      notify.error("Network error");
    } finally {
      setFriendLoading(false);
    }
  }, [username, setFriendStatus, notify]);

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
        notify.success(`You are now friends with ${username}.`);
      } else {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to accept friend request");
      }
    } catch {
      notify.error("Network error");
    } finally {
      setFriendLoading(false);
    }
  }, [friendStatus, setFriendStatus, notify, username]);

  const handleDeclineRequest = useCallback(async () => {
    if (!friendStatus?.friendshipId) return;
    setFriendLoading(true);
    try {
      const res = await apiFetch(`/friends/${friendStatus.friendshipId}/decline`, {
        method: "PATCH",
      });
      if (res.ok) {
        setFriendStatus({ status: "none" });
        notify.info("Friend request declined.");
      } else {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to decline friend request");
      }
    } catch {
      notify.error("Network error");
    } finally {
      setFriendLoading(false);
    }
  }, [friendStatus, setFriendStatus, notify]);

  const handleRemoveFriend = useCallback(async () => {
    if (!friendStatus?.friendshipId) return;
    setFriendLoading(true);
    try {
      const res = await apiFetch(`/friends/${friendStatus.friendshipId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFriendStatus({ status: "none" });
        notify.info("Friend removed.");
      } else {
        const body = await res.json().catch(() => ({}));
        notify.error(body.error ?? "Failed to remove friend");
      }
    } catch {
      notify.error("Network error");
    } finally {
      setFriendLoading(false);
    }
  }, [friendStatus, setFriendStatus, notify]);

  function updateProfileForm(patch: Partial<ProfileFormState>) {
    setProfileForm((prev) => ({ ...prev, ...patch }));
  }

  function updateProfileVisibility(
    key: keyof ProfileFormState["visibility"],
    value: boolean
  ) {
    setProfileForm((prev) => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        [key]: value,
      },
    }));
  }

  async function handleSaveProfile() {
    // Validate date of birth only on save
    const value = profileForm.dateOfBirth;
    if (value) {
      const date = new Date(value);
      const now = new Date();
      const hundredYearsAgo = new Date();
      hundredYearsAgo.setFullYear(now.getFullYear() - 100);
      if (date > now) {
        notify.error("Date of birth cannot be in the future.");
        return;
      }
      if (date < hundredYearsAgo) {
        notify.error("Date of birth cannot be more than 100 years ago.");
        return;
      }
    }
    setProfileSaving(true);
    setProfileSaveError(null);

    try {
      const res = await apiFetch("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileForm.displayName,
          bio: profileForm.bio,
          country: profileForm.country,
          dateOfBirth: profileForm.dateOfBirth,
          gamesSports: profileForm.gamesSports
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          visibility: profileForm.visibility,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setProfileSaveError(body.error ?? "Failed to save profile");
        return;
      }

      const refreshed = await apiFetch(`/users/profile/${username}`);
      if (refreshed.ok) {
        const nextProfile = await refreshed.json();
        setProfileData(nextProfile);
      }
      setEditingProfile(false);
    } catch {
      setProfileSaveError("Network error");
    } finally {
      setProfileSaving(false);
    }
  }

  function handleCancelProfileEdit() {
    if (!profile) return;
    setProfileForm({
      displayName: profile.displayName ?? "",
      bio: profile.bio ?? "",
      country: profile.country ?? "",
      dateOfBirth: profile.dateOfBirth ?? "",
      gamesSports: profile.gamesSports.join(", "),
      visibility: {
        bio: profile.visibility?.bio ?? true,
        country: profile.visibility?.country ?? true,
        age: profile.visibility?.age ?? true,
        gamesSports: profile.visibility?.gamesSports ?? true,
      },
    });
    setProfileSaveError(null);
    setEditingProfile(false);
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-sm text-gray-400">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-sm text-red-500">{profileError || "Profile not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Profile header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex items-center gap-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
            {getUserInitial(username)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">
              {profile.displayName || profile.username}
            </h1>
            <p className="text-sm text-gray-500">@{profile.username}</p>
            {isOwnProfile && profile.email && (
              <p className="text-sm text-gray-500">{profile.email}</p>
            )}
          </div>
          {isOwnProfile && (
            <button
              onClick={() => {
                setProfileSaveError(null);
                setEditingProfile((prev) => !prev);
              }}
              className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
            >
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
              className="text-sm px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 disabled:opacity-50"
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
                className="text-sm px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 disabled:opacity-50"
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h2 className="text-base font-semibold text-gray-800">User info</h2>
            {isOwnProfile && editingProfile && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelProfileEdit}
                  disabled={profileSaving}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {profileSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {profileSaveError && (
              <p className="text-sm text-red-500">{profileSaveError}</p>
            )}

            {editingProfile ? (
              <>
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={profileForm.displayName}
                    onChange={(e) => updateProfileForm({ displayName: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Bio
                    </label>
                    <textarea
                      rows={4}
                      value={profileForm.bio}
                      onChange={(e) => updateProfileForm({ bio: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Visibility
                    </label>
                    <select
                      value={profileForm.visibility.bio ? "public" : "private"}
                      onChange={(e) => updateProfileVisibility("bio", e.target.value === "public")}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Country
                    </label>
                    <input
                      type="text"
                      value={profileForm.country}
                      onChange={(e) => updateProfileForm({ country: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Country visibility
                    </label>
                    <select
                      value={profileForm.visibility.country ? "public" : "private"}
                      onChange={(e) => updateProfileVisibility("country", e.target.value === "public")}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Date of birth
                    </label>
                    <input
                      type="date"
                      value={profileForm.dateOfBirth}
                      onChange={(e) => updateProfileForm({ dateOfBirth: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Only your age is shown publicly.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Age visibility
                    </label>
                    <select
                      value={profileForm.visibility.age ? "public" : "private"}
                      onChange={(e) => updateProfileVisibility("age", e.target.value === "public")}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Games / sports
                    </label>
                    <input
                      type="text"
                      value={profileForm.gamesSports}
                      onChange={(e) => updateProfileForm({ gamesSports: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Football, Chess, Valorant"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">
                      Visibility
                    </label>
                    <select
                      value={profileForm.visibility.gamesSports ? "public" : "private"}
                      onChange={(e) => updateProfileVisibility("gamesSports", e.target.value === "public")}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Bio */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                    Bio
                    {isOwnProfile && profile.visibility && !profile.visibility.bio && (
                      <span className="ml-1 text-xs text-gray-400">(private)</span>
                    )}
                  </p>
                  <p className={`text-sm text-gray-700 leading-6 ${!profile.bio ? "italic text-gray-400" : ""}`}>
                    {profile.bio || (isOwnProfile ? "No bio yet." : "No bio provided.")}
                  </p>
                </div>

                {/* Country & Age */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                      Country
                      {isOwnProfile && profile.visibility && !profile.visibility.country && (
                        <span className="ml-1 text-xs text-gray-400">(private)</span>
                      )}
                    </p>
                    <p className={`text-sm font-medium text-gray-700 ${!profile.country ? "italic text-gray-400" : ""}`}>
                      {profile.country || (isOwnProfile ? "No country set." : "No country provided.")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                      Age
                      {isOwnProfile && profile.visibility && !profile.visibility.age && (
                        <span className="ml-1 text-xs text-gray-400">(private)</span>
                      )}
                    </p>
                    <p className={`text-sm font-medium text-gray-700 ${profile.age === null ? "italic text-gray-400" : ""}`}>
                      {profile.age !== null ? profile.age : (isOwnProfile ? "No age set." : "No age provided.")}
                    </p>
                  </div>
                </div>

                {/* Games / Sports */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Games / sports
                    {isOwnProfile && profile.visibility && !profile.visibility.gamesSports && (
                      <span className="ml-1 text-xs text-gray-400">(private)</span>
                    )}
                  </p>
                  {profile.gamesSports.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.gamesSports.map((item) => (
                        <span
                          key={item}
                          className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-gray-400">
                      {isOwnProfile ? "No games or sports set." : "No games or sports provided."}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">{isOwnProfile ? "My teams" : "Teams"}</h2>
            <Link href="/teams" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
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
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
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
              {myTournaments.map((t) => {
                // Only show placement for completed tournaments
                let placement: string | null = null;
                if (t.status === "completed" && t.bracketData) {
                  try {
                    // Find all participants in the bracket
                    const bracket = t.bracketData;
                    // For single/double elimination, winner is 1st, loser of final is 2nd, etc.
                    // For round robin, sort by wins
                    // For now, only handle single_elimination and round_robin
                    const userName = profile?.displayName || profile?.username;
                    if (userName) {
                      if (bracket.format === "single_elimination" && bracket.rounds?.length) {
                        const lastRound = bracket.rounds[bracket.rounds.length - 1];
                        const finalMatch = lastRound.matches[0];
                        if (finalMatch) {
                          if (finalMatch.winner === userName) {
                            placement = "1st place";
                          } else if (
                            (finalMatch.participantA === userName || finalMatch.participantB === userName)
                          ) {
                            placement = "2nd place";
                          }
                        }
                      } else if (
                        (bracket.format === "round_robin" || bracket.format === "double_round_robin" || bracket.format === "swiss") && bracket.rounds
                      ) {
                        // Count wins for each participant
                        const wins: Record<string, number> = {};
                        for (const round of bracket.rounds) {
                          for (const match of round.matches) {
                            if (match.winner) {
                              wins[match.winner] = (wins[match.winner] || 0) + 1;
                            }
                          }
                        }
                        const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1]);
                        const index = sorted.findIndex(([name]) => name === userName);
                        if (index !== -1) {
                          const place = index + 1;
                          placement =
                            place === 1
                              ? "1st place"
                              : place === 2
                              ? "2nd place"
                              : place === 3
                              ? "3rd place"
                              : `${place}th place`;
                        }
                      }
                    }
                  } catch {
                    // ignore errors
                  }
                }
                return (
                  <Link
                    key={t.id}
                    href={`/tournaments/view/${t.id}`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
                  >
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{t.game}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tournamentStatusColors[t.status]}`}>
                        {tournamentStatusLabel[t.status]}
                      </span>
                      {placement && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800 ml-2">
                          {placement}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
