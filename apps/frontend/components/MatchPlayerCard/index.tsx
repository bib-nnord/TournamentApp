import { getUserInitial } from "@/lib/helpers";
import type { MatchPlayer } from "@/types";

interface MatchPlayerCardProps {
  player: MatchPlayer;
  isWinner: boolean;
}

export default function MatchPlayerCard({ player, isWinner }: MatchPlayerCardProps) {
  return (
    <div
      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-xl border-2 ${
        isWinner ? "border-indigo-400 bg-indigo-50" : "border-gray-100"
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-600">
        {getUserInitial(player.username)}
      </div>
      <p className="text-sm font-semibold text-gray-800">{player.username}</p>
      <p className="text-4xl font-bold text-gray-900">{player.score ?? "—"}</p>
      {isWinner && (
        <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
          Winner
        </span>
      )}
    </div>
  );
}
