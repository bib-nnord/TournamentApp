"use client";

import { useState, useEffect, useRef } from "react";
import { tournamentFormatInfo, type TournamentFormat, type TournamentRegistrationMode } from "@/types";
import { apiFetch } from "@/lib/api";
import { inputClass, labelClass, ToggleSwitch, FormSection } from "../FormPrimitives";
import UserSearchInput from "../UserSearchInput";
import type { ScheduledTournamentData, ScheduledInvite } from "./types";

export type { ScheduledTournamentData, ScheduledInvite };

interface Props {
  initial?: Partial<ScheduledTournamentData>;
  onSubmit: (data: ScheduledTournamentData) => void;
  onChange?: (data: ScheduledTournamentData) => void;
  submitting?: boolean;
  submitError?: string | null;
}

const formats = Object.entries(tournamentFormatInfo) as [TournamentFormat, { label: string; description: string }][];

const registrationModeInfo: Record<TournamentRegistrationMode, { label: string; description: string }> = {
  invite_only: { label: "Invite Only", description: "Only invited participants can join" },
  open: { label: "Open", description: "Anyone with a link can join" },
  approval: { label: "Approval", description: "Players request to join, you approve" },
};

interface TeamSearchResult {
  id: number;
  name: string;
  description: string | null;
  members: { userId: number; username: string; displayName: string | null; role: string }[];
}

