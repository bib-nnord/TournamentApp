"use client";

import { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  CUSTOM_DISCIPLINE_VALUE,
  disciplineValueToLabel,
  labelToDisciplineValue,
} from "@/constants/disciplines";
import {
  LABEL_CONFIRM_START,
} from "@/constants/labels";
import { generateBracket } from "@/lib/generateBracket";

import type { RootState } from "@/store/store";
import { tournamentFormatInfo, type TournamentFormat, type TournamentStatus } from "@/types";
import BracketView from "../BracketView";
import type { QuickTournamentData, Participant } from "../QuickTournamentForm";

import type { TournamentPreviewProps } from "./types";

export default function TournamentPreview({ data, onConfirm, submitting, submitError, onChange }: TournamentPreviewProps) {
  useSelector((state: RootState) => state.user.current);
  const [name] = useState(data.name);
  const [disciplineChoice] = useState(() => {
    const saved = (data.discipline ?? (data as any).game ?? "").trim();
    if (!saved) return "";
    const value = labelToDisciplineValue(saved);
    return value ?? CUSTOM_DISCIPLINE_VALUE;
  });
  const [customDiscipline] = useState(() => {
    const saved = (data.discipline ?? (data as any).game ?? "").trim();
    if (!saved) return "";
    const value = labelToDisciplineValue(saved);
    return value ? "" : saved;
  });
  const discipline = disciplineChoice === CUSTOM_DISCIPLINE_VALUE
    ? customDiscipline.trim()
    : disciplineValueToLabel(disciplineChoice);
  const [description] = useState(data.description);
  const [format] = useState<TournamentFormat>(data.format);
  const [isPrivate] = useState(data.isPrivate);
  const [status] = useState<TournamentStatus>(
    data.status ?? "active"
  );
  const [participants, setParticipants] = useState<Participant[]>(data.participants);

  // Sync participants when the parent passes updated data
  useEffect(() => {
    setParticipants(data.participants);
  }, [data.participants]);

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
