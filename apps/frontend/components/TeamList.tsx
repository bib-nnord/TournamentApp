import Link from "next/link";
import type { TeamSummary } from "@/types";

// Placeholder — replace with real data once backend is ready
const teams: TeamSummary[] = [
  { id: "t1", name: "The Knights", members: 4, open: true },
  { id: "t2", name: "Storm Squad", members: 6, open: false },
  { id: "t3", name: "Iron Bishops", members: 3, open: true },
  { id: "t4", name: "Rapid Rookies", members: 8, open: false },
];

export default function TeamList() {
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
