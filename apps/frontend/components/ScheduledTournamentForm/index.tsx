"use client";

import { useState, useEffect, useRef } from "react";
import {
  CUSTOM_DISCIPLINE_VALUE,
  DISCIPLINE_OPTIONS,
  disciplineValueToLabel,
  labelToDisciplineValue,
} from "@/constants/disciplines";
import { apiFetch } from "@/lib/api";
import { tournamentFormatInfo, type TournamentFormat, type TournamentRegistrationMode } from "@/types";
import TournamentFormatMiniPreview from "../TournamentFormatMiniPreview";
import UserSearchInput from "../UserSearchInput";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Trophy, Gamepad2, Users, Shield, FileText, UserPlus, X, CalendarClock, ClipboardList } from "lucide-react";
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
  const [registrationMode, setRegistrationMode] = useState<TournamentRegistrationMode>(initial?.registrationMode ?? "open");
  const [maxParticipants, setMaxParticipants] = useState<string>(
    initial?.maxParticipants != null ? String(initial.maxParticipants) : "16"
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [registrationClosesAt, setRegistrationClosesAt] = useState(initial?.registrationClosesAt ?? "");
  const [invites, setInvites] = useState<ScheduledInvite[]>(initial?.invites ?? []);
  const discipline = disciplineChoice === CUSTOM_DISCIPLINE_VALUE
    ? customDiscipline.trim()
    : disciplineValueToLabel(disciplineChoice);

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
     
  }, [name, discipline, description, format, isPrivate, teamMode, registrationMode, maxParticipants, startDate, registrationClosesAt, invites]);

  function buildData(): ScheduledTournamentData {
    return {
      name,
      discipline,
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

  const canSubmit = name.trim() && discipline.trim();

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 items-start">
      {/* ═══ LEFT COLUMN — Tournament Details ═══ */}
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Tournament Details</h2>
          <p className="text-sm text-muted-foreground">Configure the basic information</p>
        </div>

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
              placeholder="e.g. Spring Championship 2026"
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
                  <SelectValue placeholder="Choose sport..." />
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
                  <SelectValue placeholder="Select format..." />
                </SelectTrigger>
                <SelectContent>
                  {formats.map(([key, { label: l }]) => (
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

        {/* Settings */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">Settings</Label>
            </div>
            <div className="space-y-3">
              <ToggleRow
                checked={isPrivate}
                onChange={setIsPrivate}
                label="Private tournament"
                hint="only visible to you and invited participants"
              />
              <ToggleRow
                checked={teamMode}
                onChange={setTeamMode}
                label="Team mode"
                hint="teams compete as brackets"
              />
            </div>
          </div>
        </Card>

        {/* Registration & Capacity */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">Registration</Label>
            </div>

            {/* Registration mode (hidden when private since it's forced to invite_only) */}
            {!isPrivate && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Registration Mode</Label>
                <Select
                  value={registrationMode}
                  onValueChange={(v) => setRegistrationMode(v as TournamentRegistrationMode)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(registrationModeInfo) as [TournamentRegistrationMode, { label: string; description: string }][]).map(
                      ([key, { label, description: desc }]) => (
                        <SelectItem key={key} value={key}>
                          {label} — {desc}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {teamMode ? "Max Teams" : "Max Participants"}
              </Label>
              <Input
                type="number"
                min={2}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                {teamMode
                  ? "Limits the bracket to 16 teams by default."
                  : "Limits the bracket to 16 participants by default."}
              </p>
            </div>
          </div>
        </Card>

        {/* Schedule */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">Schedule</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Registration Closes</Label>
                <Input
                  type="datetime-local"
                  value={registrationClosesAt}
                  onChange={(e) => setRegistrationClosesAt(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Start Date</Label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Description */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <Label className="font-semibold">Rules &amp; Description</Label>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the tournament rules, prize pool, schedule, and any special requirements..."
              className="resize-none"
            />
          </div>
        </Card>
      </div>

      {/* ═══ RIGHT COLUMN — Invites ═══ */}
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Invites</h2>
          <p className="text-sm text-muted-foreground">
            {teamMode
              ? "Invite teams and users — refine assignments before start"
              : "Invite participants — you can invite more later"}
          </p>
        </div>

        {/* Stats card */}
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm ring-2 ring-primary/20">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invited</p>
                <p className="text-2xl font-bold text-primary">{invites.length}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
              {invites.length} / {maxParticipants.trim() ? maxParticipants : "∞"}
            </span>
          </div>
        </Card>

        {/* Add invite */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-4 h-4" />
              <h3 className="font-semibold">Add Invite</h3>
            </div>

            {/* Account invite search */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Search by username</Label>
              <UserSearchInput
                onSelect={addAccountInvite}
                placeholder="Search username…"
                className="w-full"
                size="sm"
              />
            </div>

            {/* Team invite search – available only in team mode */}
            {teamMode && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Search teams</Label>
                <div ref={teamSearchRef} className="relative">
                  <Input
                    value={teamSearch}
                    onChange={(e) => {
                      setTeamSearch(e.target.value);
                      setShowTeamDropdown(true);
                    }}
                    onFocus={() => setShowTeamDropdown(true)}
                    placeholder="Search existing teams…"
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
                            onClick={() => addTeamInvite(t)}
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
              </div>
            )}
          </div>
        </Card>

        {/* Invite list */}
        <Card className="p-4">
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Invite List
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {invites.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No invites yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Add your first invite above</p>
                </div>
              ) : (
                invites.map((inv, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group hover:shadow-md transition-all border border-transparent hover:border-primary/20"
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold flex-shrink-0 ${
                      inv.type === "team" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{inv.displayName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{inv.type}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeInvite(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          {invites.length} invite{invites.length !== 1 ? "s" : ""} — participants can also join after creation
        </p>
      </div>

      {/* ═══ Full-width submit + error (spans both columns) ═══ */}
      <div className="lg:col-span-2 space-y-3">
        {submitError && (
          <p className="text-sm text-destructive text-center">{submitError}</p>
        )}
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          {submitting ? "Creating…" : "Create Scheduled Tournament"}
        </button>
      </div>
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
