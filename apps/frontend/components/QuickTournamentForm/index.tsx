"use client";

import { useState, useEffect, useRef } from "react";
import {
  CUSTOM_DISCIPLINE_VALUE,
  DISCIPLINE_OPTIONS,
  disciplineValueToLabel,
  labelToDisciplineValue,
} from "@/constants/disciplines";
import {
  LABEL_ADD_TEAM,
  LABEL_GENERATE_BRACKET,
} from "@/constants/labels";
import { useTagInput } from "@/hooks/useTagInput";
import { apiFetch } from "@/lib/api";
import { tournamentFormatInfo, type TournamentFormat } from "@/types";
import TournamentFormatMiniPreview from "../TournamentFormatMiniPreview";
import UserSearchInput from "../UserSearchInput";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Trophy, Gamepad2, Users, Shield, FileText, UserPlus, X } from "lucide-react";
import type { Participant, ParticipantMemberType, TournamentTeam, TeamSearchResult, QuickTournamentData } from "./types";

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
  const [disciplineChoice, setDisciplineChoice] = useState(() => {
    const saved = (initial?.discipline ?? (initial as any)?.game ?? "").trim();
    if (!saved) return "";
    const value = labelToDisciplineValue(saved);
    return value ?? CUSTOM_DISCIPLINE_VALUE;
  });
  const [customDiscipline, setCustomDiscipline] = useState(() => {
    const saved = (initial?.discipline ?? (initial as any)?.game ?? "").trim();
    if (!saved) return "";
    const value = labelToDisciplineValue(saved);
    return value ? "" : saved;
  });
  const [description, setDescription] = useState(initial?.description ?? "");
  const [format, setFormat] = useState<TournamentFormat>(initial?.format ?? "single_elimination");
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [teamMode, setTeamMode] = useState(initial?.teamMode ?? false);
  const [allowTies, setAllowTies] = useState(initial?.allowTies !== false);

  const [accounts, setAccounts] = useState<string[]>(
    () => initial?.participants.filter((p) => p.type === "account").map((p) => p.name) ?? []
  );
  const [guests, setGuests] = useState<string[]>(
    () => initial?.participants.filter((p) => p.type === "guest").map((p) => p.name) ?? []
  );

  // Teams
  const [teams, setTeams] = useState<TournamentTeam[]>(
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

  const { addTag, removeTag } = useTagInput(allNames);
  const discipline = disciplineChoice === CUSTOM_DISCIPLINE_VALUE
    ? customDiscipline.trim()
    : disciplineValueToLabel(disciplineChoice);

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
      onChange({ name, discipline, description, format, participants, isPrivate, teamMode, allowTies });
    }, 500);
    return () => clearTimeout(timer);
  }, [name, discipline, description, format, isPrivate, teamMode, allowTies, accounts, guests, teams, onChange]);

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
    onSubmit({ name, discipline, description, format, participants, isPrivate, teamMode, allowTies });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Tournament Name – Hero Input */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="w-5 h-5" />
            <Label className="text-base font-semibold">
              Tournament Name <span className="text-destructive">*</span>
            </Label>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Friday Night Showdown"
            className="text-lg h-12 bg-white/80 border-primary/30"
          />
        </div>
      </Card>

      {/* Discipline & Format – 2-column grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">
                Discipline <span className="text-destructive">*</span>
              </Label>
            </div>
            <Select
              value={disciplineChoice}
              onValueChange={setDisciplineChoice}
              required
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select discipline…" />
              </SelectTrigger>
              <SelectContent>
                {DISCIPLINE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {disciplineChoice === CUSTOM_DISCIPLINE_VALUE && (
              <Input
                value={customDiscipline}
                onChange={(e) => setCustomDiscipline(e.target.value)}
                required
                placeholder="Enter your own discipline"
              />
            )}
          </div>
        </Card>

        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">
                Format <span className="text-destructive">*</span>
              </Label>
            </div>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as TournamentFormat)}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.map(([key, { label: l, description: desc }]) => (
                  <SelectItem key={key} value={key}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TournamentFormatMiniPreview format={format} />
          </div>
        </Card>
      </div>

      {/* Description */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <Label className="font-semibold">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the format, rules, prizes…"
            className="resize-none"
          />
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <Label className="font-semibold">Settings</Label>
          </div>
          <div className="space-y-3">
            <ToggleRow
              checked={allowTies}
              onChange={setAllowTies}
              label="Allow ties"
              hint="matches can end in a draw"
            />
            <ToggleRow
              checked={isPrivate}
              onChange={setIsPrivate}
              label="Private tournament"
              hint="only visible to you and participants"
            />
            <ToggleRow
              checked={teamMode}
              onChange={setTeamMode}
              label="Team mode"
              hint="teams are the main competitors in the bracket"
            />
          </div>
        </div>
      </Card>

      {/* Participants */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">
                {teamMode ? "Teams" : "Participants"}
              </Label>
            </div>
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {totalCompetitors} competitor{totalCompetitors !== 1 ? "s" : ""}
            </span>
          </div>

          {teamMode ? (
            /* ── Team mode ── */
            <div className="space-y-3">
              {/* Search existing teams */}
              <div ref={teamSearchRef} className="relative">
                <Input
                  value={teamSearch}
                  onChange={(e) => {
                    setTeamSearch(e.target.value);
                    setShowTeamDropdown(true);
                  }}
                  onFocus={() => setShowTeamDropdown(true)}
                  placeholder="Search existing teams…"
                  className="text-xs"
                />
                {showTeamDropdown && teamSearch.trim() && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {teamSearching ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                    ) : teamResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No teams found</div>
                    ) : (
                      teamResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => addExistingTeam(t)}
                          className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                        >
                          <span className="text-sm font-medium text-foreground">{t.name}</span>
                          {t.members.length > 0 && (
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {t.members.map((m) => m.displayName || m.username).join(", ")}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {teams.map((team, ti) => (
                  <TeamCard
                    key={ti}
                    team={team}
                    onUpdateName={(n) =>
                      setTeams((prev) => prev.map((t, i) => (i === ti ? { ...t, name: n } : t)))
                    }
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
                className="text-sm text-primary hover:text-primary/80 font-medium"
              >
                {LABEL_ADD_TEAM}
              </button>
            </div>
          ) : (
            /* ── Individual mode ── */
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Search by username — non-matching names added as guests
              </p>
              <div className="flex flex-wrap items-center gap-1.5 border border-border rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring min-h-[42px] bg-[var(--input-background)]">
                {accounts.map((t, i) => (
                  <span
                    key={`a-${i}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(i, setAccounts)}
                      className="leading-none text-primary/60 hover:text-primary"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {guests.map((t, i) => (
                  <span
                    key={`g-${i}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-700"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(i, setGuests)}
                      className="leading-none text-amber-400 hover:text-amber-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <UserSearchInput
                  onSelect={(username) => addTag(username, setAccounts)}
                  onSelectAsGuest={(name) => addTag(name, setGuests)}
                  placeholder={accounts.length + guests.length === 0 ? "Search username…" : ""}
                  className="flex-1 min-w-[140px]"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="text-xs text-muted-foreground">
        {totalCompetitors} competitor{totalCompetitors !== 1 ? "s" : ""} total — minimum 2 to continue
      </div>

      <button
        type="submit"
        disabled={totalCompetitors < 2}
        className="mt-2 w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {LABEL_GENERATE_BRACKET}
      </button>
    </form>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm text-foreground">
        {label}
        {hint && <span className="text-muted-foreground"> — {hint}</span>}
      </span>
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
  team: TournamentTeam;
  onUpdateName: (name: string) => void;
  onAddMember: (name: string, type: ParticipantMemberType) => void;
  onRemoveMember: (memberIndex: number) => void;
  onRemoveTeam: () => void;
}) {
  const [memberInput, setMemberInput] = useState("");
  const [memberType, setMemberType] = useState<ParticipantMemberType>("account");

  function handleMemberKey(e: React.KeyboardEvent<HTMLInputElement>) {
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
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        {team.existingTeamId ? (
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-foreground font-medium">{team.name}</span>
            <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium uppercase">
              existing
            </span>
          </div>
        ) : (
          <Input
            value={team.name}
            onChange={(e) => onUpdateName(e.target.value)}
            placeholder="Team name…"
            required
            className="flex-1 text-sm"
          />
        )}
        <button
          type="button"
          onClick={onRemoveTeam}
          className="text-muted-foreground hover:text-destructive text-lg leading-none shrink-0"
          title="Remove team"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {team.members.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {team.members.map((m, mi) => (
            <span
              key={mi}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                m.type === "account" ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-700"
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
          onChange={(e) => setMemberType(e.target.value as ParticipantMemberType)}
          className="text-xs border border-border rounded px-1.5 py-1 text-muted-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring"
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
          <Input
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value.replace(",", ""))}
            onKeyDown={handleMemberKey}
            onBlur={handleMemberBlur}
            placeholder="Display name…"
            className="flex-1 text-xs h-auto py-1"
          />
        )}
      </div>
    </div>
  );
}
