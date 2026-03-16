// ─── Tournaments ─────────────────────────────────────────────────────────────

export type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin"
  | "double_round_robin"
  | "combination"
  | "swiss";

export const tournamentFormatInfo: Record<TournamentFormat, { label: string; description: string }> = {
  single_elimination: {
    label: "Single Elimination",
    description: "One loss and you're out. Fast, high-stakes knockout format.",
  },
  double_elimination: {
    label: "Double Elimination",
    description: "Must lose twice to be eliminated. Winners and losers brackets.",
  },
  round_robin: {
    label: "Round Robin",
    description: "Everyone plays everyone once. Thorough ranking by record.",
  },
  double_round_robin: {
    label: "Double Round Robin",
    description: "Everyone plays everyone twice. Common in league structures.",
  },
  combination: {
    label: "Combination (Two-Stage)",
    description: "Round-robin group stage followed by elimination knockout.",
  },
  swiss: {
    label: "Swiss System",
    description: "Paired by similar records each round. No elimination.",
  },
};

export type TournamentStatus = "draft" | "registration" | "active" | "completed" | "cancelled";
export type TournamentCreationMode = "quick" | "scheduled";
export type TournamentRegistrationMode = "invite_only" | "open" | "approval";
export type TournamentRegistrationStatus = "invited" | "pending" | "approved" | "declined" | "withdrawn";

/** Human-readable labels for tournament status badges */
export const tournamentStatusLabel: Record<TournamentStatus, string> = {
  draft: "Draft",
  registration: "Registration",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface Tournament {
  id: number;
  name: string;
  status: TournamentStatus;
  creationMode?: TournamentCreationMode;
  registrationMode?: TournamentRegistrationMode;
  startDate: string | null;
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
  id: number;
  userId: number;
  username: string;
  displayName: string | null;
}

export interface FriendRequest {
  id: number;
  userId: number;
  username: string;
  displayName: string | null;
}
