import type { QuickTournamentData } from "@/components/QuickTournamentForm";

export interface SavedDraft {
  step: "form" | "preview";
  data: QuickTournamentData;
  savedAt: number;
}
