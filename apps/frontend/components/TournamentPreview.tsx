"use client";

import { useState, useMemo, useRef, type KeyboardEvent } from "react";
import { tournamentFormatInfo, type TournamentFormat } from "@/types";
import { generateBracket, type Bracket, type BracketRound, type BracketMatch, type BracketOptions } from "@/lib/generateBracket";
import type { QuickTournamentData, Participant } from "./QuickTournamentForm";
import UserSearchInput from "./UserSearchInput";

interface Props {
  data: QuickTournamentData;
  onBack: () => void;
  onConfirm: (data: QuickTournamentData, bracket: Bracket) => void;
  submitting?: boolean;
  submitError?: string | null;
}

export default function TournamentPreview({ data, onBack, onConfirm, submitting, submitError }: Props) {
  const [name, setName] = useState(data.name);
  const [game, setGame] = useState(data.game);
  const [description, setDescription] = useState(data.description);
  const [format, setFormat] = useState<TournamentFormat>(data.format);
  const [isPrivate, setIsPrivate] = useState(data.isPrivate);
  const [participants, setParticipants] = useState<Participant[]>(data.participants);

  const participantNames = participants.map((p) => p.name);

  // Combination format options
  const [advancersPerGroup, setAdvancersPerGroup] = useState(data.advancersPerGroup ?? 2);
  const [autoAdvanceGroups, setAutoAdvanceGroups] = useState<string[][]>([]);

  const bracket = useMemo(
    () => generateBracket(participantNames, format, format === "combination" ? { advancersPerGroup, autoAdvanceGroups } : undefined),
    [participantNames, format, advancersPerGroup, autoAdvanceGroups]
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
  const teamMode = data.teamMode;
  const [teamNameInput, setTeamNameInput] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  function addParticipant(name: string, type: "account" | "guest" | "team") {
    const trimmed = name.trim();
    if (!trimmed) return;
    let finalName = trimmed;
    if (participantNames.includes(trimmed)) {
      let n = 2;
      while (participantNames.includes(`${trimmed} (${n})`)) n++;
      finalName = `${trimmed} (${n})`;
    }
    setParticipants((prev) => [...prev, {
      name: finalName,
      type,
      ...(type === "team" ? { members: [] } : {}),
    }]);
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
    type: "account" | "guest" | "team"
  ) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addParticipant(input, type);
      setInput("");
    }
  }

  function handleAddBlur(input: string, setInput: (v: string) => void, type: "account" | "guest" | "team") {
    if (input.trim()) {
      addParticipant(input, type);
      setInput("");
    }
  }

  // ─── Team member editing (in preview) ─────────────────────────────────────
  function addTeamMember(participantIndex: number, memberName: string, memberType: "account" | "guest") {
    const trimmed = memberName.trim();
    if (!trimmed) return;
    setParticipants((prev) =>
      prev.map((p, i) =>
        i === participantIndex && p.type === "team"
          ? { ...p, members: [...(p.members ?? []), { name: trimmed, type: memberType }] }
          : p
      )
    );
  }

  function removeTeamMember(participantIndex: number, memberIndex: number) {
    setParticipants((prev) =>
      prev.map((p, i) =>
        i === participantIndex && p.type === "team"
          ? { ...p, members: (p.members ?? []).filter((_, mi) => mi !== memberIndex) }
          : p
      )
    );
  }

  // ─── Swap participants (from bracket drag-and-drop) ──────────────────────
  function swapParticipants(nameA: string, nameB: string) {
    const idxA = participants.findIndex((p) => p.name === nameA);
    const idxB = participants.findIndex((p) => p.name === nameB);
    if (idxA === -1 || idxB === -1 || idxA === idxB) return;
    const updated = [...participants];
    [updated[idxA], updated[idxB]] = [updated[idxB], updated[idxA]];
    setParticipants(updated);
  }

  // ─── Confirm ──────────────────────────────────────────────────────────────
  function handleConfirm() {
    const updatedData: QuickTournamentData = { ...data, name, game, description, format, isPrivate, participants, advancersPerGroup };
    onConfirm(updatedData, bracket);
  }

  const inputClass =
    "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const labelClass = "block text-xs text-gray-400 uppercase tracking-wide mb-1";

  return (
    <div className="flex flex-col gap-8 print-preview-root">
      {/* Print-only compact details summary (hidden on screen, shown in print next to bracket) */}
      <div className="hidden print-details-summary bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">Tournament Details</h2>
        <dl className="text-sm space-y-2">
          <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Name</dt><dd className="text-gray-900 font-medium">{name}</dd></div>
          <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Game</dt><dd className="text-gray-900 font-medium">{game || "—"}</dd></div>
          {description && <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Description</dt><dd className="text-gray-700">{description}</dd></div>}
          <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Format</dt><dd className="text-gray-900 font-medium">{tournamentFormatInfo[format]?.label ?? format}</dd></div>
          <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Participants</dt><dd className="text-gray-900 font-medium">{participants.length}</dd></div>
        </dl>
      </div>

      {/* Top row: Details + Seeding side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start no-print">
        {/* Left: Editable details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
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
            <div>
              <label className={labelClass}>Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className={`${inputClass} w-full`}
              >
                {(Object.entries(tournamentFormatInfo) as [TournamentFormat, { label: string; description: string }][]).map(
                  ([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Seeding */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-h-[420px] flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
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
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 min-h-0">
            {participants.map((p, i) => (
              <div key={`${p.name}-${i}`}>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 border rounded-lg px-4 py-2.5 text-sm cursor-grab active:cursor-grabbing select-none transition-colors ${
                    dragOver === i
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${p.type === "team" && expandedTeam === i ? "rounded-b-none border-b-0" : ""}`}
                  style={{ minHeight: 48 }}
                >
                  <span className="text-gray-300 shrink-0 cursor-grab text-xs" title="Drag to reorder">⠿</span>
                  <span className="text-xs text-gray-400 font-mono w-6 shrink-0 text-right">{i + 1}.</span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`truncate text-sm ${
                      p.type === "team" ? "text-purple-800 font-medium" : p.type === "account" ? "text-gray-800" : "text-amber-700"
                    }`}>
                      {p.name}
                    </span>
                    {p.type === "team" && p.members && p.members.length > 0 && expandedTeam !== i && (
                      <span className="text-[11px] text-gray-400 truncate">
                        {p.members.map((m) => m.name).join(", ")}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] uppercase shrink-0 px-2 py-0.5 rounded leading-none ${
                    p.type === "team"
                      ? "bg-purple-50 text-purple-500"
                      : p.type === "account"
                        ? "bg-indigo-50 text-indigo-500"
                        : "bg-amber-50 text-amber-500"
                  }`}>
                    {p.type === "team" ? "team" : p.type === "account" ? "acc" : "guest"}
                  </span>
                  {p.type === "team" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpandedTeam(expandedTeam === i ? null : i); }}
                      className="text-gray-400 hover:text-purple-600 text-xs shrink-0"
                      title={expandedTeam === i ? "Collapse members" : "Edit members"}
                    >
                      {expandedTeam === i ? "▲" : "▼"}
                    </button>
                  )}
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
                        onClick={(e) => { e.stopPropagation(); setConfirmRemove(null); }}
                        className="text-[10px] text-gray-400 hover:text-gray-600"
                      >Cancel</button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeParticipant(i); }}
                        className="text-[10px] text-red-600 hover:text-red-800 font-medium"
                      >Remove?</button>
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

                {/* Expanded team member editor */}
                {p.type === "team" && expandedTeam === i && (
                  <TeamMemberEditor
                    members={p.members ?? []}
                    onAdd={(name, type) => addTeamMember(i, name, type)}
                    onRemove={(mi) => removeTeamMember(i, mi)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Add participants — pinned at bottom */}
          <div className="border-t border-gray-100 pt-3 mt-3 shrink-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
              {teamMode ? "Add teams" : "Add participants"}
            </p>
            <div className="flex flex-col gap-2">
              {teamMode ? (
                <input
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value.replace(",", ""))}
                  onKeyDown={(e) => handleAddKeyDown(e, teamNameInput, setTeamNameInput, "team")}
                  onBlur={() => handleAddBlur(teamNameInput, setTeamNameInput, "team")}
                  placeholder="Team name, press Enter…"
                  className={`${inputClass} w-full text-xs`}
                />
              ) : (
                <>
                  <UserSearchInput
                    onSelect={(username) => addParticipant(username, "account")}
                    placeholder="Search account (username)…"
                    className="w-full"
                    size="sm"
                  />
                  <input
                    value={guestInput}
                    onChange={(e) => setGuestInput(e.target.value.replace(",", ""))}
                    onKeyDown={(e) => handleAddKeyDown(e, guestInput, setGuestInput, "guest")}
                    onBlur={() => handleAddBlur(guestInput, setGuestInput, "guest")}
                    placeholder="Guest (display name)…"
                    className={`${inputClass} w-full text-xs`}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Bracket Preview */}
      <div className="print-bracket bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex flex-col overflow-hidden">
        <h2 className="text-base font-bold text-gray-900 mb-4">Bracket Preview</h2>
        {participants.length < 2 ? (
          <p className="text-sm text-gray-400 italic">Add at least 2 participants to see the bracket.</p>
        ) : (
          <BracketView
            bracket={bracket}
            onSwapParticipants={swapParticipants}
            advancersPerGroup={advancersPerGroup}
            onAdvancersChange={setAdvancersPerGroup}
            autoAdvanceGroups={autoAdvanceGroups}
            onAutoAdvanceGroupsChange={setAutoAdvanceGroups}
            onMoveParticipant={(name, fromGi, toGi) => {
              // Move participant from one group to another by swapping their seeding position
              // This works by reordering the main participants array so generateCombination
              // places them in the target group
              const groups = bracket.groups;
              if (!groups) return;
              const allRegularGroups = groups.filter(g => !g.autoAdvance);
              const groupSize = 4;

              if (toGi >= allRegularGroups.length + autoAdvanceGroups.length) {
                // Moving to auto-advance group
                return;
              }

              // For auto-advance groups, handle separately
              const regularGroupCount = allRegularGroups.length;
              const isFromAuto = fromGi >= regularGroupCount;
              const isToAuto = toGi >= regularGroupCount;

              if (isFromAuto && isToAuto) return; // both auto-advance, no-op

              if (isFromAuto) {
                // Move from auto-advance back to regular: just remove from auto-advance
                // (participant is still in the seeding list)
                const autoIdx = fromGi - regularGroupCount;
                const autoGroup = autoAdvanceGroups[autoIdx];
                const nameIdx = autoGroup.indexOf(name);
                if (nameIdx === -1) return;
                const newAutoGroups = autoAdvanceGroups.map((g, i) => i === autoIdx ? g.filter((_, j) => j !== nameIdx) : g);
                setAutoAdvanceGroups(newAutoGroups.filter(g => g.length > 0));
                return;
              }

              if (isToAuto) {
                // Move from regular group to auto-advance: just add name to auto-advance
                // (participant stays in seeding — generateCombination filters them out of regular groups)
                const autoIdx = toGi - regularGroupCount;
                if (autoIdx < autoAdvanceGroups.length) {
                  setAutoAdvanceGroups(prev => prev.map((g, i) => i === autoIdx ? [...g, name] : g));
                }
                return;
              }

              // Both regular groups: swap participant with the first person in target group
              const pIdx = participants.findIndex(p => p.name === name);
              if (pIdx === -1) return;
              const targetGroup = allRegularGroups[toGi];
              if (!targetGroup || targetGroup.participants.length === 0) return;
              const firstInTarget = targetGroup.participants[0];
              const targetIdx = participants.findIndex(p => p.name === firstInTarget);
              if (targetIdx === -1 || pIdx === targetIdx) return;
              const updated = [...participants];
              [updated[pIdx], updated[targetIdx]] = [updated[targetIdx], updated[pIdx]];
              setParticipants(updated);
            }}
          />
        )}
      </div>

      {/* Error */}
      {submitError && (
        <p className="text-sm text-red-600 mt-4">{submitError}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4 no-print">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          ← Back to form
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={participants.length < 2 || submitting}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating…" : "Confirm & Start Tournament"}
        </button>
      </div>
    </div>
  );
}

// ─── Bracket visualization (format-specific) ─────────────────────────────────

function BracketView({ bracket, onSwapParticipants, advancersPerGroup, onAdvancersChange, autoAdvanceGroups, onAutoAdvanceGroupsChange, onMoveParticipant }: {
  bracket: Bracket;
  onSwapParticipants?: (a: string, b: string) => void;
  advancersPerGroup?: number;
  onAdvancersChange?: (n: number) => void;
  autoAdvanceGroups?: string[][];
  onAutoAdvanceGroupsChange?: (groups: string[][]) => void;
  onMoveParticipant?: (name: string, fromGroupIndex: number, toGroupIndex: number) => void;
}) {
  switch (bracket.format) {
    case "single_elimination":
      return <EliminationBracket rounds={bracket.rounds} onSwapParticipants={onSwapParticipants} />;
    case "double_elimination": {
      // Separate grand final from losers rounds so it renders between the two brackets
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
            />
          </div>
          {losersOnly.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Losers Bracket</h3>
              <EliminationBracket
                rounds={losersOnly}
                onSwapParticipants={onSwapParticipants}
                showOutputConnector={!!grandFinalRound}
              />
            </div>
          )}
        </div>
      );
    }
    case "round_robin":
    case "double_round_robin":
      return <RoundRobinView rounds={bracket.rounds} isDouble={bracket.format === "double_round_robin"} />;
    case "swiss":
      return <SwissView rounds={bracket.rounds} />;
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
        />
      );
  }
}

