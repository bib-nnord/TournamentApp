"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { apiFetch } from "@/lib/api";
import { usePolling } from "@/hooks/usePolling";
import type { RootState } from "@/store/store";

interface BracketMatchDetail {
  match: {
    id: string;
    participantA: string | null;
    participantB: string | null;
    completed: boolean;
    winner: string | null;
    tie: boolean;
    scoreA: number | null;
    scoreB: number | null;
  };
  section: string;
  roundIndex: number;
  allowTies: boolean;
  tournament: {
    id: number;
    name: string;
    game: string;
    format: string;
    isPrivate: boolean;
    status: string;
    creator: { id: number; username: string; displayName?: string | null };
    updatedAt: string;
  };
}

export default function MatchPage() {
  const { id: matchId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tournamentId = searchParams.get("t");
  const currentUser = useSelector((state: RootState) => state.user.current);

  const [data, setData] = useState<BracketMatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reporting state
  const [selectedWinner, setSelectedWinner] = useState<"a" | "b" | "tie" | null>(null);
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [conflictError, setConflictError] = useState(false);

  useEffect(() => {
    if (!tournamentId) {
      setError("No tournament specified");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Match not found");
          return;
        }
        const json: BracketMatchDetail = await res.json();
        setData(json);
        // Pre-fill if already completed
        if (json.match.completed) {
          if (json.match.tie) {
            setSelectedWinner("tie");
          } else if (json.match.winner) {
            setSelectedWinner(json.match.winner === json.match.participantA ? "a" : "b");
          }
          setScoreA(json.match.scoreA != null ? String(json.match.scoreA) : "0");
          setScoreB(json.match.scoreB != null ? String(json.match.scoreB) : "0");
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [matchId, tournamentId]);

  const pollMatch = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
  }, [matchId, tournamentId]);

  usePolling(pollMatch, 5000, data?.tournament.status === "active" && !data?.match.completed);

  async function handleSubmit() {
    if (!selectedWinner || !data || !tournamentId) return;

    const { match } = data;

    // Detect if editing a completed match would change which participant advances
    if (match.completed) {
      const oldWinner = match.tie ? "tie" : (match.winner === match.participantA ? "a" : "b");
      if (selectedWinner !== oldWinner) {
        const newLabel =
          selectedWinner === "a" ? match.participantA :
          selectedWinner === "b" ? match.participantB : "Draw";
        const ok = confirm(
          `Changing the winner to "${newLabel}" may affect matches in later rounds. Continue?`
        );
        if (!ok) return;
      }
    }

    // Score-mismatch confirmation
    const sA = scoreA !== "" ? Number(scoreA) : 0;
    const sB = scoreB !== "" ? Number(scoreB) : 0;
    const scoreMismatch =
      (selectedWinner === "a" && sB > sA) ||
      (selectedWinner === "b" && sA > sB) ||
      (selectedWinner === "tie" && sA !== sB);

    if (scoreMismatch) {
      const winnerLabel =
        selectedWinner === "a" ? match.participantA :
        selectedWinner === "b" ? match.participantB : "Draw";
      const ok = confirm(
        `The scores (${sA}–${sB}) don't match the result "${winnerLabel}". Submit anyway?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const sA = scoreA !== "" ? Number(scoreA) : undefined;
      const sB = scoreB !== "" ? Number(scoreB) : undefined;
      const res = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}`, {
        method: "PATCH",
        body: JSON.stringify({ winner: selectedWinner, scoreA: sA, scoreB: sB, clientUpdatedAt: data.tournament.updatedAt }),
      });
      if (res.status === 409) {
        setConflictError(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? "Failed to report result");
        return;
      }
      // Refresh match data
      const refreshRes = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}`);
      if (refreshRes.ok) {
        const updated: BracketMatchDetail = await refreshRes.json();
        setData(updated);
        setConflictError(false);
      }
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch {
      setSubmitError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetTiebreaker() {
    if (!data || !tournamentId || data.section !== "tiebreaker") return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}`, {
        method: "PATCH",
        body: JSON.stringify({ reset: true, clientUpdatedAt: data.tournament.updatedAt }),
      });
      if (res.status === 409) {
        setConflictError(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? "Failed to reset tiebreaker");
        return;
      }
      const refreshRes = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}`);
      if (refreshRes.ok) {
        const updated: BracketMatchDetail = await refreshRes.json();
        setData(updated);
        setConflictError(false);
      }
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch {
      setSubmitError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading match…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <Link href={tournamentId ? `/tournaments/view/${tournamentId}` : "/tournaments"} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
            ← Back
          </Link>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-red-600 text-sm">{error ?? "Match not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const { match, tournament, allowTies } = data;
  const isCreator = currentUser?.id === tournament.creator.id;
  const canReport = isCreator && tournament.status === "active"
    && !!match.participantA && match.participantA !== "TBD"
    && !!match.participantB && match.participantB !== "TBD";

  const isWinnerA = match.completed && !match.tie && match.winner === match.participantA;
  const isWinnerB = match.completed && !match.tie && match.winner === match.participantB;

  const sectionLabel: Record<string, string> = {
    winners: "Winners Bracket",
    losers: "Losers Bracket",
    knockout: "Knockout",
    tiebreaker: "Tiebreaker",
  };
  const sectionDisplay = data.section.startsWith("group_")
    ? `Group ${parseInt(data.section.split("_")[1]) + 1}`
    : (sectionLabel[data.section] ?? data.section);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href={`/tournaments/view/${tournament.id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← {tournament.name}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {match.participantA ?? "TBD"} vs {match.participantB ?? "TBD"}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{sectionDisplay}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              match.completed ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
            }`}>
              {match.completed ? (match.tie ? "Tie" : "Completed") : "Scheduled"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mt-6">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Game</p>
              <p className="text-gray-800 font-medium">{tournament.game}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Organizer</p>
              <Link href={`/profile/${tournament.creator.username}`} className="text-gray-800 font-medium hover:text-indigo-600 inline-flex items-center gap-1">
                <span>{tournament.creator.displayName || tournament.creator.username}</span>
                {tournament.creator.displayName && tournament.creator.displayName.toLowerCase() !== tournament.creator.username.toLowerCase() && (
                  <span className="text-xs text-gray-400 font-normal">@{tournament.creator.username}</span>
                )}
              </Link>
            </div>
            {tournament.isPrivate && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Visibility</p>
                <p className="text-gray-800 font-medium">Private</p>
              </div>
            )}
          </div>
        </div>

        {/* Scoreboard */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Score</h2>
          <div className="flex items-center justify-between gap-4">
            <div className={`flex-1 rounded-xl p-4 text-center ${isWinnerA ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border border-gray-100"}`}>
              {isWinnerA && <p className="text-xs font-bold text-emerald-600 mb-1">Winner</p>}
              <p className={`font-semibold text-sm truncate ${isWinnerA ? "text-emerald-800" : "text-gray-800"}`}>
                {match.participantA ?? <span className="text-gray-300 italic">TBD</span>}
              </p>
              {match.completed && match.scoreA != null && (
                <p className={`text-2xl font-bold mt-1 ${isWinnerA ? "text-emerald-700" : "text-gray-500"}`}>
                  {match.scoreA}
                </p>
              )}
            </div>

            <span className="text-xl font-bold text-gray-300 shrink-0">vs</span>

            <div className={`flex-1 rounded-xl p-4 text-center ${isWinnerB ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border border-gray-100"}`}>
              {isWinnerB && <p className="text-xs font-bold text-emerald-600 mb-1">Winner</p>}
              <p className={`font-semibold text-sm truncate ${isWinnerB ? "text-emerald-800" : "text-gray-800"}`}>
                {match.participantB ?? <span className="text-gray-300 italic">TBD</span>}
              </p>
              {match.completed && match.scoreB != null && (
                <p className={`text-2xl font-bold mt-1 ${isWinnerB ? "text-emerald-700" : "text-gray-500"}`}>
                  {match.scoreB}
                </p>
              )}
            </div>
          </div>
          {match.tie && (
            <p className="text-center text-sm text-gray-500 mt-4 font-medium">Draw</p>
          )}
        </div>

        {/* Conflict banner */}
        {conflictError && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800">This match was changed by someone else. Reload to see the latest version before making changes.</p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="shrink-0 text-sm font-semibold text-amber-700 border border-amber-400 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
            >
              Reload
            </button>
          </div>
        )}

        {/* Result reporting (creator only) */}
        {canReport && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              {match.completed ? "Update result" : "Report result"}
            </h2>

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSelectedWinner("a")}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors truncate ${
                  selectedWinner === "a"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-400"
                }`}
              >
                {match.participantA}
              </button>
              <button
                type="button"
                onClick={() => setSelectedWinner("b")}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors truncate ${
                  selectedWinner === "b"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-400"
                }`}
              >
                {match.participantB}
              </button>
            </div>

            {allowTies && (
              <button
                type="button"
                onClick={() => setSelectedWinner("tie")}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors mb-4 ${
                  selectedWinner === "tie"
                    ? "bg-gray-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200"
                }`}
              >
                Draw
              </button>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Score — {match.participantA}</label>
                <input
                  type="number"
                  min={0}
                  value={scoreA}
                  onChange={e => setScoreA(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <span className="text-gray-300 font-bold mt-5">–</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Score — {match.participantB}</label>
                <input
                  type="number"
                  min={0}
                  value={scoreB}
                  onChange={e => setScoreB(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            {submitError && <p className="text-xs text-red-500 mb-3">{submitError}</p>}
            {submitSuccess && <p className="text-xs text-emerald-600 mb-3">Result saved!</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedWinner || submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? "Saving…" : match.completed ? "Update result" : "Confirm result"}
            </button>

            {data.section === "tiebreaker" && match.completed && (
              <button
                type="button"
                onClick={handleResetTiebreaker}
                disabled={submitting}
                className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {submitting ? "Resetting…" : "Reset tiebreaker"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
