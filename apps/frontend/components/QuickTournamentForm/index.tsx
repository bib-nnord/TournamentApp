"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { tournamentFormatInfo, type TournamentFormat } from "@/types";
import { apiFetch } from "@/lib/api";
import UserSearchInput from "../UserSearchInput";
import type { Participant, TeamSearchResult, QuickTournamentData } from "./types";

export type { Participant, QuickTournamentData };

interface Props {
  initial?: QuickTournamentData;
  onSubmit: (data: QuickTournamentData) => void;
  /** Called on every meaningful state change so the parent can persist the draft */
  onChange?: (data: QuickTournamentData) => void;
}

const formats = Object.entries(tournamentFormatInfo) as [TournamentFormat, { label: string; description: string }][];

export default function QuickTournamentForm({ initial, onSubmit, onChange }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [game, setGame] = useState(initial?.game ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [format, setFormat] = useState<TournamentFormat>(initial?.format ?? "single_elimination");
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [teamMode, setTeamMode] = useState(initial?.teamMode ?? false);

  const [accounts, setAccounts] = useState<string[]>(
    () => initial?.participants.filter((p) => p.type === "account").map((p) => p.name) ?? []
  );
  const [guests, setGuests] = useState<string[]>(
    () => initial?.participants.filter((p) => p.type === "guest").map((p) => p.name) ?? []
  );
  const [accountInput, setAccountInput] = useState("");
  const [guestInput, setGuestInput] = useState("");

  // Teams
  const [teams, setTeams] = useState<{ name: string; members: { name: string; type: "account" | "guest" }[]; existingTeamId?: number }[]>(
    () => initial?.participants.filter((p) => p.type === "team").map((p) => ({
      name: p.name,
      members: p.members ?? [],
      existingTeamId: p.existingTeamId,
    })) ?? []
  );

  // Team search
  const [teamSearch, setTeamSearch] = useState("");
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [teamSearching, setTeamSearching] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamSearchRef = useRef<HTMLDivElement>(null);

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
          // Filter out teams already added
          const existingIds = new Set(teams.filter((t) => t.existingTeamId).map((t) => t.existingTeamId));
          setTeamResults(data.filter((t) => !existingIds.has(t.id)));
        }
      } catch {
        /* ignore */
      } finally {
        setTeamSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [teamSearch, teams]);

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

  function addExistingTeam(team: TeamSearchResult) {
    setTeams((prev) => [
      ...prev,
      {
        name: team.name,
        existingTeamId: team.id,
        members: team.members.map((m) => ({
          name: m.displayName || m.username,
          type: "account" as const,
        })),
      },
    ]);
    setTeamSearch("");
    setShowTeamDropdown(false);
  }

  const totalCompetitors = teamMode
    ? teams.filter((t) => t.name.trim()).length
    : accounts.length + guests.length;
  const allNames = teamMode
    ? teams.map((t) => t.name)
    : [...accounts, ...guests];

  // ─── Auto-save draft (debounced) ──────────────────────────────────────
  useEffect(() => {
    if (!onChange) return;
    const timer = setTimeout(() => {
      const participants: Participant[] = teamMode
        ? teams.filter((t) => t.name.trim()).map((t) => ({
            name: t.name,
            type: "team" as const,
            members: t.members,
            existingTeamId: t.existingTeamId,
          }))
        : [
            ...accounts.map((n) => ({ name: n, type: "account" as const })),
            ...guests.map((n) => ({ name: n, type: "guest" as const })),
          ];
      onChange({ name, game, description, format, participants, isPrivate, teamMode });
    }, 500);
    return () => clearTimeout(timer);
  }, [name, game, description, format, isPrivate, teamMode, accounts, guests, teams, onChange]);

  function addTag(value: string, setList: React.Dispatch<React.SetStateAction<string[]>>) {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Allow duplicates — auto-number with (2), (3), etc.
    let finalName = trimmed;
    if (allNames.includes(trimmed)) {
      let n = 2;
      while (allNames.includes(`${trimmed} (${n})`)) n++;
      finalName = `${trimmed} (${n})`;
    }
    setList((prev) => [...prev, finalName]);
  }

  function removeTag(index: number, setList: React.Dispatch<React.SetStateAction<string[]>>) {
    setList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input, setList);
      setInput("");
    }
    if (e.key === "Backspace" && input === "" && list.length > 0) {
      setList((prev) => prev.slice(0, -1));
    }
  }

  function handleBlur(
    input: string,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    if (input.trim()) {
      addTag(input, setList);
      setInput("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (totalCompetitors < 2) return;
    const participants: Participant[] = teamMode
      ? teams.filter((t) => t.name.trim()).map((t) => ({
          name: t.name,
          type: "team" as const,
          members: t.members,
          existingTeamId: t.existingTeamId,
        }))
      : [
          ...accounts.map((n) => ({ name: n, type: "account" as const })),
          ...guests.map((n) => ({ name: n, type: "guest" as const })),
        ];
    onSubmit({ name, game, description, format, participants, isPrivate, teamMode });
  }

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const labelClass = "block text-xs text-gray-400 uppercase tracking-wide mb-1";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClass}>Tournament name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Friday Night Showdown"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Game / Discipline</label>
        <input
          value={game}
          onChange={(e) => setGame(e.target.value)}
          required
          placeholder="e.g. Chess, Rocket League"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          Description <span className="normal-case text-gray-300">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the format, rules, prizes…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className={labelClass}>Tournament format</label>
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
      </div>

      {/* Team mode toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={teamMode}
          onClick={() => setTeamMode((v) => !v)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            teamMode ? "bg-purple-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              teamMode ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm text-gray-700">
          Team mode{" "}
          <span className="text-gray-400">— teams compete instead of individuals</span>
        </span>
      </div>

      {/* Participants */}
      {teamMode ? (
        /* ── Team mode ── */
        <div>
          <label className={labelClass}>
            Teams{" "}
            <span className="normal-case text-gray-300">
              (each team is one competitor in the bracket)
            </span>
          </label>

          {/* Search existing teams */}
          <div ref={teamSearchRef} className="relative mb-3">
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
                      onClick={() => addExistingTeam(t)}
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

          <div className="flex flex-col gap-2 mb-2">
            {teams.map((team, ti) => (
              <TeamCard
                key={ti}
                team={team}
                onUpdateName={(n) => setTeams((prev) => prev.map((t, i) => (i === ti ? { ...t, name: n } : t)))}
                onAddMember={(n, type) =>
                  setTeams((prev) =>
                    prev.map((t, i) =>
                      i === ti ? { ...t, members: [...t.members, { name: n, type }] } : t
                    )
                  )
                }
                onRemoveMember={(mi) =>
                  setTeams((prev) =>
                    prev.map((t, i) =>
                      i === ti ? { ...t, members: t.members.filter((_, j) => j !== mi) } : t
                    )
                  )
                }
                onRemoveTeam={() => setTeams((prev) => prev.filter((_, i) => i !== ti))}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTeams((prev) => [...prev, { name: "", members: [] }])}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Add team
          </button>
        </div>
      ) : (
        /* ── Individual mode ── */
        <>
          {/* Accounts */}
          <div>
            <label className={labelClass}>
              Accounts{" "}
              <span className="normal-case text-gray-300">
                (registered users — search by username)
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-400 min-h-[42px]">
              {accounts.map((t, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-indigo-50 text-indigo-700"
                >
                  {t}
                  <button type="button" onClick={() => removeTag(i, setAccounts)} className="leading-none text-indigo-400 hover:text-indigo-700">
                    ×
                  </button>
                </span>
              ))}
              <UserSearchInput
                onSelect={(username) => addTag(username, setAccounts)}
                placeholder={accounts.length === 0 ? "Search username…" : ""}
                className="flex-1 min-w-[140px]"
              />
            </div>
          </div>

          {/* Guests */}
          <div>
            <label className={labelClass}>
              Guests{" "}
              <span className="normal-case text-gray-300">
                (no account — just a display name)
              </span>
            </label>
            <TagInput
              id="guest-input"
              tags={guests}
              input={guestInput}
              setInput={setGuestInput}
              onKeyDown={(e) => handleKeyDown(e, guestInput, setGuestInput, guests, setGuests)}
              onBlur={() => handleBlur(guestInput, setGuestInput, setGuests)}
              onRemove={(i) => removeTag(i, setGuests)}
              placeholder="Type a display name, press Enter…"
              chipColor="bg-amber-50 text-amber-700"
              chipClose="text-amber-400 hover:text-amber-700"
            />
          </div>
        </>
      )}

      <div className="text-xs text-gray-400">
        {totalCompetitors} competitor{totalCompetitors !== 1 ? "s" : ""} total — minimum 2 to continue
      </div>

      <button
        type="submit"
        disabled={totalCompetitors < 2}
        className="mt-2 w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Generate Bracket →
      </button>
    </form>
  );
}

// ─── Reusable tag input ───────────────────────────────────────────────────────

function TagInput({
  id,
  tags,
  input,
  setInput,
  onKeyDown,
  onBlur,
  onRemove,
  placeholder,
  chipColor,
  chipClose,
}: {
  id: string;
  tags: string[];
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onRemove: (i: number) => void;
  placeholder: string;
  chipColor: string;
  chipClose: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-400 min-h-[42px] cursor-text"
      onClick={() => document.getElementById(id)?.focus()}
    >
      {tags.map((t, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${chipColor}`}
        >
          {t}
          <button type="button" onClick={() => onRemove(i)} className={`leading-none ${chipClose}`}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={input}
        onChange={(e) => setInput(e.target.value.replace(",", ""))}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] text-sm text-gray-800 outline-none bg-transparent py-1"
      />
    </div>
  );
}

// ─── Team card ────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  onUpdateName,
  onAddMember,
  onRemoveMember,
  onRemoveTeam,
}: {
  team: { name: string; members: { name: string; type: "account" | "guest" }[]; existingTeamId?: number };
  onUpdateName: (name: string) => void;
  onAddMember: (name: string, type: "account" | "guest") => void;
  onRemoveMember: (memberIndex: number) => void;
  onRemoveTeam: () => void;
}) {
  const [memberInput, setMemberInput] = useState("");
  const [memberType, setMemberType] = useState<"account" | "guest">("account");

  function handleMemberKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (memberInput.trim()) {
        onAddMember(memberInput.trim(), memberType);
        setMemberInput("");
      }
    }
  }

  function handleMemberBlur() {
    if (memberInput.trim()) {
      onAddMember(memberInput.trim(), memberType);
      setMemberInput("");
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        {team.existingTeamId ? (
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-gray-800 font-medium">{team.name}</span>
            <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium uppercase">
              existing
            </span>
          </div>
        ) : (
          <input
            value={team.name}
            onChange={(e) => onUpdateName(e.target.value)}
            placeholder="Team name…"
            required
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        )}
        <button
          type="button"
          onClick={onRemoveTeam}
          className="text-gray-300 hover:text-red-500 text-lg leading-none shrink-0"
          title="Remove team"
        >
          ×
        </button>
      </div>

      {team.members.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {team.members.map((m, mi) => (
            <span
              key={mi}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                m.type === "account" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {m.name}
              <button
                type="button"
                onClick={() => onRemoveMember(mi)}
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
            onSelect={(username) => { onAddMember(username, "account"); }}
            placeholder="Search username…"
            className="flex-1"
            size="sm"
          />
        ) : (
          <input
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value.replace(",", ""))}
            onKeyDown={handleMemberKey}
            onBlur={handleMemberBlur}
            placeholder="Display name…"
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        )}
      </div>
    </div>
  );
}
