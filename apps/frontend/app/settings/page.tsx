"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { logoutAsync } from "@/store/authSlice";
import type { AppDispatch } from "@/store/store";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiFetch } from "@/lib/api";
import {
  LABEL_CHANGE_PASSWORD,
  LABEL_CHANGE_EMAIL,
  LABEL_LOG_OUT,
  LABEL_DELETE_ACCOUNT,
} from "@/constants/labels";

export default function SettingsPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useRequireAuth();
  const [allowMessagesFrom, setAllowMessagesFrom] = useState("everyone");
  const [pwForm, setPwForm] = useState({ open: false, current: "", next: "", loading: false, error: null as string | null, done: false });
  const [emailForm, setEmailForm] = useState({ open: false, email: "", password: "", loading: false, error: null as string | null, done: false });

  useEffect(() => {
    apiFetch("/users/me").then((res) => {
      if (res.ok) res.json().then((d: { allowMessagesFrom: string }) => setAllowMessagesFrom(d.allowMessagesFrom));
    });
  }, []);

  if (!user) return null;

  function handleLogout() {
    dispatch(logoutAsync());
    router.push("/");
  }

  async function handleMessagePrivacyChange(value: string) {
    setAllowMessagesFrom(value);
    await apiFetch("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowMessagesFrom: value }),
    });
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
        setPwForm(f => ({ ...f, loading: false, error: body.error ?? "Failed to change password" }));
        return;
      }
      setPwForm({ open: false, current: "", next: "", loading: false, error: null, done: true });
    } catch {
      setPwForm(f => ({ ...f, loading: false, error: "Network error" }));
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
        setEmailForm(f => ({ ...f, loading: false, error: body.error ?? "Failed to change email" }));
        return;
      }
      setEmailForm({ open: false, email: "", password: "", loading: false, error: null, done: true });
    } catch {
      setEmailForm(f => ({ ...f, loading: false, error: "Network error" }));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Appearance */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Appearance</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Theme</p>
                <p className="text-xs text-gray-400">Choose your preferred colour scheme</p>
              </div>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Light</option>
                <option>Dark</option>
                <option>System</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Language</p>
                <p className="text-xs text-gray-400">Select display language</p>
              </div>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>English</option>
                <option>Swedish</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Notifications</h2>
          <div className="flex flex-col gap-4">
            {[
              { label: "Tournament updates", description: "Reminders and results for tournaments you're in" },
              { label: "Friend requests", description: "When someone sends you a friend request" },
              { label: "Team invites", description: "When you're invited to join a team" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-600" />
              </div>
            ))}
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
                value={allowMessagesFrom}
                onChange={(e) => handleMessagePrivacyChange(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="everyone">Everyone</option>
                <option value="friends_only">Friends only</option>
              </select>
            </div>
            {[
              { label: "Show profile publicly", description: "Anyone can view your profile" },
              { label: "Show friends list", description: "Others can see who you're friends with" },
              { label: "Show tournament history", description: "Others can see your past tournaments" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-600" />
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
                className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                {LABEL_CHANGE_PASSWORD}
              </button>
              {pwForm.open && (
                <form onSubmit={handleChangePassword} className="mt-2 flex flex-col gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
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
                    <button type="button" onClick={() => setPwForm(f => ({ ...f, open: false, current: "", next: "", error: null }))} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
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
                className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                {LABEL_CHANGE_EMAIL}
              </button>
              {emailForm.open && (
                <form onSubmit={handleChangeEmail} className="mt-2 flex flex-col gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
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
                    <button type="button" onClick={() => setEmailForm(f => ({ ...f, open: false, email: "", password: "", error: null }))} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {emailForm.done && !emailForm.open && <p className="text-xs text-green-600 mt-1 px-1">Email changed successfully.</p>}
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
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
