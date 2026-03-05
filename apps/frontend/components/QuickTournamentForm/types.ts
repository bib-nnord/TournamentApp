import type { TournamentFormat, TournamentStatus } from "@/types";

export type ParticipantMemberType = "account" | "guest";

export interface ParticipantMember {
  name: string;
  type: ParticipantMemberType;
}

export interface TournamentTeam {
  name: string;
  members: ParticipantMember[];
  existingTeamId?: number;
}

export interface Participant {
  name: string;
  type: ParticipantMemberType | "team";
  members?: ParticipantMember[];
  /** If this team came from the database, store its ID */
  existingTeamId?: number;
}

export interface TeamSearchResult {
  id: number;
  name: string;
  description: string | null;
  members: { userId: number; username: string; displayName: string | null; role: string }[];
}

export interface QuickTournamentData {
  name: string;
  game: string;
  description: string;
  format: TournamentFormat;
  participants: Participant[];
  isPrivate: boolean;
  teamMode: boolean;
  /** Optional status override (defaults to 'active' for quick tournaments) */
  status?: TournamentStatus;
  /** Optional start date/time for the tournament */
  startDate?: string;
  /** Combination format: how many participants advance from each group (default 2) */
  advancersPerGroup?: number;
  /** Whether ties are allowed as a match result (default: true) */
  allowTies?: boolean;
}
