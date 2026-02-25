"use client";

import { useState, useMemo, useRef, type KeyboardEvent } from "react";
import { tournamentFormatInfo } from "@/types";
import { generateBracket, type Bracket, type BracketRound, type BracketMatch } from "@/lib/generateBracket";
import type { QuickTournamentData, Participant } from "./QuickTournamentForm";

interface Props {
  data: QuickTournamentData;
  onBack: () => void;
  onConfirm: (data: QuickTournamentData, bracket: Bracket) => void;
}

export default function TournamentPreview({ data, onBack, onConfirm }: Props) {
  const [name, setName] = useState(data.name);
  const [game, setGame] = useState(data.game);
  const [description, setDescription] = useState(data.description);
  const [participants, setParticipants] = useState<Participant[]>(data.participants);

  const participantNames = participants.map((p) => p.name);

  const bracket = useMemo(
    () => generateBracket(participantNames, data.format),
    [participantNames, data.format]
  );

  // ─── Drag and drop ────────────────────────────────────────────────────────
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(index);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) {
      setDragOver(null);
      return;
    }
    const updated = [...participants];
    const [moved] = updated.splice(dragIndex.current, 1);
    updated.splice(index, 0, moved);
    setParticipants(updated);
    dragIndex.current = null;
    setDragOver(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

  // ─── Reorder helpers ─────────────────────────────────────────────────────
  function moveUp(index: number) {
    if (index === 0) return;
    const updated = [...participants];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setParticipants(updated);
  }

  function moveDown(index: number) {
    if (index >= participants.length - 1) return;
    const updated = [...participants];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setParticipants(updated);
  }

  function shuffleParticipants() {
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setParticipants(shuffled);
  }

  // ─── Live add / remove participants ───────────────────────────────────────
  const [accountInput, setAccountInput] = useState("");
  const [guestInput, setGuestInput] = useState("");

  function addParticipant(name: string, type: "account" | "guest") {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Allow duplicates — auto-number with (2), (3), etc.
    let finalName = trimmed;
    if (participantNames.includes(trimmed)) {
      let n = 2;
      while (participantNames.includes(`${trimmed} (${n})`)) n++;
      finalName = `${trimmed} (${n})`;
    }
    setParticipants((prev) => [...prev, { name: finalName, type }]);
  }

  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  function removeParticipant(index: number) {
    if (confirmRemove === index) {
      setParticipants((prev) => prev.filter((_, i) => i !== index));
      setConfirmRemove(null);
    } else {
      setConfirmRemove(index);
    }
  }

  function handleAddKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: (v: string) => void,
    type: "account" | "guest"
  ) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addParticipant(input, type);
      setInput("");
    }
  }

  function handleAddBlur(input: string, setInput: (v: string) => void, type: "account" | "guest") {
    if (input.trim()) {
      addParticipant(input, type);
      setInput("");
    }
  }

  // ─── Confirm ──────────────────────────────────────────────────────────────
  function handleConfirm() {
    const updatedData: QuickTournamentData = { ...data, name, game, description, participants };
    onConfirm(updatedData, bracket);
  }

  const inputClass =
    "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const labelClass = "block text-xs text-gray-400 uppercase tracking-wide mb-1";

  return (
    <div className="flex flex-col gap-10">
      {/* Editable details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Tournament Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-full`} />
          </div>
          <div>
            <label className={labelClass}>Game</label>
            <input value={game} onChange={(e) => setGame(e.target.value)} className={`${inputClass} w-full`} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputClass} w-full resize-none`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Format</label>
            <p className="text-sm text-gray-700">{tournamentFormatInfo[data.format].label}</p>
          </div>
        </div>
      </div>

      {/* Seeding + Bracket side by side, with improved spacing and responsiveness */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-8 items-start">
        {/* Left: Seeding */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 xl:sticky xl:top-24 xl:max-h-[600px] xl:overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              Seeding <span className="text-xs font-normal text-gray-400">({participants.length})</span>
            </h2>
            <button
              type="button"
              onClick={shuffleParticipants}
              className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Shuffle
            </button>
          </div>
          <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1 mb-4">
            {participants.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 border rounded-lg px-4 py-2.5 text-sm cursor-grab active:cursor-grabbing select-none transition-colors ${
                  dragOver === i
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{ minHeight: 48 }}
              >
                <span className="text-gray-300 shrink-0 cursor-grab text-xs" title="Drag to reorder">⠿</span>
                <span className="text-xs text-gray-400 font-mono w-6 shrink-0 text-right">{i + 1}.</span>
                <span className={`truncate flex-1 text-sm ${p.type === "account" ? "text-gray-800" : "text-amber-700"}`}> 
                  {p.name}
                </span>
                <span className={`text-[10px] uppercase shrink-0 px-2 py-0.5 rounded leading-none ${
                  p.type === "account" ? "bg-indigo-50 text-indigo-500" : "bg-amber-50 text-amber-500"
                }`}>
                  {p.type === "account" ? "acc" : "guest"}
                </span>
                <div className="flex flex-col shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveUp(i); }}
                    disabled={i === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:text-gray-200 text-[10px] leading-none"
                    title="Move up"
                  >▲</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveDown(i); }}
                    disabled={i === participants.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:text-gray-200 text-[10px] leading-none"
                    title="Move down"
                  >▼</button>
                </div>
                {confirmRemove === i ? (
                  <span className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeParticipant(i); }}
                      className="text-[10px] text-red-600 hover:text-red-800 font-medium"
                    >Remove?</button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmRemove(null); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >Cancel</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeParticipant(i); }}
                    className="text-gray-300 hover:text-red-500 leading-none shrink-0"
                    title="Remove"
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {/* Add participants */}
          <div className="border-t border-gray-100 pt-3 mt-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Add participants</p>
            <div className="flex flex-col gap-2">
              <input
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value.replace(",", ""))}
                onKeyDown={(e) => handleAddKeyDown(e, accountInput, setAccountInput, "account")}
                onBlur={() => handleAddBlur(accountInput, setAccountInput, "account")}
                placeholder="Account (username/email)…"
                className={`${inputClass} w-full text-xs`}
              />
              <input
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value.replace(",", ""))}
                onKeyDown={(e) => handleAddKeyDown(e, guestInput, setGuestInput, "guest")}
                onBlur={() => handleAddBlur(guestInput, setGuestInput, "guest")}
                placeholder="Guest (display name)…"
                className={`${inputClass} w-full text-xs`}
              />
            </div>
          </div>
        </div>

        {/* Right: Bracket */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex flex-col">
          <h2 className="text-base font-bold text-gray-900 mb-4">Bracket Preview</h2>
          {participants.length < 2 ? (
            <p className="text-sm text-gray-400 italic">Add at least 2 participants to see the bracket.</p>
          ) : (
            <BracketView bracket={bracket} />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          ← Back to form
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={participants.length < 2}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm & Start Tournament
        </button>
      </div>
    </div>
  );
}

// ─── Bracket visualization (format-specific) ─────────────────────────────────

function BracketView({ bracket }: { bracket: Bracket }) {
  switch (bracket.format) {
    case "single_elimination":
      return <EliminationBracket rounds={bracket.rounds} />;
    case "double_elimination":
      return (
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Winners Bracket</h3>
            <EliminationBracket rounds={bracket.rounds} />
          </div>
          {bracket.losersRounds && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Losers Bracket</h3>
              <EliminationBracket rounds={bracket.losersRounds} />
            </div>
          )}
        </div>
      );
    case "round_robin":
    case "double_round_robin":
      return <RoundRobinView rounds={bracket.rounds} isDouble={bracket.format === "double_round_robin"} />;
    case "swiss":
      return <SwissView rounds={bracket.rounds} />;
    case "combination":
      return <CombinationView bracket={bracket} />;
  }
}

