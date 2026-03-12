import Tournament, {
  BracketFormat,
  BracketMatch,
  BracketRound,
  BracketSection,
  BracketGroup,
  FindMatchResult,
} from '../models/Tournament';

/**
 * Find a match by ID across all bracket sections.
 */
export function findMatch(tournament: Tournament, matchId: string): FindMatchResult | null {
  if (!tournament.bracket_data) return null;
  const bracket = tournament.bracket_data;

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
export function isTrueFinalMatch(tournament: Tournament, section: BracketSection, roundIndex: number): boolean {
  if (!tournament.bracket_data) return false;
  const bracket = tournament.bracket_data;

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
export function findRRTiedParticipants(tournament: Tournament): string[] | null {
  if (!tournament.bracket_data?.rounds.length) return null;
  const bracket = tournament.bracket_data;
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
export function extractAllMatches(tournament: Tournament): BracketMatch[] {
  if (!tournament.bracket_data) return [];
  const bracket = tournament.bracket_data;
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
function advanceSingleElim(rounds: BracketRound[], roundIndex: number, match: BracketMatch, winnerName: string | null): void {
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
function dropToLosers(tournament: Tournament, winnersRoundIndex: number, match: BracketMatch, loserName: string | null): void {
  if (!tournament.bracket_data?.losersRounds) return;

  if (winnersRoundIndex === 0) {
    const losersMatch = tournament.bracket_data.losersRounds[0].matches.find(
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
    if (losersIndex >= tournament.bracket_data.losersRounds.length) return;
    const losersMatch = tournament.bracket_data.losersRounds[losersIndex].matches.find(
      (m) => m.position === match.position
    );
    if (losersMatch) losersMatch.participantB = loserName;
  }
}

/**
 * Advance winner in losers bracket.
 */
function advanceLosers(tournament: Tournament, roundIndex: number, match: BracketMatch, winnerName: string | null): void {
  if (!tournament.bracket_data?.losersRounds) return;

  const nextRoundIndex = roundIndex + 1;
  if (nextRoundIndex >= tournament.bracket_data.losersRounds.length) return;

  const isGrandFinal = nextRoundIndex === tournament.bracket_data.losersRounds.length - 1;
  if (isGrandFinal) {
    tournament.bracket_data.losersRounds[nextRoundIndex].matches[0].participantB = winnerName;
    return;
  }

  const losersRoundNumber = roundIndex + 1;
  if (losersRoundNumber % 2 === 1) {
    const nextMatch = tournament.bracket_data.losersRounds[nextRoundIndex].matches.find(
      (m) => m.position === match.position
    );
    if (nextMatch) nextMatch.participantA = winnerName;
  } else {
    const nextPosition = Math.floor(match.position / 2);
    const nextMatch = tournament.bracket_data.losersRounds[nextRoundIndex].matches.find(
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
function generateSeedPositions(size: number): number[] {
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
function computeGroupStandings(group: BracketGroup): string[] | null {
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
function populateKnockoutFromGroups(tournament: Tournament): void {
  if (!tournament.bracket_data?.knockoutRounds?.length || !tournament.bracket_data.groups) return;

  const regularGroups = tournament.bracket_data.groups.filter((g) => !g.autoAdvance);
  const autoAdvanceGroups = tournament.bracket_data.groups.filter((g) => g.autoAdvance);
  const advancersPerGroup = tournament.bracket_data.advancersPerGroup ?? 2;

  const advancers: Array<string | null> = [];
  for (const group of regularGroups) {
    const standings = computeGroupStandings(group);
    if (!standings) return;
    for (let i = 0; i < advancersPerGroup; i++) advancers.push(standings[i] ?? null);
  }
  for (const group of autoAdvanceGroups) {
    for (const participant of group.participants) advancers.push(participant);
  }

  const roundOne = tournament.bracket_data.knockoutRounds[0];
  if (!roundOne) return;

  const knockoutSize = (roundOne.matches?.[0]?.position ?? 0) > 0 ? roundOne.matches.length * 2 : roundOne.matches.length;
  const seeds = generateSeedPositions(knockoutSize);

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
export function advanceBracket(
  tournament: Tournament,
  section: BracketSection,
  roundIndex: number,
  match: BracketMatch,
  winnerName: string | null,
  loserName: string | null
): void {
  if (!tournament.bracket_data) return;
  const bracket = tournament.bracket_data;
  const format = bracket.format;

  if (section === 'winners') {
    if (format === 'single_elimination') {
      advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
    } else if (format === 'double_elimination') {
      advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
      dropToLosers(tournament, roundIndex, match, loserName);
      if (roundIndex === bracket.rounds.length - 1 && bracket.losersRounds) {
        const grandFinal = bracket.losersRounds[bracket.losersRounds.length - 1];
        grandFinal.matches[0].participantA = winnerName;
      }
    } else if (format === 'combination') {
      advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
    }
  } else if (section === 'losers') {
    const isGrandFinal = roundIndex === bracket.losersRounds?.length! - 1;
    if (!isGrandFinal) {
      advanceLosers(tournament, roundIndex, match, winnerName);
    }
  } else if (section === 'knockout') {
    advanceSingleElim(bracket.knockoutRounds!, roundIndex, match, winnerName);
  } else if (section.startsWith('group_')) {
    populateKnockoutFromGroups(tournament);
  }
}

/**
 * Clear a participant from all bracket rounds and groups.
 */
export function clearParticipant(tournament: Tournament, name: string): void {
  if (!tournament.bracket_data) return;
  const bracket = tournament.bracket_data;

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
