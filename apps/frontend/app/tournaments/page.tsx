import Link from "next/link";
import TournamentList from "@/components/TournamentList";
import { LABEL_CREATE } from "@/constants/labels";

export default function TournamentsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <Link
            href="/tournaments/create"
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {LABEL_CREATE}
          </Link>
        </div>
        <TournamentList />
      </div>
    </div>
  );
}
