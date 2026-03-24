import type { TournamentStatus } from "@/types";

export type Filter = "all" | TournamentStatus;

export interface TournamentSummary {
  id: number;
  name: string;
  game: string;
  format: string;
  status: TournamentStatus;
  isPrivate: boolean;
  participants: number;
  max: number;
  creator: { id: number; username: string; displayName?: string | null };
  createdAt: string;
  startDate: string | null;
  startedAt: string | null;
  matchProgress?: { completed: number; total: number };
}
