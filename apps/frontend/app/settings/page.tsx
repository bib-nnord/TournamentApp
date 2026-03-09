"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { logoutAsync } from "@/store/authSlice";
import type { AppDispatch } from "@/store/store";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiFetch } from "@/lib/apiFetch";
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
            <button className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              {LABEL_CHANGE_PASSWORD}
            </button>
            <button className="w-full text-left text-sm px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              {LABEL_CHANGE_EMAIL}
            </button>
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
