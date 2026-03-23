"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import {
  LABEL_BACK_TO_TOURNAMENTS,
  LABEL_FINISH_TOURNAMENT,
  LABEL_FINISHING,
  LABEL_CANCEL_TOURNAMENT,
  LABEL_CONFIRM_CANCEL,
  LABEL_CANCELLING,
  LABEL_NEVER_MIND,
  LABEL_DELETE_TOURNAMENT,
  LABEL_CONFIRM_DELETE,
  LABEL_DELETING,
  LABEL_CANCEL,
} from "@/constants/labels";
import type { TournamentStatus, TournamentFormat } from "@/types";
import { tournamentStatusLabel, tournamentFormatInfo } from "@/types";
import { apiFetch } from "@/lib/api";
import { usePolling } from "@/hooks/usePolling";
import { generateBracket, type Bracket } from "@/lib/generateBracket";
import BracketView from "@/components/BracketView";
import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";
import { tournamentStatusColors, participantTypeColors } from "@/lib/colors";
import { formatDate, getTournamentWinner } from "@/lib/helpers";
import type { RootState } from "@/store/store";
import type { TournamentParticipantData, TournamentData, TeamAssignment } from "./types";
import UserSearchInput from "@/components/UserSearchInput";

interface TeamSearchResult {
  id: number;
  name: string;
  description: string | null;
  members: { userId: number; username: string; displayName: string | null; role: string }[];
}

function getScheduledCompetitorNames(tournament: TournamentData): string[] {
  if (tournament.teamMode) {
    return (tournament.teamAssignments ?? []).map((team) => team.name);
  }

  return tournament.participants
    .filter((participant) => participant.registrationStatus === "approved" && !participant.declined)
    .map((participant) => participant.displayName);
}

function getPreviewAutoAdvanceGroups(bracket: Bracket | null | undefined): string[][] {
  return bracket?.groups?.filter((group) => group.autoAdvance).map((group) => group.participants) ?? [];
}

function hasDistinctDisplayName(displayName: string, username: string | null | undefined) {
  if (!username) return false;
  return displayName.trim().toLowerCase() !== username.trim().toLowerCase();
}

function renderParticipantLabel(participant: TournamentParticipantData, className: string) {
  if (participant.type === "account" && participant.username) {
    const showUsername = hasDistinctDisplayName(participant.displayName, participant.username);

    return (
      <Link href={`/profile/${participant.username}`} className={`${className} inline-flex items-center gap-1 min-w-0 hover:underline`}>
        <span className="truncate">{participant.displayName}</span>
        {showUsername && <span className="text-xs text-gray-400 shrink-0">@{participant.username}</span>}
      </Link>
    );
  }

  return <span className={className}>{participant.displayName}</span>;
}



