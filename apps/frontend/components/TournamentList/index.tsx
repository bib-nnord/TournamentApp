"use client";

import FilterTabs from "@/components/FilterTabs";
import StatusBadge from "@/components/StatusBadge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useFetch } from "@/hooks/useFetch";
import { useFilterToggle } from "@/hooks/useFilterToggle";
import { tournamentStatusColors } from "@/lib/colors";
import { formatDate } from "@/lib/helpers";
import { tournamentStatusLabel, tournamentFormatInfo } from "@/types";
import { GalleryHorizontal, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Filter, TournamentSummary } from "./types";

function getRoundInfo(
  format: string,
  participants: number,
  completed: number,
  total: number,
): { current: number; total: number } | null {
  if (!total || total === 0 || participants < 2) return null;

  if (format === "single_elimination") {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(participants)));
    const totalRounds = Math.log2(bracketSize);
    let round = 1;
    let cumulative = 0;
    let matchesInRound = bracketSize / 2;
    while (cumulative + matchesInRound <= completed && round < totalRounds) {
      cumulative += matchesInRound;
      round++;
      matchesInRound = Math.floor(matchesInRound / 2);
    }
    return { current: round, total: totalRounds };
  }

  if (format === "round_robin") {
    const matchesPerRound = Math.floor(participants / 2);
    if (matchesPerRound === 0) return null;
    const totalRounds = participants % 2 === 0 ? participants - 1 : participants;
    const current = Math.min(Math.floor(completed / matchesPerRound) + 1, totalRounds);
    return { current, total: totalRounds };
  }

  return null;
}

const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Registration", value: "registration" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const statusOrder: Record<string, number> = {
  registration: 0,
  active: 1,
  completed: 2,
  cancelled: 3,
};

interface TournamentListProps {
  defaultFilter?: Filter[];
  hideFilters?: boolean;
  sortBy?: "status" | "participants";
  layout?: "grid" | "carousel";
}

export default function TournamentList({
  defaultFilter = ["all"],
  hideFilters = false,
  sortBy = "status",
  layout = "grid",
}: TournamentListProps) {
  const { data, loading, error } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments");
  const { activeFilters, toggleFilter } = useFilterToggle<Filter>(defaultFilter, "all");
  const [layoutMode, setLayoutMode] = useState<"grid" | "carousel">(layout);

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
        <div className="mb-4 flex items-center gap-2">
          <FilterTabs filters={filters} active={activeFilters} onToggle={toggleFilter} className="flex-1" />
          <div className="flex items-center gap-1 rounded-md border bg-background p-1">
            <button
              onClick={() => setLayoutMode("grid")}
              className={`rounded p-1.5 transition-colors ${
                layoutMode === "grid"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayoutMode("carousel")}
              className={`rounded p-1.5 transition-colors ${
                layoutMode === "carousel"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Carousel view"
            >
              <GalleryHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tournaments found.</p>
      ) : layoutMode === "carousel" ? (
        <Carousel
          opts={{ align: "start" }}
          className="w-full px-10"
        >
          <CarouselContent>
            {filtered.map((t) => {
              const formatLabel =
                tournamentFormatInfo[t.format as keyof typeof tournamentFormatInfo]?.label ??
                t.format;
              const progress = t.matchProgress;
              const progressPct = progress && progress.total > 0
                ? Math.round((progress.completed / progress.total) * 100)
                : null;
              const roundInfo = t.status === "active" && progress
                ? getRoundInfo(t.format, t.participants, progress.completed, progress.total)
                : null;
              const joinedClass = t.isJoined
                ? "border-primary/40 bg-accent/35 hover:border-primary/60"
                : "border-border";

              return (
                <CarouselItem
                  key={t.id}
                  className="basis-full sm:basis-1/2 lg:basis-1/3"
                >
                  <Link
                    href={`/tournaments/view/${t.id}`}
                    className={
                      "flex h-full min-h-[220px] flex-col gap-2.5 rounded-lg border " +
                      "bg-card p-4 shadow-sm transition-shadow hover:shadow-md " +
                      joinedClass
                    }
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

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t.game}</span>
                      <span>{formatLabel}</span>
                      <span>{t.participants} / {t.max} participants</span>
                      <span>{t.isPrivate ? "Private" : "Public"}</span>
                      {roundInfo ? (
                        <span className={!t.nextMatchAt ? "col-span-2" : ""}>
                          Round {roundInfo.current} of {roundInfo.total}
                        </span>
                      ) : null}
                      {t.nextMatchAt ? (
                        <span>Next: {formatDate(t.nextMatchAt)}</span>
                      ) : null}
                      {t.startDate
                        ? <span>Starts {formatDate(t.startDate)}</span>
                        : <span>No date yet</span>}
                      <span>Created {formatDate(t.createdAt)}</span>
                    </div>

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
                    <div className="mt-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span>by {t.creator.displayName || t.creator.username}</span>
                      {t.creator.displayName &&
                        t.creator.displayName.toLowerCase() !== t.creator.username.toLowerCase() && (
                          <span className="text-muted-foreground">@{t.creator.username}</span>
                      )}
                    </div>
                  </Link>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="left-0" />
          <CarouselNext className="right-0" />
        </Carousel>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                className={
                  "flex flex-col gap-2 rounded-lg border bg-card p-3.5 " +
                  "shadow-sm transition-shadow hover:shadow-md " +
                  joinedClass
                }
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
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
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
