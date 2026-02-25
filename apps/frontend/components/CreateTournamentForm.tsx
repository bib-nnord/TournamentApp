"use client";

import { useState } from "react";
import Link from "next/link";

export default function CreateTournamentForm({ onSuccess, showAdvancedLink }: { onSuccess?: () => void; showAdvancedLink?: boolean }) {
  const [form, setForm] = useState({
    name: "",
    game: "",
    date: "",
    maxParticipants: "16",
    description: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST to backend
    console.log("Creating tournament:", form);
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Tournament name
        </label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          placeholder="e.g. Spring Open 2025"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Game
        </label>
        <input
          name="game"
          value={form.game}
          onChange={handleChange}
          required
          placeholder="e.g. Chess, Rocket League"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Date
        </label>
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Max participants
        </label>
        <select
          name="maxParticipants"
          value={form.maxParticipants}
          onChange={handleChange}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {[4, 8, 16, 32, 64].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Description <span className="normal-case text-gray-300">(optional)</span>
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          placeholder="Describe the format, rules, prizes…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <button
        type="submit"
        className="mt-2 w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
      >
        Create tournament
      </button>

      {showAdvancedLink && (
        <Link
          href="/tournaments/create"
          className="block text-center text-xs text-gray-400 hover:text-indigo-600 mt-3"
        >
          Advanced setup
        </Link>
      )}
    </form>
  );
}