export default function TournamentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useSelector((state: RootState) => state.user.current);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGame, setEditGame] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAllowTies, setEditAllowTies] = useState(true);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [decidingParticipant, setDecidingParticipant] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [savingPreview, setSavingPreview] = useState(false);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [previewSeedNames, setPreviewSeedNames] = useState<string[]>([]);
  const [previewAdvancersPerGroup, setPreviewAdvancersPerGroup] = useState(2);
  const [previewAutoAdvanceGroups, setPreviewAutoAdvanceGroups] = useState<string[][]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [teamSearching, setTeamSearching] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamSearchRef = useRef<HTMLDivElement>(null);

  // ─── Team assignment local state ────────────────────────────────────────────
  type LocalTeam = { tempId: string; name: string; memberSeeds: number[] };
  const [localTeams, setLocalTeams] = useState<LocalTeam[]>([]);
  const [assignmentDirty, setAssignmentDirty] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [expandedAssign, setExpandedAssign] = useState<number | null>(null); // seed of player with open team picker

  const cancelAction = useConfirmAction(useCallback(async () => {
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", clientUpdatedAt: tournament!.updatedAt }),
      });
      if (res.ok) {
        setTournament(prev => prev ? { ...prev, status: "cancelled" } : prev);
      } else if (res.status === 409) {
        setConflictError(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to cancel tournament");
      }
    } catch {
      setError("Network error");
    }
  }, [tournament]));

  const deleteAction = useConfirmAction(useCallback(async () => {
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/tournaments");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to delete");
      }
    } catch {
      setError("Network error");
    }
  }, [tournament, router]));

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/tournaments/${params.id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Tournament not found");
          return;
        }
        setTournament(await res.json());
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const pollTournament = useCallback(async () => {
    try {
      const res = await apiFetch(`/tournaments/${params.id}`);
      if (res.ok) setTournament(await res.json());
    } catch { /* silent */ }
  }, [params.id]);

  usePolling(pollTournament, 5000, (tournament?.status === "active" || tournament?.status === "registration") && !editingSettings);

  useEffect(() => {
    const creatorViewing = currentUser?.id === tournament?.creator.id;
    const registrationPhase = tournament?.creationMode === "scheduled" && tournament?.status === "registration";
    if (!tournament?.teamMode || !creatorViewing || !registrationPhase) return;
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
          const existingIds = new Set(tournament.participants.filter((p) => p.teamId).map((p) => p.teamId));
          setTeamResults(data.filter((team) => !existingIds.has(team.id)));
        }
      } catch {
        /* ignore */
      } finally {
        setTeamSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [teamSearch, tournament?.participants, tournament?.teamMode, tournament?.creator.id, tournament?.creationMode, tournament?.status, currentUser?.id]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (teamSearchRef.current && !teamSearchRef.current.contains(e.target as Node)) {
        setShowTeamDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!tournament?.previewBracketData) {
      if (!previewDirty) {
        setPreviewSeedNames([]);
        setPreviewAutoAdvanceGroups([]);
        setPreviewAdvancersPerGroup(2);
      }
      return;
    }
    if (previewDirty) return;

    setPreviewSeedNames(getScheduledCompetitorNames(tournament));
    setPreviewAdvancersPerGroup(tournament.previewBracketData.advancersPerGroup ?? 2);
    setPreviewAutoAdvanceGroups(getPreviewAutoAdvanceGroups(tournament.previewBracketData));
  }, [tournament?.previewBracketData, tournament?.participants, tournament?.teamAssignments, previewDirty]);

  // Sync localTeams from server data (only when not dirty)
  useEffect(() => {
    if (!tournament?.teamMode) return;
    if (assignmentDirty) return;
    const serverAssignments = tournament.teamAssignments;
    if (serverAssignments && serverAssignments.length > 0) {
      setLocalTeams(
        serverAssignments.map((t) => ({
          tempId: `server-${t.name}`,
          name: t.name,
          memberSeeds: t.memberSeeds,
        }))
      );
    } else {
      setLocalTeams([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.teamAssignments, tournament?.teamMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading tournament…</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
            {LABEL_BACK_TO_TOURNAMENTS}
          </Link>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-red-600 text-sm">{error ?? "Tournament not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const activeParticipants = tournament.participants.filter(
    (p) => p.registrationStatus !== "declined" && p.registrationStatus !== "withdrawn"
  );
  const activeTeamParticipants = activeParticipants.filter((p) => p.type === "team");
  const competitorCount = tournament.teamMode
    ? (tournament.teamAssignments?.length ?? activeTeamParticipants.length)
    : activeParticipants.length;
  const spotsLeft = tournament.max - competitorCount;
  const isCreator = currentUser?.id === tournament.creator.id;

  // Check if current user is an unconfirmed participant
  const myParticipant = currentUser ? tournament.participants.find((p) => {
    if (p.userId === currentUser.id) return true;
    if (p.membersSnapshot?.some((m) => m.userId === currentUser.id)) return true;
    return false;
  }) : null;

  const myHighlightName: string | undefined = tournament.teamMode
    ? (tournament.teamAssignments?.find((t) =>
        t.members.some((m) => m.userId === currentUser?.id)
      )?.name ?? undefined)
    : (myParticipant?.displayName ?? undefined);

  const isUnconfirmedParticipant = myParticipant != null && !myParticipant.confirmed && !myParticipant.declined;

  async function handleConfirm(accept: boolean) {
    setConfirming(true);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({ accept }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTournament(updated);
      }
    } catch {
      // silently fail
    } finally {
      setConfirming(false);
    }
  }

  // ─── Scheduled tournament helpers ──────────────────────────────────────────
  const isScheduled = tournament.creationMode === "scheduled";
  const isRegistrationPhase = isScheduled && tournament.status === "registration";
  const registrationClosed = tournament.registrationClosesAt
    ? new Date(tournament.registrationClosesAt).getTime() < Date.now()
    : false;
  const canRegister =
    isRegistrationPhase &&
    !registrationClosed &&
    tournament.registrationMode !== "invite_only" &&
    !isCreator &&
    (!myParticipant || ["declined", "withdrawn"].includes(myParticipant.registrationStatus ?? ""));

  // Does current user have an invite to respond to? (scheduled only)
  const hasScheduledInvite =
    isScheduled && !isCreator && myParticipant?.registrationStatus === "invited";

  // Is user already registered / approved?
  const isRegistered =
    myParticipant != null &&
    ["approved", "pending"].includes(myParticipant.registrationStatus ?? "");

  const approvedCount = tournament.participants.filter(
    (p) => p.registrationStatus === "approved"
  ).length;

  const approvedParticipants = tournament.participants.filter(
    (p) => p.registrationStatus === "approved" && !p.declined
  );

  const pendingParticipants = isScheduled
    ? tournament.participants.filter((p) => p.registrationStatus === "pending")
    : [];

  const invitedParticipants = isScheduled
    ? tournament.participants.filter((p) => p.registrationStatus === "invited")
    : [];

  const visibleParticipants = isScheduled
    ? tournament.participants.filter((p) =>
        p.registrationStatus !== "pending" &&
        p.registrationStatus !== "invited"
      )
    : tournament.participants;

  const editablePreviewBracket = !tournament.previewBracketData
    ? null
    : (() => {
        const baseNames = previewSeedNames.length > 0 ? previewSeedNames : getScheduledCompetitorNames(tournament);
        const generated = generateBracket(
          baseNames,
          tournament.previewBracketData.format,
          tournament.previewBracketData.format === "combination"
            ? { advancersPerGroup: previewAdvancersPerGroup, autoAdvanceGroups: previewAutoAdvanceGroups }
            : undefined,
        );

        return {
          ...generated,
          allowTies: tournament.previewBracketData.allowTies,
        } satisfies Bracket;
      })();

  const previewTeamCount = tournament.teamMode
    ? localTeams.filter((team) => team.name.trim()).length
    : approvedCount;

  function swapPreviewParticipants(nameA: string, nameB: string) {
    if (!tournament) return;

    setPreviewSeedNames((prev) => {
      const next = prev.length > 0 ? [...prev] : [...getScheduledCompetitorNames(tournament)];
      const indexA = next.indexOf(nameA);
      const indexB = next.indexOf(nameB);
      if (indexA === -1 || indexB === -1 || indexA === indexB) return prev;
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
    setPreviewDirty(true);
  }

  function movePreviewParticipant(name: string, fromGroupIndex: number, toGroupIndex: number) {
    if (!editablePreviewBracket?.groups) return;

    const allRegularGroups = editablePreviewBracket.groups.filter((group) => !group.autoAdvance);
    if (toGroupIndex >= allRegularGroups.length + previewAutoAdvanceGroups.length) {
      return;
    }

    const regularGroupCount = allRegularGroups.length;
    const isFromAuto = fromGroupIndex >= regularGroupCount;
    const isToAuto = toGroupIndex >= regularGroupCount;

    if (isFromAuto && isToAuto) return;

    if (isFromAuto) {
      const autoIndex = fromGroupIndex - regularGroupCount;
      setPreviewAutoAdvanceGroups((prev) => prev.map((group, index) => index === autoIndex ? group.filter((participant) => participant !== name) : group).filter((group) => group.length > 0));
      setPreviewDirty(true);
      return;
    }

    if (isToAuto) {
      const autoIndex = toGroupIndex - regularGroupCount;
      setPreviewAutoAdvanceGroups((prev) => {
        if (autoIndex < prev.length) {
          return prev.map((group, index) => index === autoIndex ? [...group, name] : group);
        }
        return [...prev, [name]];
      });
      setPreviewDirty(true);
      return;
    }

    const targetGroup = allRegularGroups[toGroupIndex];
    if (!targetGroup || targetGroup.participants.length === 0) return;
    const targetName = targetGroup.participants[0];
    if (targetName === name) return;
    swapPreviewParticipants(name, targetName);
  }

  async function savePreviewEdits(previewToSave?: Bracket) {
    const bracket = previewToSave ?? editablePreviewBracket;
    if (!bracket) return true;

    setSavingPreview(true);
    setError(null);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          previewBracketData: bracket,
          clientUpdatedAt: tournament!.updatedAt,
        }),
      });

      if (res.status === 409) {
        setConflictError(true);
        return false;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save preview changes");
        return false;
      }

      const updated = await res.json();
      setTournament(updated);
      setPreviewDirty(false);
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setSavingPreview(false);
    }
  }

  async function inviteParticipants(invites: Array<{ type: "account" | "team"; username?: string; teamId?: number; displayName?: string }>) {
    setInviting(true);
    setInviteError(null);
    setInviteNotice(null);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/invites`, {
        method: "POST",
        body: JSON.stringify({ invites }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setInviteError(body.error ?? "Failed to send invite");
        return;
      }
      const updated = await res.json();
      setTournament(updated);
      setInviteNotice(invites.length === 1 ? "Invite sent." : "Invites sent.");
      setTeamSearch("");
      setShowTeamDropdown(false);
    } catch {
      setInviteError("Network error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRegister() {
    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/register`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setTournament(await res.json());
      } else {
        const body = await res.json().catch(() => ({}));
        setRegisterError(body.error ?? "Failed to register");
      }
    } catch {
      setRegisterError("Network error");
    } finally {
      setRegistering(false);
    }
  }

  async function handleUnregister() {
    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/register`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTournament(await res.json());
      } else {
        const body = await res.json().catch(() => ({}));
        setRegisterError(body.error ?? "Failed to unregister");
      }
    } catch {
      setRegisterError("Network error");
    } finally {
      setRegistering(false);
    }
  }

  async function handleRespondInvite(accept: boolean) {
    setConfirming(true);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/respond-invite`, {
        method: "PATCH",
        body: JSON.stringify({ accept }),
      });
      if (res.ok) {
        setTournament(await res.json());
      }
    } catch { /* silent */ }
    finally { setConfirming(false); }
  }

  async function handleParticipantDecision(seed: number, decision: "approve" | "decline") {
    setDecidingParticipant(seed);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/participants/${seed}/${decision}`, {
        method: "PATCH",
      });
      if (res.ok) {
        setTournament(await res.json());
      }
    } catch { /* silent */ }
    finally { setDecidingParticipant(null); }
  }

  async function handleRescindInvite(seed: number) {
    setDecidingParticipant(seed);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/participants/${seed}/invite`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTournament(await res.json());
      }
    } catch { /* silent */ }
    finally { setDecidingParticipant(null); }
  }

  async function handlePreviewBracket() {
    setPreviewing(true);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/preview-bracket`, {
        method: "POST",
      });
      if (res.ok) {
        setTournament(await res.json());
        setPreviewDirty(false);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to preview bracket");
      }
    } catch {
      setError("Network error");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleStartTournament() {
    setStarting(true);
    try {
      if (previewDirty && editablePreviewBracket) {
        const saved = await savePreviewEdits(editablePreviewBracket);
        if (!saved) return;
      }

      const res = await apiFetch(`/tournaments/${tournament!.id}/start`, {
        method: "POST",
      });
      if (res.ok) {
        setTournament(await res.json());
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to start tournament");
      }
    } catch {
      setError("Network error");
    } finally {
      setStarting(false);
    }
  }

  function addTeam() {
    const newTeam: LocalTeam = { tempId: `local-${Date.now()}`, name: "", memberSeeds: [] };
    setLocalTeams((prev) => [...prev, newTeam]);
    setAssignmentDirty(true);
  }

  function removeTeam(tempId: string) {
    setLocalTeams((prev) => prev.filter((t) => t.tempId !== tempId));
    setAssignmentDirty(true);
  }

  function renameTeam(tempId: string, name: string) {
    setLocalTeams((prev) => prev.map((t) => t.tempId === tempId ? { ...t, name } : t));
    setAssignmentDirty(true);
  }

  function assignToTeam(seed: number, teamTempId: string) {
    setLocalTeams((prev) =>
      prev.map((t) => {
        if (t.tempId === teamTempId) return { ...t, memberSeeds: [...t.memberSeeds.filter((s) => s !== seed), seed] };
        return { ...t, memberSeeds: t.memberSeeds.filter((s) => s !== seed) };
      })
    );
    setAssignmentDirty(true);
    setExpandedAssign(null);
  }

  function unassignFromTeam(seed: number) {
    setLocalTeams((prev) =>
      prev.map((t) => ({ ...t, memberSeeds: t.memberSeeds.filter((s) => s !== seed) }))
    );
    setAssignmentDirty(true);
  }

  async function handleSaveAssignments() {
    setSavingAssignments(true);
    setAssignmentError(null);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}/team-assignments`, {
        method: "PUT",
        body: JSON.stringify({
          teams: localTeams.map((t) => ({ name: t.name.trim(), memberSeeds: t.memberSeeds })),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTournament(updated);
        setAssignmentDirty(false);
      } else {
        const body = await res.json().catch(() => ({}));
        setAssignmentError(body.error ?? "Failed to save team assignments");
      }
    } catch {
      setAssignmentError("Network error");
    } finally {
      setSavingAssignments(false);
    }
  }

  const tournamentWinner = tournament.bracketData ? getTournamentWinner(tournament.bracketData) : null;

  async function handleFinish() {
    setFinishing(true);
    try {
      const res = await apiFetch(`/tournaments/${tournament!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed", clientUpdatedAt: tournament!.updatedAt }),
      });
      if (res.ok) {
        setTournament(prev => prev ? { ...prev, status: "completed" } : prev);
      } else if (res.status === 409) {
        setConflictError(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to finish tournament");
      }
    } catch {
      setError("Network error");
    } finally {
      setFinishing(false);
    }
  }

  function openEditSettings() {
    setEditName(tournament!.name);
    setEditGame(tournament!.game);
    setEditDescription(tournament!.description ?? "");
    setEditAllowTies(tournament!.bracketData?.allowTies !== false);
    setEditIsPrivate(tournament!.isPrivate);
    setSettingsError(null);
    setEditingSettings(true);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const body: Record<string, unknown> = {
        name: editName,
        game: editGame,
        description: editDescription || null,
        isPrivate: editIsPrivate,
        clientUpdatedAt: tournament!.updatedAt,
      };
      if (tournament!.bracketData) {
        body.bracketData = { ...tournament!.bracketData, allowTies: editAllowTies };
      }
      const res = await apiFetch(`/tournaments/${tournament!.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setEditingSettings(false);
        setConflictError(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSettingsError(data.error ?? "Failed to save settings");
        return;
      }
      const updated = await res.json();
      setTournament(prev => prev ? {
        ...prev,
        name: updated.name,
        game: updated.game,
        description: updated.description,
        isPrivate: updated.isPrivate,
        bracketData: updated.bracketData ?? prev.bracketData,
      } : prev);
      setEditingSettings(false);
    } catch {
      setSettingsError("Network error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleReportResult(matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) {
    const res = await apiFetch(`/tournaments/${tournament!.id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({ winner, scoreA, scoreB, clientUpdatedAt: tournament!.updatedAt }),
    });
    if (res.status === 409) { setConflictError(true); return; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to report result");
    }
    const { bracketData, updatedAt } = await res.json();
    setTournament(prev => prev ? { ...prev, bracketData, updatedAt } : prev);
  }

  async function handleReportTiebreaker(matchId: string, winnerName: string) {
    const res = await apiFetch(`/tournaments/${tournament!.id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({ winner: winnerName, clientUpdatedAt: tournament!.updatedAt }),
    });
    if (res.status === 409) { setConflictError(true); return; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to report tiebreaker result");
    }
    const { bracketData, updatedAt } = await res.json();
    setTournament(prev => prev ? { ...prev, bracketData, updatedAt } : prev);
  }

  async function handleUndoTiebreaker() {
    const res = await apiFetch(`/tournaments/${tournament!.id}/matches/tiebreaker`, {
      method: "PATCH",
      body: JSON.stringify({ reset: true, clientUpdatedAt: tournament!.updatedAt }),
    });
    if (res.status === 409) { setConflictError(true); return; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to undo tiebreaker");
    }
    const { bracketData, updatedAt } = await res.json();
    setTournament(prev => prev ? { ...prev, bracketData, updatedAt } : prev);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Back */}
        <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← Back to tournaments
        </Link>

        {/* Conflict banner */}
        {conflictError && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800">This page was changed by someone else. Reload to see the latest version before making changes.</p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="shrink-0 text-sm font-semibold text-amber-700 border border-amber-400 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
            >
              Reload
            </button>
          </div>
        )}

        {/* Invitation banner (quick) */}
        {isUnconfirmedParticipant && !isScheduled && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-indigo-800">You&apos;ve been invited to this tournament.</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleConfirm(false)}
                disabled={confirming}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Decline
              </button>
              <button
                onClick={() => handleConfirm(true)}
                disabled={confirming}
                className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                Accept
              </button>
            </div>
          </div>
        )}

        {/* Invitation banner (scheduled) */}
        {hasScheduledInvite && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-indigo-800">You&apos;ve been invited to this scheduled tournament.</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleRespondInvite(false)}
                disabled={confirming}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Decline
              </button>
              <button
                onClick={() => handleRespondInvite(true)}
                disabled={confirming}
                className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                Accept
              </button>
            </div>
          </div>
        )}

        {/* Registration banner */}
        {isScheduled && !isCreator && currentUser && (
          <div className="mb-6">
            {canRegister && !isRegistered && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-blue-800">
                    {tournament.registrationMode === "approval"
                      ? "Applications are open and require organizer approval."
                      : "Registration is open."}
                  </p>
                  {tournament.registrationClosesAt && (
                    <p className="text-xs text-blue-500 mt-0.5">
                      Closes {formatDate(tournament.registrationClosesAt, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="shrink-0 text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                >
                  {registering ? (tournament.registrationMode === "approval" ? "Applying…" : "Registering…") : (tournament.registrationMode === "approval" ? "Apply" : "Register")}
                </button>
              </div>
            )}
            {isRegistered && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-green-800">
                    You are registered.
                    {myParticipant?.registrationStatus === "pending" && (
                      <span className="text-yellow-700"> Awaiting organizer approval.</span>
                    )}
                    {myParticipant?.registrationStatus === "approved" && (
                      <span className="text-green-700"> You&apos;re approved!</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleUnregister}
                  disabled={registering}
                  className="shrink-0 text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  {registering ? "Withdrawing…" : "Withdraw"}
                </button>
              </div>
            )}
            {registerError && (
              <p className="text-xs text-red-500 mt-2">{registerError}</p>
            )}
          </div>
        )}

        {isScheduled && isCreator && isRegistrationPhase && !registrationClosed && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">Invite Participants</h2>
            <p className="text-xs text-gray-400 mb-4">
              Invite people during registration. Invitees accept for themselves; applicants appear in the pending list.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase text-gray-400 w-14 shrink-0">Account</span>
                <UserSearchInput
                  onSelect={(username) => void inviteParticipants([{ type: "account", username, displayName: username }])}
                  placeholder="Search username…"
                  className="flex-1"
                  size="sm"
                />
              </div>

              {tournament.teamMode && (
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
                      className="w-full border border-gray-200 rounded-lg text-xs px-2 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {showTeamDropdown && teamSearch.trim() && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {teamSearching ? (
                          <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>
                        ) : teamResults.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-400">No teams found</div>
                        ) : (
                          teamResults.map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => void inviteParticipants([{ type: "team", teamId: team.id, displayName: team.name }])}
                              className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <span className="text-sm font-medium text-gray-800">{team.name}</span>
                              {team.members.length > 0 && (
                                <span className="block text-[11px] text-gray-400 truncate">
                                  {team.members.map((member) => member.displayName || member.username).join(", ")}
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
            {(inviteError || inviteNotice) && (
              <p className={`text-xs mt-3 ${inviteError ? "text-red-500" : "text-green-600"}`}>
                {inviteError ?? inviteNotice}
              </p>
            )}
            {inviting && <p className="text-xs text-gray-400 mt-2">Sending invite…</p>}
          </div>
        )}

        {/* Winner banner */}
        {tournamentWinner && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Tournament Winner</p>
              <p className="text-lg font-bold text-amber-800">{tournamentWinner}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${tournamentStatusColors[tournament.status]}`}>
                {tournamentStatusLabel[tournament.status]}
              </span>
            </div>
          </div>
          {tournament.description && (
            <p className="text-sm text-gray-600 mb-6">{tournament.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Game</p>
              <p className="text-gray-800 font-medium">{tournament.game}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Format</p>
              <p className="text-gray-800 font-medium">{tournamentFormatInfo[tournament.format]?.label ?? tournament.format}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Organizer</p>
              <Link href={`/profile/${tournament.creator.username}`} className="text-gray-800 font-medium hover:text-indigo-600 inline-flex items-center gap-1">
                <span>{tournament.creator.displayName || tournament.creator.username}</span>
                {tournament.creator.displayName && hasDistinctDisplayName(tournament.creator.displayName, tournament.creator.username) && (
                  <span className="text-xs text-gray-400 font-normal">@{tournament.creator.username}</span>
                )}
              </Link>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">
                {tournament.teamMode ? "Teams" : "Participants"}
              </p>
              <p className="text-gray-800 font-medium">
                {competitorCount} / {tournament.max}
                {spotsLeft > 0 && (
                  <span className="text-gray-400 font-normal"> ({spotsLeft} left)</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Created</p>
              <p className="text-gray-800 font-medium">
                {formatDate(tournament.createdAt)}
              </p>
            </div>
            {tournament.startDate && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Start date</p>
                <p className="text-gray-800 font-medium">
                  {formatDate(tournament.startDate, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
            {tournament.isPrivate && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Visibility</p>
                <p className="text-gray-800 font-medium">Private</p>
              </div>
            )}
            {isScheduled && tournament.registrationMode && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Registration</p>
                <p className="text-gray-800 font-medium capitalize">{tournament.registrationMode.replace("_", " ")}</p>
              </div>
            )}
            {isScheduled && tournament.registrationClosesAt && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Registration closes</p>
                <p className="text-gray-800 font-medium">
                  {formatDate(tournament.registrationClosesAt, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {registrationClosed && <span className="text-red-500 text-xs ml-1">(closed)</span>}
                </p>
              </div>
            )}
            {isScheduled && tournament.teamMode && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Mode</p>
                <p className="text-gray-800 font-medium">Team mode</p>
              </div>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">
            Participants ({visibleParticipants.length})
          </h2>
          {!isCreator && isScheduled && (pendingParticipants.length + invitedParticipants.length) > 0 ? (
            <p className="text-xs text-gray-400 mb-4">
              {pendingParticipants.length + invitedParticipants.length}{" "}
              {pendingParticipants.length + invitedParticipants.length === 1 ? "invitation" : "invitations"} pending.
            </p>
          ) : (
            <div className="mb-4" />
          )}
          <div className="flex flex-col gap-2">
            {visibleParticipants.map((p) => (
              <div
                key={p.seed}
                className="flex items-start gap-3 px-4 py-3 rounded-lg bg-gray-50"
              >
                <span className="text-xs text-gray-400 font-mono w-6 shrink-0 text-right mt-0.5">
                  {p.seed}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {p.type === "team" ? (
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600 shrink-0">
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                    ) : (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        p.type === "account" ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    {renderParticipantLabel(
                      p,
                      `text-sm font-medium truncate ${
                        p.type === "team" ? "text-purple-800" : p.type === "account" ? "text-gray-800" : "text-amber-700"
                      }`
                    )}
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 ${participantTypeColors[p.type]}`}>
                      {p.type}
                    </span>
                    {p.type === "account" && !p.confirmed && !isScheduled && (
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        p.declined ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                      }`}>
                        {p.declined ? "Declined" : "Unconfirmed"}
                      </span>
                    )}
                    {isScheduled && p.registrationStatus && (
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        p.registrationStatus === "approved" ? "bg-green-100 text-green-600" :
                        p.registrationStatus === "pending" ? "bg-yellow-100 text-yellow-600" :
                        p.registrationStatus === "invited" ? "bg-blue-100 text-blue-600" :
                        p.registrationStatus === "declined" ? "bg-red-100 text-red-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {p.registrationStatus}
                      </span>
                    )}
                  </div>
                  {p.type === "team" && p.membersSnapshot && p.membersSnapshot.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 ml-8">
                      {p.membersSnapshot.map((m, mi) => (
                        <span
                          key={mi}
                          className={`text-[11px] px-1.5 py-0.5 rounded ${
                            m.type === "account" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Approve / Decline buttons for organizer in registration phase */}
              </div>
            ))}
            {spotsLeft > 0 && Array.from({ length: Math.min(spotsLeft, 4) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-gray-200">
                <span className="text-xs text-gray-300 font-mono w-6 shrink-0 text-right">
                  {tournament.participants.length + i + 1}.
                </span>
                <div className="w-6 h-6 rounded-full bg-gray-100 shrink-0" />
                <span className="text-sm text-gray-300">Open slot</span>
              </div>
            ))}
            {spotsLeft > 4 && (
              <p className="text-xs text-gray-400 text-center mt-1">
                +{spotsLeft - 4} more open slots
              </p>
            )}
          </div>
        </div>

        {/* Invited participants (owner only) */}
        {isScheduled && isCreator && invitedParticipants.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Invited (Awaiting Response) ({invitedParticipants.length})
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              These participants were invited directly and can accept or decline themselves.
            </p>
            <div className="flex flex-col gap-2">
              {invitedParticipants.map((p) => (
                <div key={`invited-${p.seed}`} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-xs text-gray-400 font-mono w-6 shrink-0 text-right mt-0.5">
                    {p.seed}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        p.type === "account" ? "bg-indigo-100 text-indigo-600" : p.type === "team" ? "bg-purple-100 text-purple-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                      {renderParticipantLabel(
                        p,
                        `text-sm font-medium truncate ${
                          p.type === "team" ? "text-purple-800" : p.type === "account" ? "text-gray-800" : "text-amber-700"
                        }`
                      )}
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 ${participantTypeColors[p.type]}`}>
                        {p.type}
                      </span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 bg-blue-100 text-blue-700">
                        invited
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={decidingParticipant === p.seed}
                    onClick={() => handleRescindInvite(p.seed)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 transition-colors"
                  >
                    {decidingParticipant === p.seed ? "…" : "Rescind"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending applications (owner only) */}
        {isScheduled && isCreator && pendingParticipants.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Pending Applications ({pendingParticipants.length})
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Only applications appear here. Invited participants accept or decline on their own.
            </p>
            <div className="flex flex-col gap-2">
              {pendingParticipants.map((p) => (
                <div key={`pending-${p.seed}`} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-100">
                  <span className="text-xs text-gray-400 font-mono w-6 shrink-0 text-right mt-0.5">
                    {p.seed}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        p.type === "account" ? "bg-indigo-100 text-indigo-600" : p.type === "team" ? "bg-purple-100 text-purple-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                      {renderParticipantLabel(
                        p,
                        `text-sm font-medium truncate ${
                          p.type === "team" ? "text-purple-800" : p.type === "account" ? "text-gray-800" : "text-amber-700"
                        }`
                      )}
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 ${participantTypeColors[p.type]}`}>
                        {p.type}
                      </span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-medium shrink-0 bg-yellow-100 text-yellow-700">
                        pending
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      onClick={() => handleParticipantDecision(p.seed, "approve")}
                      disabled={decidingParticipant === p.seed}
                      className="text-[11px] px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleParticipantDecision(p.seed, "decline")}
                      disabled={decidingParticipant === p.seed}
                      className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Assignment (team mode + creator + registration phase) */}
        {tournament.teamMode && isCreator && isRegistrationPhase && (() => {
          const assignedSeeds = new Set(localTeams.flatMap((t) => t.memberSeeds));
          const unassigned = approvedParticipants.filter((p) => !assignedSeeds.has(p.seed));
          const participantBySeed = new Map(tournament.participants.map((p) => [p.seed, p]));

          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-base font-semibold text-gray-800">Team Assignment</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">Team Mode</span>
              </div>
              <p className="text-xs text-gray-400 mb-5">
                Group approved players into competing teams. All approved players must be assigned before starting.
              </p>

              {/* Teams */}
              <div className="flex flex-col gap-4 mb-4">
                {localTeams.map((team) => (
                  <div key={team.tempId} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        value={team.name}
                        onChange={(e) => renameTeam(team.tempId, e.target.value)}
                        placeholder="Team name…"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                      <button
                        type="button"
                        onClick={() => removeTeam(team.tempId)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded border border-gray-200 hover:border-red-200 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {team.memberSeeds.length === 0 ? (
                        <span className="text-xs text-gray-300 italic">No players assigned yet</span>
                      ) : (
                        team.memberSeeds.map((seed) => {
                          const p = participantBySeed.get(seed);
                          if (!p) return null;
                          return (
                            <span
                              key={seed}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-purple-50 text-purple-700"
                            >
                              {p.displayName}
                              <button
                                type="button"
                                onClick={() => unassignFromTeam(seed)}
                                className="leading-none opacity-50 hover:opacity-100"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unassigned pool */}
              {unassigned.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase text-gray-400 tracking-wide mb-2">
                    Unassigned ({unassigned.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unassigned.map((p) => (
                      <div key={p.seed} className="relative">
                        <button
                          type="button"
                          onClick={() => setExpandedAssign(expandedAssign === p.seed ? null : p.seed)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        >
                          {p.displayName}
                          <span className="opacity-50">＋</span>
                        </button>
                        {expandedAssign === p.seed && localTeams.length > 0 && (
                          <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                            {localTeams.filter((t) => t.name.trim()).map((t) => (
                              <button
                                key={t.tempId}
                                type="button"
                                onClick={() => assignToTeam(p.seed, t.tempId)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 text-gray-700 hover:text-purple-700"
                              >
                                {t.name}
                              </button>
                            ))}
                            {localTeams.filter((t) => t.name.trim()).length === 0 && (
                              <div className="px-3 py-2 text-xs text-gray-400">Name your teams first</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unassigned.length === 0 && approvedParticipants.length > 0 && (
                <p className="text-xs text-green-600 mb-4">✓ All approved players are assigned to teams.</p>
              )}

              {assignmentError && <p className="text-xs text-red-500 mb-3">{assignmentError}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={addTeam}
                  className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  + Add Team
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={savingAssignments || !assignmentDirty}
                  className="text-sm px-4 py-2 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {savingAssignments ? "Saving…" : assignmentDirty ? "Save Assignments" : "Assignments Saved"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Preview bracket & Start tournament (scheduled, registration phase) */}
        {isCreator && isRegistrationPhase && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Tournament Actions</h2>
            <div className="flex flex-col gap-4">
              {/* Preview bracket */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 font-medium">Preview Bracket</p>
                  <p className="text-xs text-gray-400">
                    {tournament.teamMode
                      ? `Generate a bracket preview based on current team assignments (${localTeams.filter((t) => t.name.trim()).length} team${localTeams.filter((t) => t.name.trim()).length !== 1 ? "s" : ""}).`
                      : `Generate a bracket preview based on current approved participants (${approvedCount}).`}
                  </p>
                </div>
                <button
                  onClick={handlePreviewBracket}
                  disabled={previewing || (tournament.teamMode ? localTeams.filter((t) => t.name.trim()).length < 2 : approvedCount < 2)}
                  title={tournament.teamMode
                    ? (localTeams.filter((t) => t.name.trim()).length < 2 ? "Need at least 2 named teams" : undefined)
                    : (approvedCount < 2 ? "Need at least 2 approved participants" : undefined)}
                  className="shrink-0 text-sm px-4 py-2 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {previewing ? "Generating…" : "Preview Bracket"}
                </button>
              </div>

              {/* Show preview bracket if available */}
              {tournament.previewBracketData && (
                <div className="border border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/30">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Bracket Preview</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Drag and drop to reseed before the tournament starts.
                        {previewDirty && <span className="text-amber-600"> Unsaved changes.</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void savePreviewEdits()}
                      disabled={!previewDirty || savingPreview}
                      className="shrink-0 text-sm px-3 py-2 rounded-lg font-medium bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingPreview ? "Saving…" : "Save Preview Changes"}
                    </button>
                  </div>
                  <BracketView
                    bracket={editablePreviewBracket ?? tournament.previewBracketData}
                    tournamentId={tournament.id}
                    highlightName={myHighlightName}
                    onSwapParticipants={swapPreviewParticipants}
                    advancersPerGroup={previewAdvancersPerGroup}
                    onAdvancersChange={(value) => {
                      setPreviewAdvancersPerGroup(value);
                      setPreviewDirty(true);
                    }}
                    autoAdvanceGroups={previewAutoAdvanceGroups}
                    onAutoAdvanceGroupsChange={(groups) => {
                      setPreviewAutoAdvanceGroups(groups);
                      setPreviewDirty(true);
                    }}
                    onMoveParticipant={(name, fromGroupIndex, toGroupIndex) => movePreviewParticipant(name, fromGroupIndex, toGroupIndex)}
                  />
                </div>
              )}

              {/* Start tournament */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <div>
                  <p className="text-sm text-gray-700 font-medium">Start Tournament</p>
                  <p className="text-xs text-gray-400">
                    {tournament.teamMode
                      ? `Lock registration and start the bracket with ${localTeams.filter((t) => t.name.trim()).length} team${localTeams.filter((t) => t.name.trim()).length !== 1 ? "s" : ""}.`
                      : `Lock registration and start the bracket with ${approvedCount} approved participant${approvedCount !== 1 ? "s" : ""}.`}
                  </p>
                </div>
                <button
                  onClick={handleStartTournament}
                  disabled={starting || savingPreview || (tournament.teamMode ? localTeams.filter((t) => t.name.trim()).length < 2 : approvedCount < 2)}
                  title={tournament.teamMode
                    ? (localTeams.filter((t) => t.name.trim()).length < 2 ? "Need at least 2 named teams" : undefined)
                    : (approvedCount < 2 ? "Need at least 2 approved participants" : undefined)}
                  className="shrink-0 text-sm px-4 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {starting ? "Starting…" : "Start Tournament"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bracket */}
        {tournament.bracketData && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Bracket</h2>
            {isCreator && tournament.status === "active" && (
              <p className="text-xs text-gray-400 mb-3">Click a match to report the result.</p>
            )}
            <BracketView
              bracket={tournament.bracketData}
              tournamentId={tournament.id}
              highlightName={myHighlightName}
              onReportResult={isCreator && tournament.status === "active" ? handleReportResult : undefined}
              onReportTiebreaker={isCreator && tournament.status === "active" ? handleReportTiebreaker : undefined}
              onUndoTiebreaker={isCreator && tournament.status === "active" ? handleUndoTiebreaker : undefined}
            />
          </div>
        )}

        {/* Edit Settings Modal */}
        <Modal
          isOpen={editingSettings}
          onClose={() => setEditingSettings(false)}
          title="Edit Settings"
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Tournament name</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Game / Discipline</label>
              <input
                value={editGame}
                onChange={e => setEditGame(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Description <span className="normal-case text-gray-300">(optional)</span></label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
            {tournament.bracketData && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={editAllowTies}
                  onClick={() => setEditAllowTies(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${editAllowTies ? "bg-indigo-600" : "bg-gray-200"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editAllowTies ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-gray-700">Allow ties <span className="text-gray-400">— matches can end in a draw</span></span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={editIsPrivate}
                onClick={() => setEditIsPrivate(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${editIsPrivate ? "bg-gray-700" : "bg-gray-200"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editIsPrivate ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className="text-sm text-gray-700">Private <span className="text-gray-400">— only visible to you and participants</span></span>
            </div>
            {settingsError && <p className="text-xs text-red-500">{settingsError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings || !editName.trim() || !editGame.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {savingSettings ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingSettings(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* Actions (creator only) */}
        {isCreator && (
          <div className="flex items-center gap-3 flex-wrap">
            {!["completed", "cancelled"].includes(tournament.status) && (
              <button
                type="button"
                onClick={openEditSettings}
                className="text-sm px-4 py-2 rounded-lg font-medium transition-colors border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Edit Settings
              </button>
            )}
            {tournament.status === "active" && (
              <button
                type="button"
                onClick={handleFinish}
                disabled={!tournamentWinner || finishing}
                title={!tournamentWinner ? "Available once a winner is determined" : undefined}
                className="text-sm px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {finishing ? LABEL_FINISHING : LABEL_FINISH_TOURNAMENT}
              </button>
            )}
            {!["completed", "cancelled"].includes(tournament.status) && (
              <>
                <button
                  type="button"
                  onClick={cancelAction.trigger}
                  disabled={cancelAction.loading}
                  className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    cancelAction.confirmed
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : "border border-orange-300 text-orange-600 hover:bg-orange-50"
                  } disabled:opacity-50`}
                >
                  {cancelAction.loading ? LABEL_CANCELLING : cancelAction.confirmed ? LABEL_CONFIRM_CANCEL : LABEL_CANCEL_TOURNAMENT}
                </button>
                {cancelAction.confirmed && (
                  <button
                    type="button"
                    onClick={cancelAction.reset}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {LABEL_NEVER_MIND}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={deleteAction.trigger}
              disabled={deleteAction.loading}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                deleteAction.confirmed
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-red-200 text-red-600 hover:bg-red-50"
              } disabled:opacity-50`}
            >
              {deleteAction.loading ? LABEL_DELETING : deleteAction.confirmed ? LABEL_CONFIRM_DELETE : LABEL_DELETE_TOURNAMENT}
            </button>
            {deleteAction.confirmed && (
              <button
                type="button"
                onClick={deleteAction.reset}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {LABEL_CANCEL}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