// ─── Elimination bracket (tree with connector lines) ──────────────────────────

const MATCH_W = 176;   // w-44 = 11rem = 176px
const MATCH_H = 64;    // two rows of ~32px each
const ROUND_GAP = 48;  // horizontal gap between rounds
const CONNECTOR_W = 32; // width of the connector zone between rounds
const COL_W = MATCH_W + ROUND_GAP;

function EliminationBracket({
  rounds,
  onSwapParticipants,
  grandFinal,
  showOutputConnector,
}: {
  rounds: BracketRound[];
  onSwapParticipants?: (a: string, b: string) => void;
  /** Render grand final as an extra column connected to the final match */
  grandFinal?: BracketMatch;
  /** Draw a connector line from the final match to the right edge (for losers bracket feeding grand final) */
  showOutputConnector?: boolean;
}) {
  if (rounds.length === 0) return null;

  // Use totalPositions (full bracket slots) for layout so matches with removed
  // byes are positioned correctly. Falls back to matches.length when unset.
  const firstRoundSlots = rounds[0].totalPositions ?? rounds[0].matches.length;
  const matchGap = 12;
  const totalHeight = firstRoundSlots * MATCH_H + (firstRoundSlots - 1) * matchGap;

  // Get the Y center of a match by its position within the full bracket
  function getMatchYByPosition(totalSlots: number, position: number): number {
    const blockH = totalHeight / totalSlots;
    return blockH * position + blockH / 2;
  }

  function getRoundSlots(ri: number): number {
    return rounds[ri].totalPositions ?? rounds[ri].matches.length;
  }

  const baseSvgWidth = rounds.length * COL_W - ROUND_GAP;
  // Extra column for grand final or output connector
  const hasExtra = !!grandFinal || !!showOutputConnector;
  const svgWidth = hasExtra ? baseSvgWidth + COL_W : baseSvgWidth;
  const svgHeight = totalHeight;

  // Final match position (last round, used for grand final / output connector)
  const lastRi = rounds.length - 1;
  const lastSlots = getRoundSlots(lastRi);
  const lastMatch = rounds[lastRi].matches[0];
  const finalX = lastRi * COL_W + MATCH_W; // right edge of final match
  const finalY = lastMatch ? getMatchYByPosition(lastSlots, lastMatch.position) : svgHeight / 2;

  // Grand final / output connector positions
  const extraX = rounds.length * COL_W; // left edge of extra column
  const extraY = svgHeight / 2; // center vertically

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

            // Determine feed pattern: if previous round has same slot count,
            // it's a 1:1 feed (e.g. losers bracket drop-down rounds).
            // Otherwise it's standard 2:1 elimination feed.
            const is1to1 = prevSlots === currSlots;

            return round.matches.map((match) => {
              const currX = ri * COL_W;
              const currY = getMatchYByPosition(currSlots, match.position);
              const prevX = prevRi * COL_W + MATCH_W;

              const lines: React.ReactNode[] = [];

              if (is1to1) {
                // 1:1 feed — straight horizontal connector from same position
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
                // 2:1 feed — two matches converge into one
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
                <MatchCard match={match} onSwapParticipants={onSwapParticipants} />
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
            <MatchCard match={grandFinal} />
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match, onSwapParticipants }: { match: BracketMatch; onSwapParticipants?: (a: string, b: string) => void }) {
  const [dropTarget, setDropTarget] = useState<"a" | "b" | null>(null);

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

  /** Render participant name; hide "TBD" in print */
  function renderName(name: string | null | undefined) {
    if (!name || name === "TBD") return <span className="print-hide-tbd text-gray-300 italic">TBD</span>;
    return <>{name}</>;
  }

  const canDrag = !!onSwapParticipants;
  const wbA = match.wbDropDown === "a" || match.wbDropDown === "both";
  const wbB = match.wbDropDown === "b" || match.wbDropDown === "both";

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm bg-white">
      <div
        draggable={!!match.participantA && canDrag}
        onDragStart={(e) => match.participantA && handleDragStart(e, match.participantA)}
        onDragOver={(e) => match.participantA && handleDragOver(e, "a")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, match.participantA)}
        className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 transition-colors ${
          dropTarget === "a" ? "bg-indigo-50" : wbA ? "bg-amber-50/60" : "bg-gray-50"
        } ${match.participantA && canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${!match.participantA || match.participantA === "TBD" ? "print-tbd-row" : ""}`}
      >
        {wbA && <span className="text-[9px] text-amber-500 font-semibold shrink-0" title="From Winners Bracket">WB</span>}
        <span className={match.participantA && match.participantA !== "TBD" ? "text-gray-800" : "text-gray-300 italic"}>
          {renderName(match.participantA)}
        </span>
      </div>
      <div
        draggable={!!match.participantB && canDrag}
        onDragStart={(e) => match.participantB && handleDragStart(e, match.participantB)}
        onDragOver={(e) => match.participantB && handleDragOver(e, "b")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, match.participantB)}
        className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
          dropTarget === "b" ? "bg-indigo-50" : wbB ? "bg-amber-50/60" : ""
        } ${match.participantB && canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${!match.participantB || match.participantB === "TBD" ? "print-tbd-row" : ""}`}
      >
        {wbB && <span className="text-[9px] text-amber-500 font-semibold shrink-0" title="From Winners Bracket">WB</span>}
        <span className={match.participantB && match.participantB !== "TBD" ? "text-gray-800" : "text-gray-300 italic"}>
          {renderName(match.participantB)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Matchup list — full width underneath */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Matchups</div>
        <div className="max-h-80 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
            {rounds.map((round) => (
              <div key={round.name} className="mb-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-2 mb-1">{round.name}</div>
                <div className="space-y-1">
                  {round.matches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center text-xs border border-gray-100 rounded px-2.5 py-1.5"
                    >
                      <span className={`flex-1 text-gray-800 truncate ${!match.participantA || match.participantA === "TBD" ? "print-tbd-row" : ""}`}>{!match.participantA || match.participantA === "TBD" ? <span className="print-hide-tbd text-gray-300 italic">TBD</span> : match.participantA}</span>
                      <span className="px-2 text-gray-400">vs</span>
                      <span className={`flex-1 text-gray-800 truncate text-right ${!match.participantB || match.participantB === "TBD" ? "print-tbd-row" : ""}`}>{!match.participantB || match.participantB === "TBD" ? <span className="print-hide-tbd text-gray-300 italic">TBD</span> : match.participantB}</span>
                    </div>
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

function SwissView({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((round, ri) => (
        <div key={ri}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{round.name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {round.matches.map((match) => (
              <div key={match.id} className="flex items-center border border-gray-200 rounded-lg text-sm overflow-hidden">
                <span className={`flex-1 px-3 py-2 text-gray-800 bg-gray-50 ${!match.participantA || match.participantA === "TBD" ? "print-tbd-row" : ""}`}>
                  {!match.participantA || match.participantA === "TBD" ? <span className="text-gray-300 italic print-hide-tbd">TBD</span> : match.participantA}
                </span>
                <span className="px-2 text-xs text-gray-400">vs</span>
                <span className={`flex-1 px-3 py-2 text-gray-800 text-right ${!match.participantB || match.participantB === "TBD" ? "print-tbd-row" : ""}`}>
                  {!match.participantB || match.participantB === "TBD" ? <span className="text-gray-300 italic print-hide-tbd">TBD</span> : match.participantB}
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

function CombinationView({
  bracket,
  onSwapParticipants,
  advancersPerGroup = 2,
  onAdvancersChange,
  autoAdvanceGroups = [],
  onAutoAdvanceGroupsChange,
  onMoveParticipant,
}: {
  bracket: Bracket;
  onSwapParticipants?: (a: string, b: string) => void;
  advancersPerGroup?: number;
  onAdvancersChange?: (n: number) => void;
  autoAdvanceGroups?: string[][];
  onAutoAdvanceGroupsChange?: (groups: string[][]) => void;
  onMoveParticipant?: (name: string, fromGroupIndex: number, toGroupIndex: number) => void;
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
      // Involves auto-advance group: delegate to move handler
      if (onMoveParticipant) {
        onMoveParticipant(sourceName, fromGroup, targetGroupIndex);
      }
    } else {
      // Both regular groups (same or different): swap the two specific participants
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

  // Compute max advancers (smallest regular group size)
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
                    <div className="text-xs text-gray-500">
                      {group.rounds.length} round{group.rounds.length !== 1 ? "s" : ""},{" "}
                      {group.rounds.reduce((sum, r) => sum + r.matches.length, 0)} matches
                      {` · top ${advancersPerGroup} advance`}
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
          <EliminationBracket rounds={bracket.knockoutRounds} />
        </div>
      )}
    </div>
  );
}

// ─── Inline team member editor (shown expanded in seeding list) ─────────────

function TeamMemberEditor({
  members,
  onAdd,
  onRemove,
}: {
  members: { name: string; type: "account" | "guest" }[];
  onAdd: (name: string, type: "account" | "guest") => void;
  onRemove: (memberIndex: number) => void;
}) {
  const [input, setInput] = useState("");
  const [memberType, setMemberType] = useState<"account" | "guest">("account");

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) {
        onAdd(input.trim(), memberType);
        setInput("");
      }
    }
  }

  function handleBlur() {
    if (input.trim()) {
      onAdd(input.trim(), memberType);
      setInput("");
    }
  }

  return (
    <div className="border border-gray-200 border-t-0 rounded-b-lg bg-gray-50 px-4 py-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Team members</p>

      {members.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {members.map((m, mi) => (
            <span
              key={mi}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                m.type === "account" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {m.name}
              <button
                type="button"
                onClick={() => onRemove(mi)}
                className="leading-none text-current opacity-50 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <select
          value={memberType}
          onChange={(e) => setMemberType(e.target.value as "account" | "guest")}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="account">Account</option>
          <option value="guest">Guest</option>
        </select>
        {memberType === "account" ? (
          <UserSearchInput
            onSelect={(username) => { onAdd(username, "account"); }}
            placeholder="Search username…"
            className="flex-1"
            size="sm"
          />
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.replace(",", ""))}
            onKeyDown={handleKey}
            onBlur={handleBlur}
            placeholder="Display name…"
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        )}
      </div>
    </div>
  );
}