// ─── Elimination bracket (tree with connector lines) ──────────────────────────

const MATCH_W = 176;   // w-44 = 11rem = 176px
const MATCH_H = 64;    // two rows of ~32px each
const ROUND_GAP = 48;  // horizontal gap between rounds
const CONNECTOR_W = 32; // width of the connector zone between rounds
const COL_W = MATCH_W + ROUND_GAP;

function EliminationBracket({ rounds }: { rounds: BracketRound[] }) {
  if (rounds.length === 0) return null;

  // Calculate positions: each round's matches are vertically centered
  // First round sets the base spacing; later rounds space out to align
  const firstRoundCount = rounds[0].matches.length;
  const matchGap = 12;
  const totalHeight = firstRoundCount * MATCH_H + (firstRoundCount - 1) * matchGap;

  // Get the Y center of a match at (roundIndex, matchIndex)
  function getMatchY(roundIndex: number, matchIndex: number): number {
    const count = rounds[roundIndex].matches.length;
    const blockH = totalHeight / count;
    return blockH * matchIndex + blockH / 2;
  }

  const svgWidth = rounds.length * COL_W - ROUND_GAP;
  const svgHeight = totalHeight;

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
            const prevCount = rounds[prevRi].matches.length;

            return round.matches.map((_, mi) => {
              // This match is fed by two matches from the previous round
              // (or one if it's a preliminary → round 1 connection and counts don't divide evenly)
              const feedA = mi * 2;
              const feedB = mi * 2 + 1;

              const currX = ri * COL_W;
              const currY = getMatchY(ri, mi);
              const prevX = prevRi * COL_W + MATCH_W;

              const lines: React.ReactNode[] = [];

              if (feedA < prevCount) {
                const prevYA = getMatchY(prevRi, feedA);
                lines.push(
                  <path
                    key={`${ri}-${mi}-a`}
                    d={`M ${prevX} ${prevYA} H ${prevX + CONNECTOR_W / 2} V ${currY} H ${currX}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={1.5}
                  />
                );
              }
              if (feedB < prevCount) {
                const prevYB = getMatchY(prevRi, feedB);
                lines.push(
                  <path
                    key={`${ri}-${mi}-b`}
                    d={`M ${prevX} ${prevYB} H ${prevX + CONNECTOR_W / 2} V ${currY} H ${currX}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={1.5}
                  />
                );
              }

              return lines;
            });
          })}
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

        {/* Match cards */}
        {rounds.map((round, ri) =>
          round.matches.map((match, mi) => {
            const y = getMatchY(ri, mi) - MATCH_H / 2;
            return (
              <div
                key={match.id}
                className="absolute"
                style={{ left: ri * COL_W, top: y, width: MATCH_W }}
              >
                <MatchCard match={match} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatch }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm bg-white">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <span className={match.participantA ? "text-gray-800" : "text-gray-300 italic"}>
          {match.participantA ?? "TBD"}
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className={match.participantB ? "text-gray-800" : "text-gray-300 italic"}>
          {match.participantB ?? "TBD"}
        </span>
      </div>
    </div>
  );
}

// ─── Round Robin (grid + matchup list) ────────────────────────────────────────

function RoundRobinView({ rounds, isDouble }: { rounds: BracketRound[]; isDouble: boolean }) {
  const participantSet = new Set<string>();
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.participantA) participantSet.add(match.participantA);
      if (match.participantB) participantSet.add(match.participantB);
    }
  }
  const participants = Array.from(participantSet);

  // Build matchup lookup
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

  // Flat matchup list for the sidebar
  const allMatches: { round: number; a: string; b: string }[] = [];
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.participantA && match.participantB) {
        allMatches.push({ round: match.round, a: match.participantA, b: match.participantB });
      }
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Grid */}
      <div className="overflow-x-auto shrink-0">
        <div className="text-xs text-gray-500 mb-2">
          {totalGames} total game{totalGames !== 1 ? "s" : ""}
          {isDouble ? " (home & away)" : ""}
        </div>
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-500 font-medium">vs</th>
              {participants.map((p) => (
                <th key={p} className="p-2 text-center text-gray-700 font-medium min-w-[80px]">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((rowP) => (
              <tr key={rowP}>
                <td className="p-2 text-gray-700 font-medium">{rowP}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Matchup list */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Matchups</div>
        <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
          {rounds.map((round) => (
            <div key={round.name}>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-2 mb-1">{round.name}</div>
              {round.matches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center text-xs border border-gray-100 rounded px-2.5 py-1.5"
                >
                  <span className="flex-1 text-gray-800 truncate">{match.participantA ?? "TBD"}</span>
                  <span className="px-2 text-gray-400">vs</span>
                  <span className="flex-1 text-gray-800 truncate text-right">{match.participantB ?? "TBD"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Swiss (round-by-round list) ──────────────────────────────────────────────

function SwissView({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((round, ri) => (
        <div key={ri}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{round.name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {round.matches.map((match) => (
              <div key={match.id} className="flex items-center border border-gray-200 rounded-lg text-sm overflow-hidden">
                <span className="flex-1 px-3 py-2 text-gray-800 bg-gray-50">
                  {match.participantA ?? <span className="text-gray-300 italic">TBD</span>}
                </span>
                <span className="px-2 text-xs text-gray-400">vs</span>
                <span className="flex-1 px-3 py-2 text-gray-800 text-right">
                  {match.participantB ?? <span className="text-gray-300 italic">TBD</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Combination (groups + knockout) ──────────────────────────────────────────

function CombinationView({ bracket }: { bracket: Bracket }) {
  return (
    <div className="flex flex-col gap-8">
      {bracket.groups && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Group Stage</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bracket.groups.map((group, gi) => (
              <div key={gi} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-bold text-gray-800 mb-2">{group.name}</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {group.participants.map((p, pi) => (
                    <span key={pi} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {p}
                    </span>
                  ))}
                </div>
                {group.rounds.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {group.rounds.length} round{group.rounds.length !== 1 ? "s" : ""},{" "}
                    {group.rounds.reduce((sum, r) => sum + r.matches.length, 0)} matches
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {bracket.knockoutRounds && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Knockout Stage</h3>
          <EliminationBracket rounds={bracket.knockoutRounds} />
        </div>
      )}
    </div>
  );
}
