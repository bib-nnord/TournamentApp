export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'double_round_robin' | 'combination' | 'swiss';
export type TournamentStatus = 'active' | 'completed' | 'cancelled';
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
  created_by: number;
  is_private: boolean;
  bracket_data: BracketData | null;

  constructor(data: {
    tournament_id: number;
    name: string;
    game: string;
    format: BracketFormat;
    status: TournamentStatus;
    created_by: number;
    is_private: boolean;
    bracket_data: BracketData | null;
  }) {
    this.tournament_id = data.tournament_id;
    this.name = data.name;
    this.game = data.game;
    this.format = data.format;
    this.status = data.status;
    this.created_by = data.created_by;
    this.is_private = data.is_private;
    this.bracket_data = data.bracket_data;
  }

  /**
   * Find a match by ID across all bracket sections.
   */
  findMatch(matchId: string): FindMatchResult | null {
    if (!this.bracket_data) return null;
    const bracket = this.bracket_data;

    // Tiebreaker match
    if (bracket.tiebreaker && bracket.tiebreaker.id === matchId) {
      return { match: bracket.tiebreaker as any as BracketMatch, section: 'tiebreaker', roundIndex: -1 };
    }

    // Winners / main rounds
    for (let roundIndex = 0; roundIndex < bracket.rounds.length; roundIndex++) {
      for (const match of bracket.rounds[roundIndex].matches) {
        if (match.id === matchId) return { match, section: 'winners', roundIndex };
      }
    }

    // Losers bracket
    if (bracket.losersRounds) {
      for (let roundIndex = 0; roundIndex < bracket.losersRounds.length; roundIndex++) {
        for (const match of bracket.losersRounds[roundIndex].matches) {
          if (match.id === matchId) return { match, section: 'losers', roundIndex };
        }
      }
    }

    // Group stages
    if (bracket.groups) {
      for (let groupIndex = 0; groupIndex < bracket.groups.length; groupIndex++) {
        const group = bracket.groups[groupIndex];
        for (let roundIndex = 0; roundIndex < group.rounds.length; roundIndex++) {
          for (const match of group.rounds[roundIndex].matches) {
            if (match.id === matchId) return { match, section: `group_${groupIndex}`, roundIndex };
          }
        }
      }
    }

    // Knockout rounds
    if (bracket.knockoutRounds) {
      for (let roundIndex = 0; roundIndex < bracket.knockoutRounds.length; roundIndex++) {
        for (const match of bracket.knockoutRounds[roundIndex].matches) {
          if (match.id === matchId) return { match, section: 'knockout', roundIndex };
        }
      }
    }

    return null;
  }

  /**
   * Check if a match is the true tournament final.
   */
  isTrueFinalMatch(section: BracketSection, roundIndex: number): boolean {
    if (!this.bracket_data) return false;
    const bracket = this.bracket_data;

    if (section === 'winners') {
      return bracket.format === 'single_elimination' && roundIndex === bracket.rounds.length - 1;
    }
    if (section === 'losers') {
      return roundIndex === (bracket.losersRounds?.length ?? 0) - 1;
    }
    if (section === 'knockout') {
      return roundIndex === (bracket.knockoutRounds?.length ?? 0) - 1;
    }
    return false;
  }

  /**
   * Find tied participants in round-robin/swiss formats.
   */
  findRRTiedParticipants(): string[] | null {
    if (!this.bracket_data?.rounds.length) return null;
    const bracket = this.bracket_data;
    const allMatches = bracket.rounds.flatMap((r) => r.matches);
    if (!allMatches.length || !allMatches.every((m) => m.completed)) return null;

    const points = new Map<string, number>();
    for (const match of allMatches) {
      if (match.participantA) points.set(match.participantA, points.get(match.participantA) ?? 0);
      if (match.participantB) points.set(match.participantB, points.get(match.participantB) ?? 0);
      if (match.winner) {
        points.set(match.winner, (points.get(match.winner) ?? 0) + 1);
      } else if (match.tie) {
        if (match.participantA) points.set(match.participantA, (points.get(match.participantA) ?? 0) + 0.5);
        if (match.participantB) points.set(match.participantB, (points.get(match.participantB) ?? 0) + 0.5);
      }
    }

    const sorted = [...points.entries()].sort((left, right) => right[1] - left[1]);
    if (!sorted.length) return null;
    const topPoints = sorted[0][1];
    const tied = sorted.filter(([, pointsValue]) => pointsValue === topPoints).map(([name]) => name);
    return tied.length > 1 ? tied : null;
  }

  /**
   * Extract all matches from all bracket sections.
   */
  extractAllMatches(): BracketMatch[] {
    if (!this.bracket_data) return [];
    const bracket = this.bracket_data;
    const matches: BracketMatch[] = [];

    if (bracket.rounds) {
      for (const round of bracket.rounds) matches.push(...round.matches);
    }
    if (bracket.losersRounds) {
      for (const round of bracket.losersRounds) matches.push(...round.matches);
    }
    if (bracket.groups) {
      for (const group of bracket.groups) {
        for (const round of group.rounds) matches.push(...round.matches);
      }
    }
    if (bracket.knockoutRounds) {
      for (const round of bracket.knockoutRounds) matches.push(...round.matches);
    }
    return matches;
  }

  /**
   * Advance the winner in single-elimination style.
   */
  private advanceSingleElim(rounds: BracketRound[], roundIndex: number, match: BracketMatch, winnerName: string | null): void {
    const nextRoundIndex = roundIndex + 1;
    if (nextRoundIndex >= rounds.length) return;

    const nextPosition = Math.floor(match.position / 2);
    const nextMatch = rounds[nextRoundIndex].matches.find((m) => m.position === nextPosition);
    if (!nextMatch) return;

    if (match.position % 2 === 0) {
      nextMatch.participantA = winnerName;
    } else {
      nextMatch.participantB = winnerName;
    }
  }

  /**
   * Drop loser from winners bracket to losers bracket.
   */
  private dropToLosers(winnersRoundIndex: number, match: BracketMatch, loserName: string | null): void {
    if (!this.bracket_data?.losersRounds) return;

    if (winnersRoundIndex === 0) {
      const losersMatch = this.bracket_data.losersRounds[0].matches.find(
        (m) => m.position === Math.floor(match.position / 2)
      );
      if (!losersMatch) return;
      if (match.position % 2 === 0) {
        losersMatch.participantA = loserName;
      } else {
        losersMatch.participantB = loserName;
      }
    } else {
      const losersIndex = 2 * winnersRoundIndex - 1;
      if (losersIndex >= this.bracket_data.losersRounds.length) return;
      const losersMatch = this.bracket_data.losersRounds[losersIndex].matches.find(
        (m) => m.position === match.position
      );
      if (losersMatch) losersMatch.participantB = loserName;
    }
  }

  /**
   * Advance winner in losers bracket.
   */
  private advanceLosers(roundIndex: number, match: BracketMatch, winnerName: string | null): void {
    if (!this.bracket_data?.losersRounds) return;

    const nextRoundIndex = roundIndex + 1;
    if (nextRoundIndex >= this.bracket_data.losersRounds.length) return;

    const isGrandFinal = nextRoundIndex === this.bracket_data.losersRounds.length - 1;
    if (isGrandFinal) {
      this.bracket_data.losersRounds[nextRoundIndex].matches[0].participantB = winnerName;
      return;
    }

    const losersRoundNumber = roundIndex + 1;
    if (losersRoundNumber % 2 === 1) {
      const nextMatch = this.bracket_data.losersRounds[nextRoundIndex].matches.find(
        (m) => m.position === match.position
      );
      if (nextMatch) nextMatch.participantA = winnerName;
    } else {
      const nextPosition = Math.floor(match.position / 2);
      const nextMatch = this.bracket_data.losersRounds[nextRoundIndex].matches.find(
        (m) => m.position === nextPosition
      );
      if (!nextMatch) return;
      if (match.position % 2 === 0) {
        nextMatch.participantA = winnerName;
      } else {
        nextMatch.participantB = winnerName;
      }
    }
  }

  /**
   * Generate seed positions for bracket seeding.
   */
  private generateSeedPositions(size: number): number[] {
    let positions = [1, 2];
    while (positions.length < size) {
      const next: number[] = [];
      const currentSize = positions.length * 2;
      for (const seed of positions) next.push(seed, currentSize + 1 - seed);
      positions = next;
    }
    return positions;
  }

  /**
   * Compute group standings by points and score differential.
   */
  private computeGroupStandings(group: BracketGroup): string[] | null {
    const points = new Map<string, number>();
    const scoreDiff = new Map<string, number>();
    for (const participant of group.participants) {
      points.set(participant, 0);
      scoreDiff.set(participant, 0);
    }

    for (const round of group.rounds) {
      for (const match of round.matches) {
        if (!match.completed) return null;
        if (match.winner) {
          points.set(match.winner, (points.get(match.winner) ?? 0) + 2);
        } else if (match.tie) {
          if (match.participantA) points.set(match.participantA, (points.get(match.participantA) ?? 0) + 1);
          if (match.participantB) points.set(match.participantB, (points.get(match.participantB) ?? 0) + 1);
        }
        if (match.scoreA != null && match.participantA) {
          scoreDiff.set(match.participantA, (scoreDiff.get(match.participantA) ?? 0) + match.scoreA - (match.scoreB ?? 0));
        }
        if (match.scoreB != null && match.participantB) {
          scoreDiff.set(match.participantB, (scoreDiff.get(match.participantB) ?? 0) + match.scoreB - (match.scoreA ?? 0));
        }
      }
    }

    return [...group.participants].sort((left, right) => {
      const pointsDiff = (points.get(right) ?? 0) - (points.get(left) ?? 0);
      return pointsDiff !== 0 ? pointsDiff : (scoreDiff.get(right) ?? 0) - (scoreDiff.get(left) ?? 0);
    });
  }

  /**
   * Populate knockout bracket from group standings.
   */
  private populateKnockoutFromGroups(): void {
    if (!this.bracket_data?.knockoutRounds?.length || !this.bracket_data.groups) return;

    const regularGroups = this.bracket_data.groups.filter((g) => !g.autoAdvance);
    const autoAdvanceGroups = this.bracket_data.groups.filter((g) => g.autoAdvance);
    const advancersPerGroup = this.bracket_data.advancersPerGroup ?? 2;

    const advancers: Array<string | null> = [];
    for (const group of regularGroups) {
      const standings = this.computeGroupStandings(group);
      if (!standings) return;
      for (let i = 0; i < advancersPerGroup; i++) advancers.push(standings[i] ?? null);
    }
    for (const group of autoAdvanceGroups) {
      for (const participant of group.participants) advancers.push(participant);
    }

    const roundOne = this.bracket_data.knockoutRounds[0];
    if (!roundOne) return;

    const knockoutSize = (roundOne.matches?.[0]?.position ?? 0) > 0 ? roundOne.matches.length * 2 : roundOne.matches.length;
    const seeds = this.generateSeedPositions(knockoutSize);

    while (advancers.length < knockoutSize) advancers.push(null);

    for (let i = 0; i < seeds.length; i += 2) {
      const advancerA = advancers[seeds[i] - 1] ?? null;
      const advancerB = advancers[seeds[i + 1] - 1] ?? null;
      const matchPosition = i / 2;
      const match = roundOne.matches.find((m) => m.position === matchPosition);
      if (!match) continue;

      if ((!match.participantA || match.participantA === 'TBD') && advancerA) match.participantA = advancerA;
      if ((!match.participantB || match.participantB === 'TBD') && advancerB) match.participantB = advancerB;
    }
  }

  /**
   * Advance bracket state after a match result.
   */
  advanceBracket(section: BracketSection, roundIndex: number, match: BracketMatch, winnerName: string | null, loserName: string | null): void {
    if (!this.bracket_data) return;
    const bracket = this.bracket_data;
    const format = bracket.format;

    if (section === 'winners') {
      if (format === 'single_elimination') {
        this.advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
      } else if (format === 'double_elimination') {
        this.advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
        this.dropToLosers(roundIndex, match, loserName);
        if (roundIndex === bracket.rounds.length - 1 && bracket.losersRounds) {
          const grandFinal = bracket.losersRounds[bracket.losersRounds.length - 1];
          grandFinal.matches[0].participantA = winnerName;
        }
      } else if (format === 'combination') {
        this.advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
      }
    } else if (section === 'losers') {
      const isGrandFinal = roundIndex === bracket.losersRounds?.length! - 1;
      if (!isGrandFinal) {
        this.advanceLosers(roundIndex, match, winnerName);
      }
    } else if (section === 'knockout') {
      this.advanceSingleElim(bracket.knockoutRounds!, roundIndex, match, winnerName);
    } else if (section.startsWith('group_')) {
      this.populateKnockoutFromGroups();
    }
  }

  /**
   * Clear a participant from all bracket rounds and groups.
   */
  clearParticipant(name: string): void {
    if (!this.bracket_data) return;
    const bracket = this.bracket_data;

    const clearFromRounds = (rounds: BracketRound[] | undefined) => {
      if (!rounds) return;
      for (const round of rounds) {
        for (const match of round.matches) {
          if (match.participantA === name) match.participantA = null;
          if (match.participantB === name) match.participantB = null;
          if (match.winner === name) {
            match.winner = null;
            match.completed = false;
          }
        }
      }
    };

    clearFromRounds(bracket.rounds);
    clearFromRounds(bracket.losersRounds);
    clearFromRounds(bracket.knockoutRounds);
    if (bracket.groups) {
      for (const group of bracket.groups) {
        clearFromRounds(group.rounds);
        if (group.participants) {
          group.participants = group.participants.filter((participant: string) => participant !== name);
        }
      }
    }
  }
}

export default Tournament;
