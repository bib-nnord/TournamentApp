import Link from "next/link";
import TournamentList from "@/components/TournamentList";
import { LABEL_CREATE } from "@/constants/labels";
import type { Filter } from "@/components/TournamentList/types";

const VALID_FILTERS: Filter[] = ["all", "registration", "active", "completed", "cancelled", "draft"];

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const defaultFilter: Filter[] = VALID_FILTERS.includes(filter as Filter)
    ? [filter as Filter]
    : ["all"];
  const isActive = defaultFilter[0] === "active";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
            {isActive && (
              <p className="text-sm text-gray-500 mt-0.5">Ongoing tournaments and their progress</p>
            )}
          </div>
          <Link
            href="/tournaments/create"
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {LABEL_CREATE}
          </Link>
        </div>
        <TournamentList defaultFilter={defaultFilter} />
      </div>
    </div>
  );
}
