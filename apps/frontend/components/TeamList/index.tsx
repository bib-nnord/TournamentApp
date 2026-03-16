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
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (teams.length === 0) {
    return <p className="text-sm text-gray-500">No teams yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {teams.map((t) => (
        <Link
          key={t.id}
          href={`/teams/${t.id}`}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
        >
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{t.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {t.open ? "Open" : "Closed"}
            </span>
          </div>
          <p className="text-xs text-gray-500">{t.members} members</p>
        </Link>
      ))}
    </div>
  );
}
