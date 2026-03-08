import type { TournamentStatus, TournamentFormat } from "@/types";
import type { Bracket } from "@/lib/generateBracket";

export interface TournamentParticipantData {
  seed: number;
  displayName: string;
  guestName: string | null;
  userId: number | null;
  teamId: number | null;
  type: "account" | "guest" | "team";
  membersSnapshot: { name: string; type: string; userId: number | null }[] | null;
  confirmed: boolean;
}

export interface TournamentData {
  id: number;
  name: string;
  game: string;
  description: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  isPrivate: boolean;
  max: number;
  bracketData: Bracket | null;
  startDate: string | null;
  creator: { id: number; username: string };
  participants: TournamentParticipantData[];
  createdAt: string;
  updatedAt: string;
}
