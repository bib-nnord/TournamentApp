"use client";

import { useState } from "react";
import type { Bracket, BracketRound, BracketMatch } from "@/lib/generateBracket";

// ─── Main entry point ─────────────────────────────────────────────────────────

export default function BracketView({ bracket, onSwapParticipants, advancersPerGroup, onAdvancersChange, autoAdvanceGroups, onAutoAdvanceGroupsChange, onMoveParticipant, onReportResult }: {
  bracket: Bracket;
  onSwapParticipants?: (a: string, b: string) => void;
  advancersPerGroup?: number;
  onAdvancersChange?: (n: number) => void;
  autoAdvanceGroups?: string[][];
  onAutoAdvanceGroupsChange?: (groups: string[][]) => void;
  onMoveParticipant?: (name: string, fromGroupIndex: number, toGroupIndex: number) => void;
  onReportResult?: (matchId: string, winner: "a" | "b", scoreA?: number, scoreB?: number) => Promise<void>;
}) {
  switch (bracket.format) {
    case "single_elimination":
      return <EliminationBracket rounds={bracket.rounds} onSwapParticipants={onSwapParticipants} onReportResult={onReportResult} />;
    case "double_elimination": {
      const allLosers = bracket.losersRounds ?? [];
      const grandFinalRound = allLosers.length > 0 && allLosers[allLosers.length - 1].name === "Grand Final"
        ? allLosers[allLosers.length - 1]
        : null;
      const losersOnly = grandFinalRound ? allLosers.slice(0, -1) : allLosers;

      return (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Winners Bracket</h3>
            <EliminationBracket
              rounds={bracket.rounds}
              onSwapParticipants={onSwapParticipants}
              grandFinal={grandFinalRound?.matches[0]}
              onReportResult={onReportResult}
            />
          </div>
          {losersOnly.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Losers Bracket</h3>
              <EliminationBracket
                rounds={losersOnly}
                onSwapParticipants={onSwapParticipants}
                showOutputConnector={!!grandFinalRound}
                onReportResult={onReportResult}
              />
            </div>
          )}
        </div>
      );
    }
    case "round_robin":
    case "double_round_robin":
      return <RoundRobinView rounds={bracket.rounds} isDouble={bracket.format === "double_round_robin"} onReportResult={onReportResult} />;
    case "swiss":
      return <SwissView rounds={bracket.rounds} onReportResult={onReportResult} />;
    case "combination":
      return (
        <CombinationView
          bracket={bracket}
          onSwapParticipants={onSwapParticipants}
          advancersPerGroup={advancersPerGroup}
          onAdvancersChange={onAdvancersChange}
          autoAdvanceGroups={autoAdvanceGroups}
          onAutoAdvanceGroupsChange={onAutoAdvanceGroupsChange}
          onMoveParticipant={onMoveParticipant}
          onReportResult={onReportResult}
        />
      );
  }
}

// ─── Elimination bracket (tree with connector lines) ──────────────────────────

const MATCH_W = 176;
const MATCH_H = 72; // slightly taller to accommodate result info
const ROUND_GAP = 48;
const CONNECTOR_W = 32;
const COL_W = MATCH_W + ROUND_GAP;

