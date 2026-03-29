"use client";

import { useState, useMemo, useRef, useEffect, type KeyboardEvent } from "react";
import { useSelector } from "react-redux";
import {
  CUSTOM_DISCIPLINE_VALUE,
  DISCIPLINE_OPTIONS,
  disciplineValueToLabel,
  labelToDisciplineValue,
} from "@/constants/disciplines";
import {
  LABEL_CONFIRM_START,
  LABEL_SHUFFLE,
  LABEL_REMOVE_QUESTION,
} from "@/constants/labels";
import { generateBracket } from "@/lib/generateBracket";
import { shuffleArray, generateUniqueName } from "@/lib/helpers";
import type { RootState } from "@/store/store";
import { tournamentFormatInfo, tournamentStatusLabel, type TournamentFormat, type TournamentStatus } from "@/types";
import BracketView from "../BracketView";
import type { QuickTournamentData, Participant } from "../QuickTournamentForm";
import type { ParticipantMemberType, ParticipantMember } from "../QuickTournamentForm/types";
import UserSearchInput from "../UserSearchInput";
import type { TournamentPreviewProps } from "./types";

export default function TournamentPreview({ data, onConfirm, submitting, submitError, onChange }: TournamentPreviewProps) {
  const currentUser = useSelector((state: RootState) => state.user.current);
  const [name, setName] = useState(data.name);
  const [disciplineChoice, setDisciplineChoice] = useState(() => {
    const saved = (data.discipline ?? (data as any).game ?? "").trim();
    if (!saved) return "";
    const value = labelToDisciplineValue(saved);
    return value ?? CUSTOM_DISCIPLINE_VALUE;
  });
  const [customDiscipline, setCustomDiscipline] = useState(() => {
    const saved = (data.discipline ?? (data as any).game ?? "").trim();
    if (!saved) return "";
    const value = labelToDisciplineValue(saved);
    return value ? "" : saved;
  });
  const discipline = disciplineChoice === CUSTOM_DISCIPLINE_VALUE
    ? customDiscipline.trim()
    : disciplineValueToLabel(disciplineChoice);
  const [description, setDescription] = useState(data.description);
  const [format, setFormat] = useState<TournamentFormat>(data.format);
  const [isPrivate] = useState(data.isPrivate);
  const [status, setStatus] = useState<TournamentStatus>(data.status ?? "active");
  const [participants, setParticipants] = useState<Participant[]>(data.participants);

  // Combination format options
  const [advancersPerGroup, setAdvancersPerGroup] = useState(data.advancersPerGroup ?? 2);
  const [autoAdvanceGroups, setAutoAdvanceGroups] = useState<string[][]>([]);

  
  // Call onChange on any relevant state change
  useEffect(() => {
    if (!onChange) return;
    const discipline = disciplineChoice === CUSTOM_DISCIPLINE_VALUE
      ? customDiscipline.trim()
      : disciplineValueToLabel(disciplineChoice);
    onChange({
      ...data,
      name,
      discipline,
      description,
      format,
      isPrivate,
      status,
      participants,
      advancersPerGroup,
    });
  }, [name, disciplineChoice, customDiscipline, description, format, isPrivate, status, participants, advancersPerGroup]);

  const participantNames = participants.map((p) => p.name);


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
    setParticipants(shuffleArray(participants));
  }

  // ─── Live add / remove participants ───────────────────────────────────────
  const [guestInput, setGuestInput] = useState("");
  const teamMode = data.teamMode;
  const [teamNameInput, setTeamNameInput] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  function addParticipant(name: string, type: ParticipantMemberType | "team") {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Prevent adding the same account twice
    if (type === "account") {
      const alreadyAdded = participants.some(
        (p) => p.type === "account" && (p.accountName ?? p.name).toLowerCase() === trimmed.toLowerCase()
      );
      if (alreadyAdded) return;
    }

    const finalName = generateUniqueName(trimmed, participantNames);
    if (!finalName) return;
    setParticipants((prev) => [...prev, {
      name: finalName,
      type,
      ...(type === "account" ? { accountName: trimmed } : {}),
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
    type: ParticipantMemberType | "team"
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
  function addTeamMember(participantIndex: number, memberName: string, memberType: ParticipantMemberType) {
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
    const updatedData: QuickTournamentData = { ...data, name, discipline, description, format, isPrivate, participants, advancersPerGroup, status };
    onConfirm(updatedData, { ...bracket, allowTies: updatedData.allowTies !== false });
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
          <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Discipline</dt><dd className="text-gray-900 font-medium">{discipline || "—"}</dd></div>
          {description && <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Description</dt><dd className="text-gray-700">{description}</dd></div>}
          <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Format</dt><dd className="text-gray-900 font-medium">{tournamentFormatInfo[format]?.label ?? format}</dd></div>
          <div><dt className="text-xs text-gray-400 uppercase tracking-wide">Participants</dt><dd className="text-gray-900 font-medium">{participants.length}</dd></div>
        </dl>
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
          onClick={handleConfirm}
          disabled={participants.length < 2 || submitting}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating…" : LABEL_CONFIRM_START}
        </button>
      </div>
    </div>
  );
}

// ─── Inline team member editor (shown expanded in seeding list) ─────────────

function TeamMemberEditor({
  members,
  onAdd,
  onRemove,
}: {
  members: ParticipantMember[];
  onAdd: (name: string, type: ParticipantMemberType) => void;
  onRemove: (memberIndex: number) => void;
}) {
  const [input, setInput] = useState("");
  const [memberType, setMemberType] = useState<ParticipantMemberType>("account");

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
          onChange={(e) => setMemberType(e.target.value as ParticipantMemberType)}
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
