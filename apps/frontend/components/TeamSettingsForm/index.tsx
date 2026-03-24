"use client";

import { useState } from "react";
import { LABEL_SAVE_CHANGES, LABEL_DISBAND } from "@/constants/labels";
import { apiFetch } from "@/lib/api";
import type { TeamSettingsFormProps } from "./types";

export default function TeamSettingsForm({ teamId, team, isLead, onSuccess, onDisband }: TeamSettingsFormProps) {
  const [form, setForm] = useState({
    name: team.name,
    description: team.description,
    open: team.open,
    disciplines: team.disciplines ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/teams/${teamId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save");
        return;
      }
      onSuccess?.(form);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisband() {
    if (!confirm("Are you sure you want to disband this team? This cannot be undone.")) return;
    setDisbanding(true);
    try {
      const res = await apiFetch(`/teams/${teamId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to disband");
        return;
      }
      onDisband?.();
    } catch {
      setError("Network error");
    } finally {
      setDisbanding(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* General */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-5">General</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Team name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="open"
              name="open"
              checked={form.open}
              onChange={handleChange}
              className="w-4 h-4 accent-indigo-600"
            />
            <label htmlFor="open" className="text-sm text-gray-700">
              Open team <span className="text-gray-400">(anyone can join without approval)</span>
            </label>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-2 w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : LABEL_SAVE_CHANGES}
          </button>
        </form>
      </div>

      {/* Danger zone — lead only */}
      {isLead && (
        <div className="border border-red-100 rounded-xl p-6">
          <h3 className="text-base font-semibold text-red-600 mb-5">Danger zone</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Disband team</p>
              <p className="text-xs text-gray-400 mt-0.5">Permanently delete this team and remove all members.</p>
            </div>
            <button
              type="button"
              onClick={handleDisband}
              disabled={disbanding}
              className="text-sm px-4 py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-60"
            >
              {disbanding ? "Disbanding…" : LABEL_DISBAND}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
