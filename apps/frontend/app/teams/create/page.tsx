"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function CreateTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [disciplineInput, setDisciplineInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState("");
  const [disciplineError, setDisciplineError] = useState("");
  const [loading, setLoading] = useState(false);



  const handleDisciplineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && disciplineInput.trim()) {
      e.preventDefault();
      addDiscipline(disciplineInput.trim());
    } else if (e.key === "Backspace" && !disciplineInput && disciplines.length > 0) {
      setDisciplines((prev) => prev.slice(0, -1));
    }
  };

  const addDiscipline = (value: string) => {
    if (!value) return;
    if (disciplines.includes(value)) {
      setDisciplineError(`Discipline "${value}" already added.`);
      return;
    }
    setDisciplines((prev) => [...prev, value]);
    setDisciplineInput("");
    setDisciplineError("");
  };

  const removeDiscipline = (value: string) => {
    setDisciplines((prev) => prev.filter((d) => d !== value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/teams", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          disciplines,
          open,
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const { team } = await res.json();
        router.push(`/teams/${team.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create team");
      }
    } catch {
      setError("Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Create a Team</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 shadow-sm flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Team Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={50}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Main Disciplines</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {disciplines.map((d) => (
              <span
                key={d}
                className="inline-flex items-center bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium gap-1"
              >
                {d}
                <button
                  type="button"
                  className="ml-1 text-indigo-400 hover:text-red-500"
                  onClick={() => removeDiscipline(d)}
                  aria-label={`Remove ${d}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="w-full border rounded px-3 py-2"
            value={disciplineInput}
            onChange={(e) => {
              setDisciplineInput(e.target.value);
              if (disciplineError) setDisciplineError("");
            }}
            onKeyDown={handleDisciplineKeyDown}
            placeholder="Type a discipline and press Enter or Comma"
            maxLength={30}
          />
          {disciplineError && <p className="text-xs text-red-500 mt-1">{disciplineError}</p>}
          <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add. Click × to remove.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={open ? "open" : "closed"}
            onChange={(e) => setOpen(e.target.value === "open")}
          >
            <option value="open">Open (anyone can join)</option>
            <option value="closed">Closed (invite only)</option>
          </select>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-indigo-600 text-white rounded px-4 py-2 mt-2 hover:bg-indigo-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creating…" : "Create Team"}
        </button>
      </form>
    </div>
  );
}
