import Link from "next/link";
import TournamentList from "@/components/TournamentList";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            Compete. Organise. Win.
          </h1>
          <p className="text-lg text-gray-500 max-w-xl">
            Create and join tournaments for any game or sport. Track results, manage teams, and climb the leaderboard.
          </p>
          <div className="flex gap-3 mt-2">
            <Link
              href="/register"
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
            >
              Get started
            </Link>
            <Link
              href="/tournaments/create"
              className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Create a tournament
            </Link>
          </div>
        </div>
      </div>

      {/* Tournaments */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Public Tournaments</h2>
          <Link
            href="/tournaments/create"
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Create
          </Link>
        </div>
        <TournamentList />
      </div>

    </div>
  );
}
