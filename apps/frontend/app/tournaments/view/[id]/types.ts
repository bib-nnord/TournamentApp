import type { TournamentStatus, TournamentFormat, TournamentCreationMode, TournamentRegistrationMode, TournamentRegistrationStatus } from "@/types";
import type { Bracket } from "@/lib/generateBracket";

export interface TournamentParticipantData {
  seed: number;
  displayName: string;
  username: string | null;
  guestName: string | null;
  userId: number | null;
  teamId: number | null;
  type: "account" | "guest" | "team";
  membersSnapshot: { name: string; type: string; userId: number | null }[] | null;
  confirmed: boolean;
  declined: boolean;
  registrationStatus?: TournamentRegistrationStatus;
}

export interface TeamAssignment {
  name: string;
  memberSeeds: number[];
  members: { seed: number; displayName: string; userId: number | null }[];
}

export interface TournamentData {
  id: number;
  name: string;
  game: string;
  description: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  creationMode?: TournamentCreationMode;
  registrationMode?: TournamentRegistrationMode;
  isPrivate: boolean;
  max: number;
  bracketData: Bracket | null;
  previewBracketData?: Bracket | null;
  startDate: string | null;
  registrationClosesAt?: string | null;
  autoStart?: boolean;
  teamMode?: boolean;
  teamAssignments?: TeamAssignment[] | null;
  startedAt?: string | null;
  creator: { id: number; username: string; displayName?: string | null };
  participants: TournamentParticipantData[];
  createdAt: string;
  updatedAt: string;
}
