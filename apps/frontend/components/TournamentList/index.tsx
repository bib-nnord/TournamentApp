"use client";

import Link from "next/link";
import { tournamentStatusLabel } from "@/types";
import { useFetch } from "@/hooks/useFetch";
import { useFilterToggle } from "@/hooks/useFilterToggle";
import { tournamentStatusColors } from "@/lib/colors";
import { formatDate } from "@/lib/helpers";
import StatusBadge from "@/components/StatusBadge";
import FilterTabs from "@/components/FilterTabs";
import type { Filter, TournamentSummary } from "./types";

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Registration", value: "registration" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Draft", value: "draft" },
];

const statusOrder: Record<string, number> = {
  registration: 0,
  active: 1,
  completed: 2,
  cancelled: 3,
  draft: 4,
};

export default function TournamentList() {
  const { data, loading, error } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments");
  const { activeFilters, toggleFilter } = useFilterToggle<Filter>(["all"], "all");

  const tournaments = data?.tournaments ?? [];
  const filtered = tournaments
    .filter((t) => activeFilters.includes("all") ? true : activeFilters.includes(t.status))
    .sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

  return (
    <div>
      <FilterTabs filters={filters} active={activeFilters} onToggle={toggleFilter} className="mb-6" />

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
                <StatusBadge
                  label={tournamentStatusLabel[t.status]}
                  colorClass={tournamentStatusColors[t.status]}
                  className="shrink-0"
                />
              </div>
              <div className="text-xs text-gray-500 flex flex-col gap-1">
                <span className="text-gray-700 font-medium">{t.game}</span>
                {t.startDate && <span>{formatDate(t.startDate)}</span>}
                <span>{t.participants} / {t.max} participants</span>
              </div>
              <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">
                <span>by {t.creator.displayName || t.creator.username}</span>
                {t.creator.displayName && t.creator.displayName.toLowerCase() !== t.creator.username.toLowerCase() && (
                  <span className="text-gray-400">@{t.creator.username}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
