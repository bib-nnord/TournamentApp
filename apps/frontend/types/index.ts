// ─── Tournaments ─────────────────────────────────────────────────────────────

export type TournamentStatus = "upcoming" | "active" | "past";

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