function EliminationBracket({
  rounds,
  onSwapParticipants,
  grandFinal,
  showOutputConnector,
  onReportResult,
}: {
  rounds: BracketRound[];
  onSwapParticipants?: (a: string, b: string) => void;
  grandFinal?: BracketMatch;
  showOutputConnector?: boolean;
  onReportResult?: (matchId: string, winner: "a" | "b", scoreA?: number, scoreB?: number) => Promise<void>;
}) {
  if (rounds.length === 0) return null;

  const firstRoundSlots = rounds[0].totalPositions ?? rounds[0].matches.length;
  const matchGap = 12;
  const totalHeight = firstRoundSlots * MATCH_H + (firstRoundSlots - 1) * matchGap;

  function getMatchYByPosition(totalSlots: number, position: number): number {
    const blockH = totalHeight / totalSlots;
    return blockH * position + blockH / 2;
  }

  function getRoundSlots(ri: number): number {
    return rounds[ri].totalPositions ?? rounds[ri].matches.length;
  }

  const baseSvgWidth = rounds.length * COL_W - ROUND_GAP;
  const hasExtra = !!grandFinal || !!showOutputConnector;
  const svgWidth = hasExtra ? baseSvgWidth + COL_W : baseSvgWidth;
  const svgHeight = totalHeight;

  const lastRi = rounds.length - 1;
  const lastSlots = getRoundSlots(lastRi);
  const lastMatch = rounds[lastRi].matches[0];
  const finalX = lastRi * COL_W + MATCH_W;
  const finalY = lastMatch ? getMatchYByPosition(lastSlots, lastMatch.position) : svgHeight / 2;

  const extraX = rounds.length * COL_W;
  const extraY = svgHeight / 2;

  return (
    <div className="overflow-x-auto pb-4 pt-8">
      <div className="relative" style={{ width: svgWidth, minHeight: svgHeight }}>
        {/* SVG connector lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgWidth}
          height={svgHeight}
          style={{ overflow: "visible" }}
        >
          {rounds.map((round, ri) => {
            if (ri === 0) return null;
            const prevRi = ri - 1;
            const prevMatches = rounds[prevRi].matches;
            const prevSlots = getRoundSlots(prevRi);
            const currSlots = getRoundSlots(ri);

            const is1to1 = prevSlots === currSlots;

            return round.matches.map((match) => {
              const currX = ri * COL_W;
              const currY = getMatchYByPosition(currSlots, match.position);
              const prevX = prevRi * COL_W + MATCH_W;

              const lines: React.ReactNode[] = [];

              if (is1to1) {
                const feedMatch = prevMatches.find(m => m.position === match.position);
                if (feedMatch) {
                  const prevY = getMatchYByPosition(prevSlots, feedMatch.position);
                  lines.push(
                    <path
                      key={`${ri}-${match.position}-s`}
                      d={`M ${prevX} ${prevY} H ${currX}`}
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                    />
                  );
                }
              } else {
                const feedPosA = match.position * 2;
                const feedPosB = match.position * 2 + 1;

                const feedMatchA = prevMatches.find(m => m.position === feedPosA);
                const feedMatchB = prevMatches.find(m => m.position === feedPosB);

                if (feedMatchA) {
                  const prevYA = getMatchYByPosition(prevSlots, feedMatchA.position);
                  lines.push(
                    <path
                      key={`${ri}-${match.position}-a`}
                      d={`M ${prevX} ${prevYA} H ${prevX + CONNECTOR_W / 2} V ${currY} H ${currX}`}
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                    />
                  );
                }
                if (feedMatchB) {
                  const prevYB = getMatchYByPosition(prevSlots, feedMatchB.position);
                  lines.push(
                    <path
                      key={`${ri}-${match.position}-b`}
                      d={`M ${prevX} ${prevYB} H ${prevX + CONNECTOR_W / 2} V ${currY} H ${currX}`}
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                    />
                  );
                }
              }

              return lines;
            });
          })}

          {/* Connector from final match to grand final */}
          {grandFinal && (
            <path
              d={`M ${finalX} ${finalY} H ${finalX + CONNECTOR_W / 2} V ${extraY} H ${extraX}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={1.5}
            />
          )}

          {/* Output connector from final match going right (losers → grand final) */}
          {showOutputConnector && !grandFinal && (
            <path
              d={`M ${finalX} ${finalY} H ${extraX + MATCH_W / 2}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          )}
        </svg>

        {/* Round labels */}
        {rounds.map((round, ri) => (
          <div
            key={`label-${ri}`}
            className="absolute text-xs font-semibold text-gray-500 uppercase tracking-wide text-center"
            style={{ left: ri * COL_W, width: MATCH_W, top: -24 }}
          >
            {round.name}
          </div>
        ))}

        {/* Grand final label */}
        {grandFinal && (
          <div
            className="absolute text-xs font-bold text-indigo-600 uppercase tracking-wide text-center"
            style={{ left: extraX, width: MATCH_W, top: -24 }}
          >
            Grand Final
          </div>
        )}

        {/* Output connector label */}
        {showOutputConnector && !grandFinal && (
          <div
            className="absolute text-[10px] text-indigo-400 italic text-center"
            style={{ left: extraX, width: MATCH_W, top: extraY - MATCH_H / 2 - 14 }}
          >
            → to Grand Final
          </div>
        )}

        {/* Match cards */}
        {rounds.map((round, ri) => {
          const slots = getRoundSlots(ri);
          return round.matches.map((match) => {
            const y = getMatchYByPosition(slots, match.position) - MATCH_H / 2;
            return (
              <div
                key={match.id}
                className="absolute"
                style={{ left: ri * COL_W, top: y, width: MATCH_W }}
              >
                <MatchCard match={match} onSwapParticipants={onSwapParticipants} onReportResult={onReportResult} />
              </div>
            );
          });
        })}

        {/* Grand final match card */}
        {grandFinal && (
          <div
            className="absolute"
            style={{ left: extraX, top: extraY - MATCH_H / 2, width: MATCH_W }}
          >
            <MatchCard match={grandFinal} onReportResult={onReportResult} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  onSwapParticipants,
  onReportResult,
}: {
  match: BracketMatch;
  onSwapParticipants?: (a: string, b: string) => void;
  onReportResult?: (matchId: string, winner: "a" | "b", scoreA?: number, scoreB?: number) => Promise<void>;
}) {
  const [dropTarget, setDropTarget] = useState<"a" | "b" | null>(null);
  const [reporting, setReporting] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<"a" | "b" | null>(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, name: string) {
    e.dataTransfer.setData("text/participant", name);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, slot: "a" | "b") {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(slot);
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  function handleDrop(e: React.DragEvent, targetName: string | null) {
    e.preventDefault();
    setDropTarget(null);
    const sourceName = e.dataTransfer.getData("text/participant");
    if (sourceName && targetName && sourceName !== targetName && onSwapParticipants) {
      onSwapParticipants(sourceName, targetName);
    }
  }

  async function handleSubmit() {
    if (!selectedWinner || !onReportResult) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sA = scoreA !== "" ? Number(scoreA) : undefined;
      const sB = scoreB !== "" ? Number(scoreB) : undefined;
      await onReportResult(match.id, selectedWinner, sA, sB);
      setReporting(false);
      setSelectedWinner(null);
      setScoreA("");
      setScoreB("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setReporting(false);
    setSelectedWinner(null);
    setScoreA("");
    setScoreB("");
    setSubmitError(null);
  }

  function renderName(name: string | null | undefined) {
    if (!name || name === "TBD") return <span className="print-hide-tbd text-gray-300 italic">TBD</span>;
    return <>{name}</>;
  }

  const canDrag = !!onSwapParticipants;
  const canReport = !!onReportResult && !!match.participantA && !!match.participantB && !match.completed;
  const wbA = match.wbDropDown === "a" || match.wbDropDown === "both";
  const wbB = match.wbDropDown === "b" || match.wbDropDown === "both";

  const isWinnerA = match.completed && match.winner === match.participantA;
  const isWinnerB = match.completed && match.winner === match.participantB;

  // ── Reporting overlay ─────────────────────────────────────────────────
  if (reporting) {
    return (
      <div className="border border-indigo-300 rounded-lg overflow-hidden text-sm bg-white shadow-md">
        <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100">
          <p className="text-xs font-semibold text-indigo-700 mb-2">Who won?</p>
          <div className="flex gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => setSelectedWinner("a")}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors truncate ${
                selectedWinner === "a"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-400"
              }`}
            >
              {match.participantA}
            </button>
            <button
              type="button"
              onClick={() => setSelectedWinner("b")}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors truncate ${
                selectedWinner === "b"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-400"
              }`}
            >
              {match.participantB}
            </button>
          </div>
          <div className="flex items-center gap-1 mb-2">
            <input
              type="number"
              min={0}
              placeholder="—"
              value={scoreA}
              onChange={e => setScoreA(e.target.value)}
              className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <span className="text-[10px] text-gray-400 flex-1 text-center">score (optional)</span>
            <input
              type="number"
              min={0}
              placeholder="—"
              value={scoreB}
              onChange={e => setScoreB(e.target.value)}
              className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          {submitError && <p className="text-[10px] text-red-500 mb-1">{submitError}</p>}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedWinner || submitting}
              className="flex-1 py-1 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="px-3 py-1 rounded text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal card ────────────────────────────────────────────────────────
  return (
    <div
      className={`border rounded-lg overflow-hidden text-sm bg-white ${
        match.completed
          ? "border-gray-200"
          : canReport
            ? "border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors"
            : "border-gray-200"
      }`}
      onClick={canReport ? () => setReporting(true) : undefined}
      title={canReport ? "Click to report result" : undefined}
    >
      {/* Side A */}
      <div
        draggable={!!match.participantA && canDrag}
        onDragStart={(e) => match.participantA && handleDragStart(e, match.participantA)}
        onDragOver={(e) => match.participantA && handleDragOver(e, "a")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, match.participantA)}
        onClick={canReport ? e => e.stopPropagation() : undefined}
        className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 transition-colors ${
          isWinnerA
            ? "bg-emerald-50"
            : dropTarget === "a"
              ? "bg-indigo-50"
              : wbA
                ? "bg-amber-50/60"
                : "bg-gray-50"
        } ${match.participantA && canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${!match.participantA || match.participantA === "TBD" ? "print-tbd-row" : ""}`}
      >
        {wbA && <span className="text-[9px] text-amber-500 font-semibold shrink-0" title="From Winners Bracket">WB</span>}
        {isWinnerA && <span className="text-[9px] text-emerald-600 font-bold shrink-0">W</span>}
        <span className={`flex-1 truncate ${isWinnerA ? "text-emerald-700 font-semibold" : match.participantA && match.participantA !== "TBD" ? "text-gray-800" : "text-gray-300 italic"}`}>
          {renderName(match.participantA)}
        </span>
        {match.completed && match.scoreA != null && (
          <span className={`text-xs font-mono shrink-0 ${isWinnerA ? "text-emerald-700 font-bold" : "text-gray-400"}`}>
            {match.scoreA}
          </span>
        )}
      </div>

      {/* Side B */}
      <div
        draggable={!!match.participantB && canDrag}
        onDragStart={(e) => match.participantB && handleDragStart(e, match.participantB)}
        onDragOver={(e) => match.participantB && handleDragOver(e, "b")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, match.participantB)}
        onClick={canReport ? e => e.stopPropagation() : undefined}
        className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
          isWinnerB
            ? "bg-emerald-50"
            : dropTarget === "b"
              ? "bg-indigo-50"
              : wbB
                ? "bg-amber-50/60"
                : ""
        } ${match.participantB && canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${!match.participantB || match.participantB === "TBD" ? "print-tbd-row" : ""}`}
      >
        {wbB && <span className="text-[9px] text-amber-500 font-semibold shrink-0" title="From Winners Bracket">WB</span>}
        {isWinnerB && <span className="text-[9px] text-emerald-600 font-bold shrink-0">W</span>}
        <span className={`flex-1 truncate ${isWinnerB ? "text-emerald-700 font-semibold" : match.participantB && match.participantB !== "TBD" ? "text-gray-800" : "text-gray-300 italic"}`}>
          {renderName(match.participantB)}
        </span>
        {match.completed && match.scoreB != null && (
          <span className={`text-xs font-mono shrink-0 ${isWinnerB ? "text-emerald-700 font-bold" : "text-gray-400"}`}>
            {match.scoreB}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Round Robin (grid + matchup list) ────────────────────────────────────────

function RoundRobinView({
  rounds,
  isDouble,
  onReportResult,
}: {
  rounds: BracketRound[];
  isDouble: boolean;
  onReportResult?: (matchId: string, winner: "a" | "b", scoreA?: number, scoreB?: number) => Promise<void>;
}) {
  const participantSet = new Set<string>();
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.participantA) participantSet.add(match.participantA);
      if (match.participantB) participantSet.add(match.participantB);
    }
  }
  const participants = Array.from(participantSet);

  // Build win counts for standings
  const wins = new Map<string, number>();
  for (const p of participants) wins.set(p, 0);
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.completed && match.winner) {
        wins.set(match.winner, (wins.get(match.winner) ?? 0) + 1);
      }
    }
  }

  const matchups = new Map<string, number[]>();
  let totalGames = 0;
  for (const round of rounds) {
    for (const match of round.matches) {
      totalGames++;
      if (match.participantA && match.participantB) {
        const key = `${match.participantA}|${match.participantB}`;
        if (!matchups.has(key)) matchups.set(key, []);
        matchups.get(key)!.push(match.round);
      }
    }
  }

  function getRound(a: string, b: string): string {
    const key1 = `${a}|${b}`;
    const key2 = `${b}|${a}`;
    const r = matchups.get(key1) || matchups.get(key2);
    return r ? r.map((n) => `R${n}`).join(", ") : "";
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* Grid */}
      <div className="overflow-auto max-h-[400px] min-w-0">
        <div className="text-xs text-gray-500 mb-2 sticky top-0 bg-white z-10">
          {totalGames} total game{totalGames !== 1 ? "s" : ""}
          {isDouble ? " (home & away)" : ""}
        </div>
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-500 font-medium sticky left-0 top-5 z-20 bg-white">vs</th>
              {participants.map((p) => (
                <th key={p} className="p-2 text-center text-gray-700 font-medium min-w-[80px] sticky top-5 bg-white z-10">
                  {p}
                </th>
              ))}
              {wins.size > 0 && <th className="p-2 text-center text-gray-500 font-medium sticky top-5 bg-white z-10">W</th>}
            </tr>
          </thead>
          <tbody>
            {participants.map((rowP) => (
              <tr key={rowP}>
                <td className="p-2 text-gray-700 font-medium sticky left-0 bg-white z-10">{rowP}</td>
                {participants.map((colP) => (
                  <td
                    key={colP}
                    className={`p-2 text-center border border-gray-100 ${
                      rowP === colP ? "bg-gray-50 text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {rowP === colP ? "—" : getRound(rowP, colP)}
                  </td>
                ))}
                {wins.size > 0 && (
                  <td className="p-2 text-center border border-gray-100 font-semibold text-gray-700">
                    {wins.get(rowP) ?? 0}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Matchup list */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Matchups</div>
        <div className="max-h-80 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
            {rounds.map((round) => (
              <div key={round.name} className="mb-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-2 mb-1">{round.name}</div>
                <div className="space-y-1">
                  {round.matches.map((match) => (
                    <MatchRow key={match.id} match={match} onReportResult={onReportResult} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Swiss (round-by-round list) ──────────────────────────────────────────────

function SwissView({
  rounds,
  onReportResult,
}: {
  rounds: BracketRound[];
  onReportResult?: (matchId: string, winner: "a" | "b", scoreA?: number, scoreB?: number) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((round, ri) => (
        <div key={ri}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{round.name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {round.matches.map((match) => (
              <MatchRow key={match.id} match={match} onReportResult={onReportResult} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared flat match row (round robin / swiss) ───────────────────────────────

function MatchRow({
  match,
  onReportResult,
}: {
  match: BracketMatch;
  onReportResult?: (matchId: string, winner: "a" | "b", scoreA?: number, scoreB?: number) => Promise<void>;
}) {
  const [reporting, setReporting] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<"a" | "b" | null>(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canReport = !!onReportResult && !!match.participantA && !!match.participantB && !match.completed;
  const isWinnerA = match.completed && match.winner === match.participantA;
  const isWinnerB = match.completed && match.winner === match.participantB;

  async function handleSubmit() {
    if (!selectedWinner || !onReportResult) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sA = scoreA !== "" ? Number(scoreA) : undefined;
      const sB = scoreB !== "" ? Number(scoreB) : undefined;
      await onReportResult(match.id, selectedWinner, sA, sB);
      setReporting(false);
      setSelectedWinner(null);
      setScoreA("");
      setScoreB("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (reporting) {
    return (
      <div className="border border-indigo-300 rounded-lg p-2 bg-white text-xs">
        <div className="flex gap-1.5 mb-1.5">
          <button
            type="button"
            onClick={() => setSelectedWinner("a")}
            className={`flex-1 py-1 rounded font-medium truncate transition-colors ${selectedWinner === "a" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-indigo-50"}`}
          >
            {match.participantA}
          </button>
          <button
            type="button"
            onClick={() => setSelectedWinner("b")}
            className={`flex-1 py-1 rounded font-medium truncate transition-colors ${selectedWinner === "b" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-indigo-50"}`}
          >
            {match.participantB}
          </button>
        </div>
        <div className="flex items-center gap-1 mb-1.5">
          <input type="number" min={0} placeholder="—" value={scoreA} onChange={e => setScoreA(e.target.value)} className="w-10 text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <span className="flex-1 text-center text-gray-400">vs</span>
          <input type="number" min={0} placeholder="—" value={scoreB} onChange={e => setScoreB(e.target.value)} className="w-10 text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
        {submitError && <p className="text-red-500 mb-1">{submitError}</p>}
        <div className="flex gap-1">
          <button type="button" onClick={handleSubmit} disabled={!selectedWinner || submitting} className="flex-1 py-1 rounded font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            {submitting ? "Saving…" : "Confirm"}
          </button>
          <button type="button" onClick={() => { setReporting(false); setSelectedWinner(null); setScoreA(""); setScoreB(""); setSubmitError(null); }} className="px-2 py-1 rounded text-gray-500 border border-gray-200 hover:border-gray-300">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={canReport ? () => setReporting(true) : undefined}
      className={`flex items-center border rounded-lg text-xs overflow-hidden ${
        match.completed ? "border-gray-200" : canReport ? "border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors" : "border-gray-200"
      }`}
    >
      <span className={`flex-1 px-2.5 py-1.5 truncate ${isWinnerA ? "bg-emerald-50 text-emerald-700 font-semibold" : "bg-gray-50 text-gray-800"} ${!match.participantA || match.participantA === "TBD" ? "print-tbd-row" : ""}`}>
        {isWinnerA && <span className="text-[9px] font-bold mr-1">W</span>}
        {!match.participantA || match.participantA === "TBD" ? <span className="text-gray-300 italic print-hide-tbd">TBD</span> : match.participantA}
        {match.completed && match.scoreA != null && <span className="ml-1 text-gray-400">{match.scoreA}</span>}
      </span>
      <span className="px-2 text-gray-400">vs</span>
      <span className={`flex-1 px-2.5 py-1.5 truncate text-right ${isWinnerB ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-gray-800"} ${!match.participantB || match.participantB === "TBD" ? "print-tbd-row" : ""}`}>
        {!match.participantB || match.participantB === "TBD" ? <span className="text-gray-300 italic print-hide-tbd">TBD</span> : match.participantB}
        {match.completed && match.scoreB != null && <span className="ml-1 text-gray-400">{match.scoreB}</span>}
        {isWinnerB && <span className="text-[9px] font-bold ml-1">W</span>}
      </span>
    </div>
  );
}

// ─── Combination (groups + knockout) ──────────────────────────────────────────

function CombinationView({
  bracket,
  onSwapParticipants,
  advancersPerGroup = 2,
  onAdvancersChange,
  autoAdvanceGroups = [],
  onAutoAdvanceGroupsChange,
  onMoveParticipant,
  onReportResult,
}: {
  bracket: Bracket;
  onSwapParticipants?: (a: string, b: string) => void;
  advancersPerGroup?: number;
  onAdvancersChange?: (n: number) => void;
  autoAdvanceGroups?: string[][];
  onAutoAdvanceGroupsChange?: (groups: string[][]) => void;
  onMoveParticipant?: (name: string, fromGroupIndex: number, toGroupIndex: number) => void;
  onReportResult?: (matchId: string, winner: "a" | "b", scoreA?: number, scoreB?: number) => Promise<void>;
}) {
  const [dragName, setDragName] = useState<string | null>(null);
  const [dragFromGroup, setDragFromGroup] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropGroupTarget, setDropGroupTarget] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, name: string, groupIndex: number) {
    setDragName(name);
    setDragFromGroup(groupIndex);
    e.dataTransfer.setData("text/group-participant", name);
    e.dataTransfer.setData("text/group-index", String(groupIndex));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOverParticipant(e: React.DragEvent, name: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (name !== dragName) {
      setDropTarget(name);
      setDropGroupTarget(null);
    }
  }

  function handleDragOverGroup(e: React.DragEvent, groupIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (groupIndex !== dragFromGroup) {
      setDropGroupTarget(groupIndex);
    }
  }

  function handleDragLeave() {
    setDropTarget(null);
    setDropGroupTarget(null);
  }

  function handleDropOnParticipant(e: React.DragEvent, targetName: string, targetGroupIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setDropGroupTarget(null);
    const sourceName = e.dataTransfer.getData("text/group-participant");
    const fromGroup = parseInt(e.dataTransfer.getData("text/group-index"), 10);
    if (!sourceName || isNaN(fromGroup) || sourceName === targetName) return;

    const isFromAuto = fromGroup >= regularGroups.length;
    const isToAuto = targetGroupIndex >= regularGroups.length;

    if (isFromAuto || isToAuto) {
      if (onMoveParticipant) {
        onMoveParticipant(sourceName, fromGroup, targetGroupIndex);
      }
    } else {
      if (onSwapParticipants) {
        onSwapParticipants(sourceName, targetName);
      }
    }
  }

  function handleDropOnGroup(e: React.DragEvent, targetGroupIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setDropGroupTarget(null);
    const sourceName = e.dataTransfer.getData("text/group-participant");
    const fromGroup = parseInt(e.dataTransfer.getData("text/group-index"), 10);
    if (sourceName && !isNaN(fromGroup) && fromGroup !== targetGroupIndex && onMoveParticipant) {
      onMoveParticipant(sourceName, fromGroup, targetGroupIndex);
    }
  }

  function handleDragEnd() {
    setDragName(null);
    setDragFromGroup(null);
    setDropTarget(null);
    setDropGroupTarget(null);
  }

  const regularGroups = bracket.groups?.filter(g => !g.autoAdvance) ?? [];
  const minGroupSize = regularGroups.reduce((min, g) => Math.min(min, g.participants.length), Infinity);
  const maxAdvancers = isFinite(minGroupSize) ? Math.max(1, minGroupSize - 1) : 1;

  return (
    <div className="flex flex-col gap-8">
      {bracket.groups && (
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-600">Group Stage</h3>
            {onAdvancersChange && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Advance per group:</label>
                <input
                  type="number"
                  min={1}
                  max={maxAdvancers}
                  value={advancersPerGroup}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(maxAdvancers, parseInt(e.target.value, 10) || 1));
                    onAdvancersChange(v);
                  }}
                  className="w-14 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            )}
            {onAutoAdvanceGroupsChange && (
              <button
                type="button"
                onClick={() => onAutoAdvanceGroupsChange([...autoAdvanceGroups, []])}
                className="text-xs px-2.5 py-1 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
              >
                + Auto-advance group
              </button>
            )}
            {onSwapParticipants && (
              <span className="text-[10px] text-gray-400 italic">Drag participants between groups</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bracket.groups.map((group, gi) => {
              const isAutoAdvance = !!group.autoAdvance;
              const isDropHere = dropGroupTarget === gi;
              return (
                <div
                  key={gi}
                  onDragOver={(e) => handleDragOverGroup(e, gi)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnGroup(e, gi)}
                  className={`rounded-lg p-4 transition-colors ${
                    isAutoAdvance
                      ? `border-2 border-dashed ${isDropHere ? "border-indigo-400 bg-indigo-50/50" : "border-gray-300 bg-gray-50/50"}`
                      : `border ${isDropHere ? "border-indigo-400 bg-indigo-50/30" : "border-gray-200"}`
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{group.name}</span>
                      {isAutoAdvance && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">
                          Auto-advance
                        </span>
                      )}
                    </div>
                    {isAutoAdvance && onAutoAdvanceGroupsChange && (
                      <button
                        type="button"
                        onClick={() => {
                          const autoIdx = gi - regularGroups.length;
                          onAutoAdvanceGroupsChange(autoAdvanceGroups.filter((_, i) => i !== autoIdx));
                        }}
                        className="text-gray-300 hover:text-red-500 text-sm leading-none"
                        title="Remove auto-advance group"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
                    {group.participants.length === 0 && (
                      <span className="text-xs text-gray-300 italic">Drop participants here</span>
                    )}
                    {group.participants.map((p, pi) => (
                      <span
                        key={pi}
                        draggable={!!onSwapParticipants || !!onMoveParticipant}
                        onDragStart={(e) => handleDragStart(e, p, gi)}
                        onDragOver={(e) => handleDragOverParticipant(e, p)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnParticipant(e, p, gi)}
                        onDragEnd={handleDragEnd}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                          dropTarget === p
                            ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400"
                            : dragName === p
                              ? "bg-indigo-50 text-indigo-600 opacity-60"
                              : isAutoAdvance
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-700"
                        } ${onSwapParticipants || onMoveParticipant ? "cursor-grab active:cursor-grabbing select-none" : ""}`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {!isAutoAdvance && group.rounds.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-gray-500">
                        {group.rounds.length} round{group.rounds.length !== 1 ? "s" : ""},{" "}
                        {group.rounds.reduce((sum, r) => sum + r.matches.length, 0)} matches
                        {` · top ${advancersPerGroup} advance`}
                      </div>
                      {onReportResult && (
                        <div className="mt-2 space-y-1">
                          {group.rounds.map((round) =>
                            round.matches.map((match) => (
                              <MatchRow key={match.id} match={match} onReportResult={onReportResult} />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {isAutoAdvance && group.participants.length > 0 && (
                    <div className="text-xs text-emerald-500">
                      All {group.participants.length} advance directly to knockout
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {bracket.knockoutRounds && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Knockout Stage</h3>
          <EliminationBracket rounds={bracket.knockoutRounds} onReportResult={onReportResult} />
        </div>
      )}
    </div>
  );
}
