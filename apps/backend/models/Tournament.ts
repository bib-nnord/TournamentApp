export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'double_round_robin' | 'combination' | 'swiss';
export type TournamentStatus = 'draft' | 'registration' | 'active' | 'completed' | 'cancelled';
export type TournamentCreationMode = 'quick' | 'scheduled';
export type TournamentRegistrationMode = 'invite_only' | 'open' | 'approval';
export type BracketSection = 'tiebreaker' | 'winners' | 'losers' | 'knockout' | string;

export interface BracketMatch {
  id: string;
  position: number;
  participantA: string | null;
  participantB: string | null;
  winner: string | null;
  tie: boolean;
  completed: boolean;
  scoreA: number | null;
  scoreB: number | null;
}

export interface BracketRound {
  matches: BracketMatch[];
}

export interface BracketGroup {
  participants: string[];
  rounds: BracketRound[];
  autoAdvance?: boolean;
}

export interface BracketTiebreaker {
  id: string;
  participants: string[];
  winner?: string | null;
  completed?: boolean;
}

export interface BracketData {
  format: BracketFormat;
  allowTies?: boolean;
  rounds: BracketRound[];
  losersRounds?: BracketRound[];
  knockoutRounds?: BracketRound[];
  groups?: BracketGroup[];
  tiebreaker?: BracketTiebreaker;
  advancersPerGroup?: number;
}

export interface FindMatchResult {
  match: BracketMatch;
  section: BracketSection;
  roundIndex: number;
}

class Tournament {
  tournament_id: number;
  name: string;
  game: string;
  format: BracketFormat;
  status: TournamentStatus;
  creation_mode: TournamentCreationMode;
  registration_mode: TournamentRegistrationMode;
  created_by: number;
  is_private: boolean;
  bracket_data: BracketData | null;
  preview_bracket_data: BracketData | null;

  constructor(data: {
    tournament_id: number;
    name: string;
    game: string;
    format: BracketFormat;
    status: TournamentStatus;
    creation_mode?: TournamentCreationMode;
    registration_mode?: TournamentRegistrationMode;
    created_by: number;
    is_private: boolean;
    bracket_data: BracketData | null;
    preview_bracket_data?: BracketData | null;
  }) {
    this.tournament_id = data.tournament_id;
    this.name = data.name;
    this.game = data.game;
    this.format = data.format;
    this.status = data.status;
    this.creation_mode = data.creation_mode ?? 'quick';
    this.registration_mode = data.registration_mode ?? 'invite_only';
    this.created_by = data.created_by;
    this.is_private = data.is_private;
    this.bracket_data = data.bracket_data;
    this.preview_bracket_data = data.preview_bracket_data ?? null;
  }
}

export default Tournament;
