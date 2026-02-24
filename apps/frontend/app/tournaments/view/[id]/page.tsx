import Link from "next/link";
import type { TournamentParticipant } from "@/types";

// Placeholder — replace with real fetch by id once backend is ready
const tournament = {
  id: "1",
  name: "Spring Open 2025",
  status: "upcoming" as const,
  date: "March 15, 2025",
  description: "An open tournament for all skill levels. Single elimination format. Bring your best game!",
  game: "Chess",
  organizer: "johndoe",
  participants: [
    { id: "u1", username: "alice" },
    { id: "u2", username: "bob" },
    { id: "u3", username: "charlie" },
    { id: "u4", username: "diana" },
  ] as TournamentParticipant[],
  maxParticipants: 16,
};

const statusColors = {
  upcoming: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  past: "bg-gray-100 text-gray-500",
};

export default function TournamentPage() {
  const spotsLeft = tournament.maxParticipants - tournament.participants.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Back */}
        <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← Back to tournaments
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[tournament.status]}`}>
              {tournament.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-6">{tournament.description}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Date</p>
              <p className="text-gray-800 font-medium">{tournament.date}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Game</p>
              <p className="text-gray-800 font-medium">{tournament.game}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Organizer</p>
              <p className="text-gray-800 font-medium">{tournament.organizer}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Spots</p>
              <p className="text-gray-800 font-medium">
                {tournament.participants.length} / {tournament.maxParticipants}
                {spotsLeft > 0 && (
                  <span className="text-gray-400 font-normal"> ({spotsLeft} left)</span>
                )}
              </p>
            </div>
          </div>

          {tournament.status === "upcoming" && spotsLeft > 0 && (
            <button className="mt-6 w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              Join tournament
            </button>
          )}
        </div>

        {/* Participants */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Participants ({tournament.participants.length})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {tournament.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                  {p.username[0].toUpperCase()}
                </div>
                <span className="text-sm text-gray-700">{p.username}</span>
              </div>
            ))}
            {Array.from({ length: spotsLeft }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200">
                <div className="w-6 h-6 rounded-full bg-gray-100" />
                <span className="text-sm text-gray-300">Open slot</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
