"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import {
  LABEL_BACK_TO_TOURNAMENTS,
  LABEL_FINISH_TOURNAMENT,
  LABEL_FINISHING,
  LABEL_CANCEL_TOURNAMENT,
  LABEL_CONFIRM_CANCEL,
  LABEL_CANCELLING,
  LABEL_NEVER_MIND,
  LABEL_DELETE_TOURNAMENT,
  LABEL_CONFIRM_DELETE,
  LABEL_DELETING,
  LABEL_CANCEL,
} from "@/constants/labels";
import type { TournamentStatus, TournamentFormat } from "@/types";
import { tournamentStatusLabel, tournamentFormatInfo } from "@/types";
import { apiFetch } from "@/lib/api";
import type { Bracket } from "@/lib/generateBracket";
import BracketView from "@/components/BracketView";
import StatusBadge from "@/components/StatusBadge";
import { tournamentStatusColors, participantTypeColors } from "@/lib/colors";
import { formatDate, getTournamentWinner } from "@/lib/helpers";
import type { RootState } from "@/store/store";
import type { TournamentParticipantData, TournamentData } from "./types";



export default function TournamentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const cancelAction = useConfirmAction(useCallback(async () => {
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setTournament(prev => prev ? { ...prev, status: "cancelled" } : prev);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to cancel tournament");
      }
    } catch {
      setError("Network error");
    }
  }, [tournament]));

  const deleteAction = useConfirmAction(useCallback(async () => {
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/tournaments");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to delete");
      }
    } catch {
      setError("Network error");
    }
  }, [tournament, router]));

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
            {LABEL_BACK_TO_TOURNAMENTS}
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

  const tournamentWinner = tournament.bracketData ? getTournamentWinner(tournament.bracketData) : null;

  async function handleFinish() {
    setFinishing(true);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        setTournament(prev => prev ? { ...prev, status: "completed" } : prev);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to finish tournament");
      }
    } catch {
      setError("Network error");
    } finally {
      setFinishing(false);
    }
  }

  async function handleReportResult(matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) {
    const res = await apiFetch(`/tournaments/${tournament!.id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({ winner, scoreA, scoreB }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to report result");
    }
    const { bracketData } = await res.json();
    setTournament(prev => prev ? { ...prev, bracketData } : prev);
  }

  async function handleReportTiebreaker(matchId: string, winnerName: string) {
    const res = await apiFetch(`/tournaments/${tournament!.id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({ winner: winnerName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to report tiebreaker result");
    }
    const { bracketData } = await res.json();
    setTournament(prev => prev ? { ...prev, bracketData } : prev);
  }

  async function handleUndoTiebreaker() {
    const res = await apiFetch(`/tournaments/${tournament!.id}/matches/tiebreaker`, {
      method: "PATCH",
      body: JSON.stringify({ reset: true }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to undo tiebreaker");
    }
    const { bracketData } = await res.json();
    setTournament(prev => prev ? { ...prev, bracketData } : prev);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Back */}
        <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← Back to tournaments
        </Link>

        {/* Winner banner */}
        {tournamentWinner && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Tournament Winner</p>
              <p className="text-lg font-bold text-amber-800">{tournamentWinner}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${tournamentStatusColors[tournament.status]}`}>
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
                {formatDate(tournament.createdAt)}
              </p>
            </div>
            {tournament.startDate && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Start date</p>
                <p className="text-gray-800 font-medium">
                  {formatDate(tournament.startDate, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 ${participantTypeColors[p.type]}`}>
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
            {isCreator && tournament.status === "active" && (
              <p className="text-xs text-gray-400 mb-3">Click a match to report the result.</p>
            )}
            <BracketView
              bracket={tournament.bracketData}
              onReportResult={isCreator && tournament.status === "active" ? handleReportResult : undefined}
              onReportTiebreaker={isCreator && tournament.status === "active" ? handleReportTiebreaker : undefined}
              onUndoTiebreaker={isCreator && tournament.status === "active" ? handleUndoTiebreaker : undefined}
            />
          </div>
        )}

        {/* Actions (creator only) */}
        {isCreator && (
          <div className="flex items-center gap-3 flex-wrap">
            {tournament.status === "active" && (
              <button
                type="button"
                onClick={handleFinish}
                disabled={!tournamentWinner || finishing}
                title={!tournamentWinner ? "Available once a winner is determined" : undefined}
                className="text-sm px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {finishing ? LABEL_FINISHING : LABEL_FINISH_TOURNAMENT}
              </button>
            )}
            {!["completed", "cancelled"].includes(tournament.status) && (
              <>
                <button
                  type="button"
                  onClick={cancelAction.trigger}
                  disabled={cancelAction.loading}
                  className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    cancelAction.confirmed
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : "border border-orange-300 text-orange-600 hover:bg-orange-50"
                  } disabled:opacity-50`}
                >
                  {cancelAction.loading ? LABEL_CANCELLING : cancelAction.confirmed ? LABEL_CONFIRM_CANCEL : LABEL_CANCEL_TOURNAMENT}
                </button>
                {cancelAction.confirmed && (
                  <button
                    type="button"
                    onClick={cancelAction.reset}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {LABEL_NEVER_MIND}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={deleteAction.trigger}
              disabled={deleteAction.loading}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                deleteAction.confirmed
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-red-200 text-red-600 hover:bg-red-50"
              } disabled:opacity-50`}
            >
              {deleteAction.loading ? LABEL_DELETING : deleteAction.confirmed ? LABEL_CONFIRM_DELETE : LABEL_DELETE_TOURNAMENT}
            </button>
            {deleteAction.confirmed && (
              <button
                type="button"
                onClick={deleteAction.reset}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {LABEL_CANCEL}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
