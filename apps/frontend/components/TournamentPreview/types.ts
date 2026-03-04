import type { Bracket } from "@/lib/generateBracket";
import type { QuickTournamentData } from "../QuickTournamentForm/types";

export interface TournamentPreviewProps {
  data: QuickTournamentData;
  onBack: () => void;
  onConfirm: (data: QuickTournamentData, bracket: Bracket) => void;
  submitting?: boolean;
  submitError?: string | null;
}
