import Link from "next/link";
import TournamentList from "@/components/TournamentList";
import TeamList from "@/components/TeamList";
import AuthButtons from "@/components/AuthButtons";
import { LABEL_ALL_TOURNAMENTS, LABEL_ALL_TEAMS } from "@/constants/labels";
export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            Host your Tournaments.
          </h1>
          <p className="text-lg text-gray-500 max-w-xl">
            Create and join tournaments for any game or sport. Track results, manage teams or plan matches.
          </p>
          <AuthButtons />
        </div>
      </div>

      {/* Tournaments */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">My Tournaments</h2>
          <Link
            href="/tournaments"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {LABEL_ALL_TOURNAMENTS}
          </Link>
        </div>
        <TournamentList />
      </div>

      {/* Teams */}
      <div className="max-w-4xl mx-auto px-4 pb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">My Teams</h2>
          <Link
            href="/teams"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {LABEL_ALL_TEAMS}
          </Link>
        </div>
        <TeamList />
      </div>

    </div>
  );
}
