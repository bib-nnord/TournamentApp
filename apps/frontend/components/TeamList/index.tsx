"use client";

import Link from "next/link";
import { useFetch } from "@/hooks/useFetch";

interface TeamCard {
  id: number;
  name: string;
  open: boolean;
  members: number;
}

export default function TeamList() {
  const { data, loading, error } = useFetch<{ teams: TeamCard[] }>("/teams?limit=4");
  const teams = data?.teams ?? [];

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">No teams yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {teams.map((t) => (
        <Link
          key={t.id}
          href={`/teams/${t.id}`}
          className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold text-card-foreground">{t.name}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.open ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {t.open ? "Open" : "Closed"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t.members} members</p>
        </Link>
      ))}
    </div>
  );
}
