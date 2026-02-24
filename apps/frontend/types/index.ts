// ─── Tournaments ─────────────────────────────────────────────────────────────

export type TournamentStatus = "draft" | "registration" | "active" | "completed" | "cancelled";

/** Human-readable labels for tournament status badges */
export const tournamentStatusLabel: Record<TournamentStatus, string> = {
  draft: "Draft",
  registration: "Registration",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  date: string;
  participants: number;
  max: number;
  game: string;
}

export interface TournamentParticipant {
  id: string;
  username: string;
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export type TeamRole = "lead" | "moderator" | "member";
export type TeamRelation = TeamRole | "none";

export interface Team {
  id: string;
  name: string;
  description?: string;
  open: boolean;
  members: TeamMember[];
}

/** Lightweight team shape used in list views (members is a count, not full array) */
export interface TeamSummary {
  id: string;
  name: string;
  open: boolean;
  members: number;
}

export interface TeamMember {
  id: string;
  username: string;
  role: TeamRole;
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export type MatchStatus = "scheduled" | "in_progress" | "completed" | "tie" | "cancelled";

/** Human-readable labels for match status badges */
export const matchStatusLabel: Record<MatchStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "Ongoing",
  completed: "Completed",
  tie: "Tie",
  cancelled: "Cancelled",
};

export interface MatchPlayer {
  id: string;
  username: string;
  score: number | null;
}

export interface Match {
  id: string;
  status: MatchStatus;
  scheduledAt: string;
  game: string;
  playerA: MatchPlayer;
  playerB: MatchPlayer;
  /** Present when the match belongs to a tournament */
  tournament?: { id: string; name: string };
  /** Present when the match belongs to a tournament bracket round */
  round?: string;
  notes?: string;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  bio?: string;
  location?: string;
  joinedAt: string;
}

export interface Friend {
  id: string;
  username: string;
  online: boolean;
}

export interface FriendRequest {
  id: string;
  username: string;
}