export default function ScheduledTournamentForm({ initial, onSubmit, onChange, submitting, submitError }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [game, setGame] = useState(initial?.game ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [format, setFormat] = useState<TournamentFormat>(initial?.format ?? "single_elimination");
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [teamMode, setTeamMode] = useState(initial?.teamMode ?? false);
  const [registrationMode, setRegistrationMode] = useState<TournamentRegistrationMode>(initial?.registrationMode ?? "open");
  const [maxParticipants, setMaxParticipants] = useState<string>(
    initial?.maxParticipants != null ? String(initial.maxParticipants) : "16"
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [registrationClosesAt, setRegistrationClosesAt] = useState(initial?.registrationClosesAt ?? "");
  const [invites, setInvites] = useState<ScheduledInvite[]>(initial?.invites ?? []);

  // Team search for invites
  const [teamSearch, setTeamSearch] = useState("");
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [teamSearching, setTeamSearching] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamSearchRef = useRef<HTMLDivElement>(null);

  // When private is toggled on, force invite_only
  useEffect(() => {
    if (isPrivate) setRegistrationMode("invite_only");
  }, [isPrivate]);

  // In regular mode, keep invites account-only.
  useEffect(() => {
    if (!teamMode) {
      setInvites((prev) => prev.filter((i) => i.type !== "team"));
    }
  }, [teamMode]);

  // Team search debounce
  useEffect(() => {
    if (!teamSearch.trim()) {
      setTeamResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setTeamSearching(true);
      try {
        const res = await apiFetch(`/teams/search?q=${encodeURIComponent(teamSearch.trim())}&limit=8`);
        if (res.ok) {
          const data: TeamSearchResult[] = await res.json();
          const existingIds = new Set(invites.filter((i) => i.type === "team" && i.teamId).map((i) => i.teamId));
          setTeamResults(data.filter((t) => !existingIds.has(t.id)));
        }
      } catch { /* ignore */ } finally {
        setTeamSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [teamSearch, invites]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (teamSearchRef.current && !teamSearchRef.current.contains(e.target as Node)) {
        setShowTeamDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (!onChange) return;
    const timer = setTimeout(() => {
      onChange(buildData());
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, game, description, format, isPrivate, teamMode, registrationMode, maxParticipants, startDate, registrationClosesAt, invites]);

  function buildData(): ScheduledTournamentData {
    return {
      name,
      game,
      description,
      format,
      isPrivate,
      teamMode,
      registrationMode,
      maxParticipants: maxParticipants.trim() ? parseInt(maxParticipants, 10) : null,
      startDate,
      registrationClosesAt,
      invites,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(buildData());
  }

  function addAccountInvite(username: string) {
    const already = invites.some(
      (i) => i.type === "account" && i.username?.toLowerCase() === username.toLowerCase()
    );
    if (already) return;
    setInvites((prev) => [...prev, { type: "account", username, displayName: username }]);
  }

  function addTeamInvite(team: TeamSearchResult) {
    setInvites((prev) => [
      ...prev,
      { type: "team", teamId: team.id, displayName: team.name },
    ]);
    setTeamSearch("");
    setShowTeamDropdown(false);
  }

  function removeInvite(index: number) {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  }

  const canSubmit = name.trim() && game.trim();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormSection label="Tournament name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Spring Championship 2026"
          className={inputClass}
        />
      </FormSection>

      <FormSection label="Game / Discipline">
        <input
          value={game}
          onChange={(e) => setGame(e.target.value)}
          required
          placeholder="e.g. Chess, Rocket League"
          className={inputClass}
        />
      </FormSection>

      <FormSection label="Description" optional>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the format, rules, prizes…"
          className={`${inputClass} resize-none`}
        />
      </FormSection>

      <FormSection label="Tournament format">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as TournamentFormat)}
          className={inputClass}
        >
          {formats.map(([key, { label, description: desc }]) => (
            <option key={key} value={key}>
              {label} — {desc}
            </option>
          ))}
        </select>
      </FormSection>

      <ToggleSwitch
        checked={isPrivate}
        onChange={setIsPrivate}
        label="Private tournament"
        hint="only visible to you and invited participants"
        activeColor="bg-gray-700"
      />

      <ToggleSwitch
        checked={teamMode}
        onChange={setTeamMode}
        label="Team mode"
        hint="teams are the main competitors; invite teams and users, then finalize team assignments"
        activeColor="bg-purple-600"
      />

      {/* Registration mode (hidden when private since it's forced to invite_only) */}
      {!isPrivate && (
        <FormSection label="Registration mode">
          <select
            value={registrationMode}
            onChange={(e) => setRegistrationMode(e.target.value as TournamentRegistrationMode)}
            className={inputClass}
          >
            {(Object.entries(registrationModeInfo) as [TournamentRegistrationMode, { label: string; description: string }][]).map(
              ([key, { label, description: desc }]) => (
                <option key={key} value={key}>
                  {label} — {desc}
                </option>
              )
            )}
          </select>
        </FormSection>
      )}

      <FormSection label={teamMode ? "Max teams" : "Max participants"}>
        <input
          type="number"
          min={2}
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-400">
          {teamMode ? "Limits the bracket to 16 teams by default." : "Limits the bracket to 16 participants by default."}
        </p>
      </FormSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormSection label="Registration closes" optional>
          <input
            type="datetime-local"
            value={registrationClosesAt}
            onChange={(e) => setRegistrationClosesAt(e.target.value)}
            className={inputClass}
          />
        </FormSection>

        <FormSection label="Start date" optional>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </FormSection>
      </div>

      {/* Invites */}
      <div>
        <label className={labelClass}>
          Invite participants{" "}
          <span className="normal-case text-gray-300">
            {teamMode
              ? "(optional — invite teams and users, then refine assignments before start)"
              : "(optional — you can invite more later)"}
          </span>
        </label>

        {invites.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {invites.map((inv, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                  inv.type === "team" ? "bg-purple-50 text-purple-700" : "bg-indigo-50 text-indigo-700"
                }`}
              >
                {inv.displayName}
                <button
                  type="button"
                  onClick={() => removeInvite(i)}
                  className="leading-none text-current opacity-50 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {/* Account invite search */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-gray-400 w-14 shrink-0">Account</span>
            <UserSearchInput
              onSelect={addAccountInvite}
              placeholder="Search username…"
              className="flex-1"
              size="sm"
            />
          </div>

          {/* Team invite search – available only in team mode */}
          {teamMode && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-gray-400 w-14 shrink-0">Team</span>
              <div ref={teamSearchRef} className="relative flex-1">
                <input
                  value={teamSearch}
                  onChange={(e) => {
                    setTeamSearch(e.target.value);
                    setShowTeamDropdown(true);
                  }}
                  onFocus={() => setShowTeamDropdown(true)}
                  placeholder="Search existing teams…"
                  className={`${inputClass} text-xs`}
                />
                {showTeamDropdown && teamSearch.trim() && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {teamSearching ? (
                      <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>
                    ) : teamResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">No teams found</div>
                    ) : (
                      teamResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => addTeamInvite(t)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <span className="text-sm font-medium text-gray-800">{t.name}</span>
                          {t.members.length > 0 && (
                            <span className="block text-[11px] text-gray-400 truncate">
                              {t.members.map((m) => m.displayName || m.username).join(", ")}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-2 w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "Creating…" : "Create Scheduled Tournament"}
      </button>
    </form>
  );
}
