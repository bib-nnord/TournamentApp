"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { tournamentStatusLabel } from "@/types";
import type { TournamentStatus } from "@/types";
import { apiFetch } from "@/lib/api";
import type { Filter, TournamentSummary } from "./types";

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Registration", value: "registration" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const statusColors: Record<TournamentStatus, string> = {
  draft: "bg-gray-100 text-gray-500",
  registration: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

export default function TournamentList() {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Filter[]>(["all"]);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/tournaments");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Failed to load tournaments");
          return;
        }
        const data = await res.json();
        setTournaments(data.tournaments ?? []);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleFilter(value: Filter) {
    if (value === "all") {
      setActiveFilters(["all"]);
      return;
    }
    setActiveFilters((prev) => {
      const without = prev.filter((f) => f !== "all");
      if (without.includes(value)) {
        const next = without.filter((f) => f !== value);
        return next.length === 0 ? ["all"] : next;
      }
      return [...without, value];
    });
  }

  const filtered = tournaments.filter((t) =>
    activeFilters.includes("all") ? true : activeFilters.includes(t.status)
  );

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => {
          const isActive = activeFilters.includes(f.value);
          return (
            <button
              key={f.value}
              onClick={() => toggleFilter(f.value)}
              className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-colors ${
                isActive
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No tournaments found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/view/${t.id}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">{t.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[t.status]}`}>
                  {tournamentStatusLabel[t.status]}
                </span>
              </div>
              <div className="text-xs text-gray-500 flex flex-col gap-1">
                <span className="text-gray-700 font-medium">{t.game}</span>
                {t.startDate && (
                  <span>{new Date(t.startDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
                )}
                <span>{t.participants} / {t.max} participants</span>
              </div>
              <div className="text-[11px] text-gray-400">by {t.creator.username}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
