"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  LABEL_CHANGE_PASSWORD,
  LABEL_CHANGE_EMAIL,
  LABEL_LOG_OUT,
  LABEL_DELETE_ACCOUNT,
} from "@/constants/labels";
import { useNotify } from "@/hooks/useNotify";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiFetch } from "@/lib/api";
import { logoutAsync } from "@/store/authSlice";
import type { AppDispatch } from "@/store/store";
import { useRouter } from "next/navigation";

type ThemePref = "light" | "dark" | "system";
type LanguagePref = "en" | "de";

interface LocalUiSettings {
  theme: ThemePref;
  language: LanguagePref;
  tournamentUpdates: boolean;
  friendRequests: boolean;
  teamInvites: boolean;
  showProfilePublicly: boolean;
  showFriendsList: boolean;
  showTournamentHistory: boolean;
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

interface MeResponse {
  allowMessagesFrom: string;
  displayName: string | null;
  bio: string | null;
  country: string | null;
  dateOfBirth: string | null;
  gamesSports: string[];
  visibility: {
    bio: boolean;
    country: boolean;
    age: boolean;
    gamesSports: boolean;
  };
}

const LOCAL_SETTINGS_KEY = "tournamentapp.user.settings.v1";

const defaultLocalSettings: LocalUiSettings = {
  theme: "system",
  language: "en",
  tournamentUpdates: true,
  friendRequests: true,
  teamInvites: true,
  showProfilePublicly: true,
  showFriendsList: true,
  showTournamentHistory: true,
};

const defaultProfileForm: ProfileFormState = {
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

export default function SettingsPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useRequireAuth();
  const notify = useNotify();
  const [allowMessagesFrom, setAllowMessagesFrom] = useState("everyone");
  const [allowMessagesFromDraft, setAllowMessagesFromDraft] = useState("everyone");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(defaultProfileForm);
  const [savedProfileForm, setSavedProfileForm] = useState<ProfileFormState>(defaultProfileForm);
  const [localSettings, setLocalSettings] = useState<LocalUiSettings>(defaultLocalSettings);
  const [savedLocalSettings, setSavedLocalSettings] = useState<LocalUiSettings>(defaultLocalSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [localSaveState, setLocalSaveState] = useState<"idle" | "saved">("idle");
  const [pwForm, setPwForm] = useState({ open: false, current: "", next: "", loading: false, error: null as string | null, done: false });
  const [emailForm, setEmailForm] = useState({ open: false, email: "", password: "", loading: false, error: null as string | null, done: false });

  useEffect(() => {
    apiFetch("/users/me").then((res) => {
      if (res.ok) {
        res.json().then((d: MeResponse) => {
          setAllowMessagesFrom(d.allowMessagesFrom);
          setAllowMessagesFromDraft(d.allowMessagesFrom);
          const nextProfileForm: ProfileFormState = {
            displayName: d.displayName ?? "",
            bio: d.bio ?? "",
            country: d.country ?? "",
            dateOfBirth: d.dateOfBirth ?? "",
            gamesSports: (d.gamesSports ?? []).join(", "),
            visibility: {
              bio: d.visibility?.bio ?? true,
              country: d.visibility?.country ?? true,
              age: d.visibility?.age ?? true,
              gamesSports: d.visibility?.gamesSports ?? true,
            },
          };
          setProfileForm(nextProfileForm);
          setSavedProfileForm(nextProfileForm);
        });
      }
    });

    try {
      const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LocalUiSettings>;
      const merged = { ...defaultLocalSettings, ...parsed };
      setLocalSettings(merged);
      setSavedLocalSettings(merged);
    } catch {
      /* ignore invalid local settings */
    }
  }, []);

  useEffect(() => {
    if (localSaveState !== "saved") return;
    const timer = setTimeout(() => setLocalSaveState("idle"), 1200);
    return () => clearTimeout(timer);
  }, [localSaveState]);

  if (!user) return null;

  function handleLogout() {
    dispatch(logoutAsync());
    sessionStorage.removeItem("ai-chat-history");
    router.push("/");
  }

  function updateLocalSettings(patch: Partial<LocalUiSettings>) {
    setLocalSettings((prev) => ({ ...prev, ...patch }));
  }

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

  const hasUnsavedLocalSettings = JSON.stringify(localSettings) !== JSON.stringify(savedLocalSettings);
  const hasUnsavedPrivacy = allowMessagesFromDraft !== allowMessagesFrom;
  const hasUnsavedProfile = JSON.stringify(profileForm) !== JSON.stringify(savedProfileForm);
  const hasUnsavedSettings =
    hasUnsavedLocalSettings || hasUnsavedPrivacy || hasUnsavedProfile;

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      if (hasUnsavedPrivacy) {
        const res = await apiFetch("/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            allowMessagesFrom: allowMessagesFromDraft,
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
          const message = body.error ?? "Failed to save settings";
          setSettingsError(message);
          notify.error(message);
          return;
        }
      } else if (hasUnsavedProfile) {
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
          const message = body.error ?? "Failed to save settings";
          setSettingsError(message);
          notify.error(message);
          return;
        }
      }

      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(localSettings));
      setSavedLocalSettings(localSettings);
      setAllowMessagesFrom(allowMessagesFromDraft);
      setSavedProfileForm(profileForm);
      setLocalSaveState("saved");
      notify.success("Settings saved.");
    } catch {
      const message = "Network error";
      setSettingsError(message);
      notify.error(message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwForm(f => ({ ...f, loading: true, error: null }));
    try {
      const res = await apiFetch("/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message = body.error ?? "Failed to change password";
        setPwForm(f => ({ ...f, loading: false, error: message }));
        notify.error(message);
        return;
      }
      setPwForm({ open: false, current: "", next: "", loading: false, error: null, done: true });
      notify.success("Password changed.");
    } catch {
      const message = "Network error";
      setPwForm(f => ({ ...f, loading: false, error: message }));
      notify.error(message);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailForm(f => ({ ...f, loading: true, error: null }));
    try {
      const res = await apiFetch("/users/me/email", {
        method: "PATCH",
        body: JSON.stringify({ email: emailForm.email, password: emailForm.password }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message = body.error ?? "Failed to change email";
        setEmailForm(f => ({ ...f, loading: false, error: message }));
        notify.error(message);
        return;
      }
      setEmailForm({ open: false, email: "", password: "", loading: false, error: null, done: true });
      notify.success("Email updated.");
    } catch {
      const message = "Network error";
      setEmailForm(f => ({ ...f, loading: false, error: message }));
      notify.error(message);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
      {localSaveState === "saved" && (
        <div className="fixed top-4 right-4 z-50 pointer-events-none">
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-sm">
            Settings saved.
          </div>
        </div>
      )}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <button
            onClick={handleSaveSettings}
            disabled={!hasUnsavedSettings || settingsSaving}
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {settingsSaving ? "Saving…" : "Save settings"}
          </button>
        </div>
        {settingsError && <p className="text-xs text-red-500 mb-4">{settingsError}</p>}

        {/* Appearance */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Appearance</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Theme</p>
                <p className="text-xs text-gray-400">Choose your preferred colour scheme</p>
              </div>
              <select
                value={localSettings.theme}
                onChange={(e) => updateLocalSettings({ theme: e.target.value as ThemePref })}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Language</p>
                <p className="text-xs text-gray-400">Select display language</p>
              </div>
              <select
                value={localSettings.language}
                onChange={(e) => updateLocalSettings({ language: e.target.value as LanguagePref })}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English</option>
                <option value="de">German</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Notifications</h2>
          <div className="flex flex-col gap-4">
            {[
              {
                key: "tournamentUpdates" as const,
                label: "Tournament updates",
                description: "Reminders and results for tournaments you're in",
              },
              {
                key: "friendRequests" as const,
                label: "Friend requests",
                description: "When someone sends you a friend request",
              },
              {
                key: "teamInvites" as const,
                label: "Team invites",
                description: "When you're invited to join a team",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings[item.key]}
                  onChange={(e) => updateLocalSettings({ [item.key]: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Profile info</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Display name
              </label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => updateProfileForm({ displayName: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="How your name appears on your profile"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Bio</label>
                <textarea
                  rows={4}
                  value={profileForm.bio}
                  onChange={(e) => updateProfileForm({ bio: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Tell people what you play, organize, or care about"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Visibility</label>
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

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Country</label>
                <input
                  type="text"
                  value={profileForm.country}
                  onChange={(e) => updateProfileForm({ country: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Your country"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Visibility</label>
                <select
                  value={profileForm.visibility.country ? "public" : "private"}
                  onChange={(e) => updateProfileVisibility("country", e.target.value === "public")}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Date of birth</label>
                <input
                  type="date"
                  value={profileForm.dateOfBirth}
                  onChange={(e) => updateProfileForm({ dateOfBirth: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-xs text-gray-400 mt-1">Only your age is shown publicly, not the full birth date.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Visibility</label>
                <select
                  value={profileForm.visibility.age ? "public" : "private"}
                  onChange={(e) => updateProfileVisibility("age", e.target.value === "public")}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Games / sports</label>
                <input
                  type="text"
                  value={profileForm.gamesSports}
                  onChange={(e) => updateProfileForm({ gamesSports: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Football, Chess, Valorant, Tennis"
                />
                <p className="text-xs text-gray-400 mt-1">Separate each item with a comma.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Visibility</label>
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
          </div>
        </section>

        {/* Privacy */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Privacy</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Who can message you</p>
                <p className="text-xs text-gray-400">Control who is allowed to send you direct messages</p>
              </div>
              <select
                value={allowMessagesFromDraft}
                onChange={(e) => setAllowMessagesFromDraft(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="everyone">Everyone</option>
                <option value="friends_only">Friends only</option>
              </select>
            </div>
            {[
              {
                key: "showProfilePublicly" as const,
                label: "Show profile publicly",
                description: "Anyone can view your profile",
              },
              {
                key: "showFriendsList" as const,
                label: "Show friends list",
                description: "Others can see who you're friends with",
              },
              {
                key: "showTournamentHistory" as const,
                label: "Show tournament history",
                description: "Others can see your past tournaments",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings[item.key]}
                  onChange={(e) => updateLocalSettings({ [item.key]: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Account */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Account</h2>
          <p className="text-sm text-gray-500 mb-4">Signed in as <span className="font-medium text-gray-700">{user.email}</span></p>
          <div className="flex flex-col gap-3">
            <div>
              <button
                onClick={() => setPwForm(f => ({ ...f, open: !f.open, error: null, done: false }))}
                className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 text-gray-700"
              >
                {LABEL_CHANGE_PASSWORD}
              </button>
              {pwForm.open && (
                <form onSubmit={handleChangePassword} className="mt-2 flex flex-col gap-2 px-4 py-3 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 rounded-lg border border-gray-200">
                  <input
                    type="password"
                    placeholder="Current password"
                    required
                    value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    required
                    value={pwForm.next}
                    onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {pwForm.error && <p className="text-xs text-red-500">{pwForm.error}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={pwForm.loading} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {pwForm.loading ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => setPwForm(f => ({ ...f, open: false, current: "", next: "", error: null }))} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 text-gray-600">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {pwForm.done && !pwForm.open && <p className="text-xs text-green-600 mt-1 px-1">Password changed successfully.</p>}
            </div>
            <div>
              <button
                onClick={() => setEmailForm(f => ({ ...f, open: !f.open, error: null, done: false }))}
                className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 text-gray-700"
              >
                {LABEL_CHANGE_EMAIL}
              </button>
              {emailForm.open && (
                <form onSubmit={handleChangeEmail} className="mt-2 flex flex-col gap-2 px-4 py-3 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 rounded-lg border border-gray-200">
                  <input
                    type="email"
                    placeholder="New email address"
                    required
                    value={emailForm.email}
                    onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    type="password"
                    placeholder="Confirm with your current password"
                    required
                    value={emailForm.password}
                    onChange={e => setEmailForm(f => ({ ...f, password: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {emailForm.error && <p className="text-xs text-red-500">{emailForm.error}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={emailForm.loading} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {emailForm.loading ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => setEmailForm(f => ({ ...f, open: false, email: "", password: "", error: null }))} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 text-gray-600">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {emailForm.done && !emailForm.open && <p className="text-xs text-green-600 mt-1 px-1">Email changed successfully.</p>}
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 text-gray-700"
            >
              {LABEL_LOG_OUT}
            </button>
            <button className="w-full text-left text-sm px-4 py-2.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-500">
              {LABEL_DELETE_ACCOUNT}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
