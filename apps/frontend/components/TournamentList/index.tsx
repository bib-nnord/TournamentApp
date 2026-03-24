"use client";

import Link from "next/link";
import { tournamentStatusLabel, tournamentFormatInfo } from "@/types";
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

interface TournamentListProps {
  defaultFilter?: Filter[];
  hideFilters?: boolean;
  sortBy?: "status" | "participants";
}

export default function TournamentList({
  defaultFilter = ["all"],
  hideFilters = false,
  sortBy = "status",
}: TournamentListProps) {
  const { data, loading, error } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments");
  const { activeFilters, toggleFilter } = useFilterToggle<Filter>(defaultFilter, "all");

  const tournaments = data?.tournaments ?? [];
  const filtered = tournaments
    .filter((t) => activeFilters.includes("all") ? true : activeFilters.includes(t.status))
    .sort((a, b) =>
      sortBy === "participants"
        ? b.participants - a.participants
        : (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    );

  return (
    <div>
      {!hideFilters && (
        <FilterTabs filters={filters} active={activeFilters} onToggle={toggleFilter} className="mb-6" />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tournaments found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((t) => {
            const formatLabel = tournamentFormatInfo[t.format as keyof typeof tournamentFormatInfo]?.label ?? t.format;
            const progress = t.matchProgress;
            const progressPct = progress && progress.total > 0
              ? Math.round((progress.completed / progress.total) * 100)
              : null;
            const joinedClass = t.isJoined
              ? "border-primary/40 bg-accent/35 hover:border-primary/60"
              : "border-border";

            return (
              <Link
                key={t.id}
                href={`/tournaments/view/${t.id}`}
                className={`flex flex-col gap-2.5 rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${joinedClass}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-card-foreground">{t.name}</h2>
                  <div className="flex items-center gap-1.5">
                    {t.isJoined && (
                      <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                        You are in
                      </span>
                    )}
                    <StatusBadge
                      label={tournamentStatusLabel[t.status]}
                      colorClass={tournamentStatusColors[t.status]}
                      className="shrink-0"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{t.game}</span>
                  <span className="text-muted-foreground">{formatLabel}</span>
                  {t.startDate && <span>{formatDate(t.startDate)}</span>}
                  <span>{t.participants} / {t.max} participants</span>
                </div>

                {/* Match progress bar — only for active tournaments with match data */}
                {t.status === "active" && progress && progress.total > 0 && (
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>{progress.completed} of {progress.total} matches played</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span>by {t.creator.displayName || t.creator.username}</span>
                  {t.creator.displayName && t.creator.displayName.toLowerCase() !== t.creator.username.toLowerCase() && (
                    <span className="text-muted-foreground">@{t.creator.username}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
