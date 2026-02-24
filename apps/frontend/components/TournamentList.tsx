"use client";

import Link from "next/link";
import { useState } from "react";
import type { Tournament, TournamentStatus } from "@/types";

type Filter = "all" | TournamentStatus;

const tournaments: Tournament[] = [
  { id: "1", name: "Spring Open 2025", status: "upcoming" as TournamentStatus, date: "Mar 15, 2025", participants: 12, max: 16, game: "Chess" },
  { id: "2", name: "Weekly Blitz #42", status: "active" as TournamentStatus, date: "Feb 23, 2025", participants: 8, max: 8, game: "Chess" },
  { id: "3", name: "City Chess Cup", status: "past" as TournamentStatus, date: "Jan 10, 2025", participants: 32, max: 32, game: "Chess" },
  { id: "4", name: "Winter Championship", status: "past" as TournamentStatus, date: "Dec 5, 2024", participants: 16, max: 16, game: "Chess" },
  { id: "5", name: "Easter Invitational", status: "upcoming" as TournamentStatus, date: "Apr 20, 2025", participants: 4, max: 16, game: "Chess" },
  { id: "6", name: "Club Night #7", status: "active" as TournamentStatus, date: "Feb 23, 2025", participants: 6, max: 8, game: "Chess" },
];

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Active", value: "active" },
  { label: "Past", value: "past" },
];

const statusColors: Record<Status, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  past: "bg-gray-100 text-gray-500",
};

export default function TournamentList() {
  const [activeFilters, setActiveFilters] = useState<Filter[]>(["all"]);

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
      <div className="flex gap-2 mb-6">
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

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No tournaments found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/view/${t.id}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{t.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status]}`}>
                  {t.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 flex flex-col gap-1">
                <span>{t.date}</span>
                <span>{t.participants} / {t.max} participants</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
