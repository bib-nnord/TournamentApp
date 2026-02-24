import Link from "next/link";
import type { Match, MatchStatus } from "@/types";
import { matchStatusLabel } from "@/types";

// Placeholder — replace with real fetch by id once backend is ready
const match: Match = {
  id: "m1",
  status: "completed",
  scheduledAt: "March 15, 2025 · 14:00",
  game: "Chess",
  playerA: { id: "u1", username: "alice", score: 3 },
  playerB: { id: "u2", username: "bob", score: 1 },
  tournament: { id: "1", name: "Spring Open 2025" },
  round: "Quarterfinal",
};

// Standalone example (no tournament):
// const match: Match = {
//   id: "m2",
//   status: "scheduled",
//   scheduledAt: "April 1, 2025 · 18:00",
//   game: "Rocket League",
//   playerA: { id: "u3", username: "charlie", score: null },
//   playerB: { id: "u4", username: "diana", score: null },
// };

const statusStyles: Record<MatchStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-500",
  tie: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-600",
};

function getWinner(match: Match): string | null {
  if (match.status !== "completed") return null;
  if (match.playerA.score === null || match.playerB.score === null) return null;
  if (match.playerA.score > match.playerB.score) return match.playerA.id;
  if (match.playerB.score > match.playerA.score) return match.playerB.id;
  return "draw";
}

export default function MatchPage() {
  const winner = getWinner(match);

  const backHref = match.tournament
    ? `/tournaments/view/${match.tournament.id}`
    : "/matches";
  const backLabel = match.tournament
    ? `← Back to ${match.tournament.name}`
    : "← Back to matches";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          {backLabel}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {match.playerA.username} vs {match.playerB.username}
              </h1>
              {match.tournament && (
                <p className="text-sm text-gray-400 mt-0.5">
                  <Link href={`/tournaments/view/${match.tournament.id}`} className="hover:underline">
                    {match.tournament.name}
                  </Link>
                  {match.round && <span> · {match.round}</span>}
                </p>
              )}
              {!match.tournament && (
                <p className="text-sm text-gray-400 mt-0.5">Standalone match</p>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[match.status]}`}>
              {matchStatusLabel[match.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mt-6">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Game</p>
              <p className="text-gray-800 font-medium">{match.game}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Scheduled</p>
              <p className="text-gray-800 font-medium">{match.scheduledAt}</p>
            </div>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Score</h2>

          <div className="flex items-center justify-between gap-4">
            {/* Player A */}
            <div className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-xl border-2 ${winner === match.playerA.id ? "border-indigo-400 bg-indigo-50" : "border-gray-100"}`}>
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-600">
                {match.playerA.username[0].toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-gray-800">{match.playerA.username}</p>
              <p className="text-4xl font-bold text-gray-900">
                {match.playerA.score ?? "—"}
              </p>
              {winner === match.playerA.id && (
                <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Winner</span>
              )}
            </div>

            <span className="text-xl font-bold text-gray-300">vs</span>

            {/* Player B */}
            <div className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-xl border-2 ${winner === match.playerB.id ? "border-indigo-400 bg-indigo-50" : "border-gray-100"}`}>
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-600">
                {match.playerB.username[0].toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-gray-800">{match.playerB.username}</p>
              <p className="text-4xl font-bold text-gray-900">
                {match.playerB.score ?? "—"}
              </p>
              {winner === match.playerB.id && (
                <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Winner</span>
              )}
            </div>
          </div>

          {winner === "draw" && (
            <p className="text-center text-sm text-gray-500 mt-4 font-medium">Draw</p>
          )}

          {match.status === "scheduled" && (
            <p className="text-center text-sm text-gray-400 mt-4">Match hasn&apos;t started yet.</p>
          )}
        </div>

        {/* Notes */}
        {match.notes && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Notes</h2>
            <p className="text-sm text-gray-600">{match.notes}</p>
          </div>
        )}

      </div>
    </div>
  );
}
