import type { TournamentFormat, TournamentRegistrationMode } from "@/types";

export interface ScheduledInvite {
  type: "account" | "team";
  userId?: number;
  username?: string;
  teamId?: number;
  displayName?: string;
}

export interface ScheduledTournamentData {
  name: string;
  discipline: string;
  description: string;
  format: TournamentFormat;
  isPrivate: boolean;
  registrationMode: TournamentRegistrationMode;
  maxParticipants: number | null;
  startDate: string;
  registrationClosesAt: string;
  teamMode: boolean;
  invites: ScheduledInvite[];
}
