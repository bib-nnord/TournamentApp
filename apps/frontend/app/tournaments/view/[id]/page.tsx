"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import type { TournamentStatus, TournamentFormat } from "@/types";
import { tournamentStatusLabel, tournamentFormatInfo } from "@/types";
import { apiFetch } from "@/lib/api";
import type { Bracket } from "@/lib/generateBracket";
import BracketView from "@/components/BracketView";
import type { RootState } from "@/store/store";

interface TournamentParticipantData {
  seed: number;
  displayName: string;
  guestName: string | null;
  userId: number | null;
  teamId: number | null;
  type: "account" | "guest" | "team";
  membersSnapshot: { name: string; type: string; userId: number | null }[] | null;
}

interface TournamentData {
  id: number;
  name: string;
  game: string;
  description: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  isPrivate: boolean;
  max: number;
  bracketData: Bracket | null;
  startDate: string | null;
  creator: { id: number; username: string };
  participants: TournamentParticipantData[];
  createdAt: string;
}

const statusColors: Record<TournamentStatus, string> = {
  draft: "bg-gray-100 text-gray-500",
  registration: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

const typeColors: Record<string, string> = {
  account: "bg-indigo-100 text-indigo-600",
  guest: "bg-amber-100 text-amber-600",
  team: "bg-purple-100 text-purple-600",
};

export default function TournamentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/tournaments/${params.id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Tournament not found");
          return;
        }
        setTournament(await res.json());
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading tournament…</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
            ← Back to tournaments
          </Link>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-red-600 text-sm">{error ?? "Tournament not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const spotsLeft = tournament.max - tournament.participants.length;
  const isCreator = currentUser?.id === tournament.creator.id;

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await apiFetch(`/tournaments/${tournament.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/tournaments");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to delete");
      }
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

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
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[tournament.status]}`}>
                {tournamentStatusLabel[tournament.status]}
              </span>
            </div>
          </div>
          {tournament.description && (
            <p className="text-sm text-gray-600 mb-6">{tournament.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Game</p>
              <p className="text-gray-800 font-medium">{tournament.game}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Format</p>
              <p className="text-gray-800 font-medium">{tournamentFormatInfo[tournament.format]?.label ?? tournament.format}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Organizer</p>
              <Link href={`/profile/${tournament.creator.username}`} className="text-gray-800 font-medium hover:text-indigo-600">
                {tournament.creator.username}
              </Link>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Participants</p>
              <p className="text-gray-800 font-medium">
                {tournament.participants.length} / {tournament.max}
                {spotsLeft > 0 && (
                  <span className="text-gray-400 font-normal"> ({spotsLeft} left)</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Created</p>
              <p className="text-gray-800 font-medium">
                {new Date(tournament.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
            {tournament.startDate && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Start date</p>
                <p className="text-gray-800 font-medium">
                  {new Date(tournament.startDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
            {tournament.isPrivate && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Visibility</p>
                <p className="text-gray-800 font-medium">Private</p>
              </div>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Participants ({tournament.participants.length})
          </h2>
          <div className="flex flex-col gap-2">
            {tournament.participants.map((p) => (
              <div
                key={p.seed}
                className="flex items-start gap-3 px-4 py-3 rounded-lg bg-gray-50"
              >
                <span className="text-xs text-gray-400 font-mono w-6 shrink-0 text-right mt-0.5">
                  {p.seed}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {p.type === "team" ? (
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600 shrink-0">
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                    ) : (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        p.type === "account" ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className={`text-sm font-medium truncate ${
                      p.type === "team" ? "text-purple-800" : p.type === "account" ? "text-gray-800" : "text-amber-700"
                    }`}>
                      {p.displayName}
                    </span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColors[p.type]}`}>
                      {p.type}
                    </span>
                  </div>
                  {p.type === "team" && p.membersSnapshot && p.membersSnapshot.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 ml-8">
                      {p.membersSnapshot.map((m, mi) => (
                        <span
                          key={mi}
                          className={`text-[11px] px-1.5 py-0.5 rounded ${
                            m.type === "account" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {spotsLeft > 0 && Array.from({ length: Math.min(spotsLeft, 4) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-gray-200">
                <span className="text-xs text-gray-300 font-mono w-6 shrink-0 text-right">
                  {tournament.participants.length + i + 1}.
                </span>
                <div className="w-6 h-6 rounded-full bg-gray-100 shrink-0" />
                <span className="text-sm text-gray-300">Open slot</span>
              </div>
            ))}
            {spotsLeft > 4 && (
              <p className="text-xs text-gray-400 text-center mt-1">
                +{spotsLeft - 4} more open slots
              </p>
            )}
          </div>
        </div>

        {/* Bracket */}
        {tournament.bracketData && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Bracket</h2>
            <BracketView bracket={tournament.bracketData} />
          </div>
        )}

        {/* Actions (creator only) */}
        {isCreator && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                confirmDelete
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-red-200 text-red-600 hover:bg-red-50"
              } disabled:opacity-50`}
            >
              {deleting ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete tournament"}
            </button>
            {confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
