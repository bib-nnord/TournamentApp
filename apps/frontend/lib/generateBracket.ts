import type { TournamentFormat } from "@/types";

export interface BracketMatch {
  id: string;
  /** 1-based round number */
  round: number;
  /** Position within the round (0-based) */
  position: number;
  participantA: string | null;
  participantB: string | null;
  /** Which slots receive a drop-down from the winners bracket */
  wbDropDown?: "a" | "b" | "both";
  /** Result fields — populated after the match is played */
  winner?: string | null;
  scoreA?: number | null;
  scoreB?: number | null;
  completed?: boolean;
  tie?: boolean;
}

export interface BracketRound {
  name: string;
  matches: BracketMatch[];
  /** Full number of match slots in this round (including removed byes). Used for layout. */
  totalPositions?: number;
  /** Losers bracket: this round receives drop-downs from the winners bracket */
  isDropDown?: boolean;
}

export interface TiebreakerMatch {
  id: string;
  /** All participants who are tied (2 for elimination finals, 2+ for round robin) */
  participants: string[];
  winner?: string | null;
  completed?: boolean;
}

export interface Bracket {
  format: TournamentFormat;
  rounds: BracketRound[];
  /** Double elimination only */
  losersRounds?: BracketRound[];
  /** Combination only: group stage as round-robin groups */
  groups?: { name: string; participants: string[]; rounds: BracketRound[]; autoAdvance?: boolean }[];
  /** Combination only: knockout stage following group stage */
  knockoutRounds?: BracketRound[];
  /** Combination only: how many players advance from each regular group */
  advancersPerGroup?: number;
  /** Set when the final match (or final standings) ends in a tie */
  tiebreaker?: TiebreakerMatch;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0;
function nextId() {
  return `m-${++idCounter}`;
}

function resetIds() {
  idCounter = 0;
}

function roundName(round: number, total: number): string {
  if (round === total) return "Final";
  if (round === total - 1) return "Semi-finals";
  if (round === total - 2) return "Quarter-finals";
  return `Round ${round}`;
}

// ─── Single Elimination ───────────────────────────────────────────────────────

/**
 * Generate standard tournament seed positions for a bracket of size `size`.
 * E.g. size=8 → [1, 8, 4, 5, 2, 7, 3, 6] — ensures top seeds are spread
 * across the bracket and meet latest if they keep winning.
 */
function generateSeedPositions(size: number): number[] {
  let positions = [1, 2];
  while (positions.length < size) {
    const next: number[] = [];
    const currentSize = positions.length * 2;
    for (const seed of positions) {
      next.push(seed, currentSize + 1 - seed);
    }
    positions = next;
  }
  return positions;
}

function generateSingleElimination(participants: string[]): BracketRound[] {
  const n = participants.length;
  if (n < 2) return [];

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const totalRounds = Math.log2(bracketSize);
  const rounds: BracketRound[] = [];

  // Use standard seeding so byes go to top seeds and are spread evenly
  const seeds = generateSeedPositions(bracketSize);

  // Round 1: pair seeds using the seeding order; seeds > n become byes (null)
  const r1Matches: BracketMatch[] = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const seedA = seeds[i];
    const seedB = seeds[i + 1];
    const a = seedA <= n ? participants[seedA - 1] : null;
    const b = seedB <= n ? participants[seedB - 1] : null;
    r1Matches.push({
      id: nextId(),
      round: 1,
      position: i / 2,
      participantA: a,
      participantB: b,
    });
  }
  const r1FullCount = r1Matches.length;
  rounds.push({ name: roundName(1, totalRounds), matches: r1Matches, totalPositions: r1FullCount });

  // Subsequent rounds (round 2 to final)
  for (let r = 2; r <= totalRounds; r++) {
    const matchCount = bracketSize / Math.pow(2, r);
    const matches: BracketMatch[] = [];
    for (let p = 0; p < matchCount; p++) {
      matches.push({
        id: nextId(),
        round: r,
        position: p,
        participantA: null,
        participantB: null,
      });
    }
    rounds.push({ name: roundName(r, totalRounds), matches });
  }

  // Resolve byes: advance bye winners into round 2, then remove bye matches
  if (rounds.length > 1) {
    const r1 = rounds[0];
    const r2 = rounds[1];
    for (const match of r1.matches) {
      const aIsNull = match.participantA === null;
      const bIsNull = match.participantB === null;
      if (aIsNull || bIsNull) {
        const winner = match.participantA ?? match.participantB;
        if (winner) {
          const r2Match = r2.matches[Math.floor(match.position / 2)];
          if (match.position % 2 === 0) r2Match.participantA = winner;
          else r2Match.participantB = winner;
        }
      }
    }
    // Keep only real matches (both sides filled)
    r1.matches = r1.matches.filter(m => m.participantA !== null && m.participantB !== null);
    // If round 1 is empty (all byes), remove it
    if (r1.matches.length === 0) rounds.shift();
  }

  return rounds;
}

// ─── Double Elimination ───────────────────────────────────────────────────────

function generateDoubleElimination(participants: string[]): { winners: BracketRound[]; losers: BracketRound[] } {
  const n = participants.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const winnersRoundCount = Math.log2(bracketSize);

  const winners = generateSingleElimination(participants);

  // Losers bracket structure (for bracket size N):
  //   Rounds come in pairs — each pair halves the match count:
  //     LR1 (pairing):  N/4 matches — WR1 losers pair up
  //     LR2 (drop-down): N/4 matches — LR1 winners face WR2 losers
  //     LR3 (pairing):  N/8 matches — LR2 winners pair up
  //     LR4 (drop-down): N/8 matches — LR3 winners face WR3 losers
  //     ...continues until Losers Final (1 match)
  //   Then Grand Final: winners champion vs losers champion
  const losersRoundCount = Math.max(1, (winnersRoundCount - 1) * 2);
  const losers: BracketRound[] = [];

  let matchesInRound = Math.max(1, bracketSize / 4);
  for (let r = 1; r <= losersRoundCount; r++) {
    const isEvenRound = r % 2 === 0;
    const matches: BracketMatch[] = [];
    for (let p = 0; p < matchesInRound; p++) {
      matches.push({
        id: nextId(),
        round: r,
        position: p,
        participantA: null,
        participantB: null,
        // LR1: both slots are WR1 losers; even rounds: one slot drops from WB
        wbDropDown: r === 1 ? "both" : isEvenRound ? "b" : undefined,
      });
    }
    // LR1 receives all WR1 losers; even rounds receive drop-downs from later WB rounds
    const receivesFromWB = r === 1 || isEvenRound;
    losers.push({
      name: matchesInRound === 1 && r === losersRoundCount ? "Losers Final" : `Losers Round ${r}`,
      matches,
      totalPositions: matchesInRound,
      isDropDown: receivesFromWB,
    });
    // Match count halves after each pair of rounds (pairing + drop-down)
    if (isEvenRound) matchesInRound = Math.max(1, Math.ceil(matchesInRound / 2));
  }

  // Grand final: winners champion vs losers champion
  losers.push({
    name: "Grand Final",
    matches: [{ id: nextId(), round: losersRoundCount + 1, position: 0, participantA: null, participantB: null }],
  });

  return { winners, losers };
}

// ─── Round Robin ──────────────────────────────────────────────────────────────

function generateRoundRobin(participants: string[], double = false): BracketRound[] {
  const list = [...participants];
  // If odd, add a BYE
  if (list.length % 2 !== 0) list.push("BYE");

  const n = list.length;
  const totalRealRounds = n - 1;
  const totalIterations = double ? 2 : 1;
  const rounds: BracketRound[] = [];

  for (let iter = 0; iter < totalIterations; iter++) {
    const rotatable = [...list];
    for (let r = 0; r < totalRealRounds; r++) {
      const roundNum = iter * totalRealRounds + r + 1;
      const matches: BracketMatch[] = [];
      for (let i = 0; i < n / 2; i++) {
        const a = rotatable[i];
        const b = rotatable[n - 1 - i];
        if (a === "BYE" || b === "BYE") continue;
        matches.push({
          id: nextId(),
          round: roundNum,
          position: matches.length,
          participantA: iter === 0 ? a : b,
          participantB: iter === 0 ? b : a,
        });
      }
      const label = double ? `Round ${roundNum}` : `Round ${roundNum}`;
      rounds.push({ name: label, matches });

      // Rotate: keep first element fixed, rotate the rest
      const last = rotatable.pop()!;
      rotatable.splice(1, 0, last);
    }
  }

  return rounds;
}

// ─── Swiss System ─────────────────────────────────────────────────────────────

function generateSwiss(participants: string[]): BracketRound[] {
  // Swiss typically runs ceil(log2(n)) rounds
  const roundCount = Math.max(1, Math.ceil(Math.log2(participants.length)));
  const rounds: BracketRound[] = [];

  // Only generate round 1 pairings; subsequent rounds depend on results
  const seeded = [...participants];
  const matchesR1: BracketMatch[] = [];
  for (let i = 0; i < seeded.length; i += 2) {
    matchesR1.push({
      id: nextId(),
      round: 1,
      position: i / 2,
      participantA: seeded[i],
      participantB: i + 1 < seeded.length ? seeded[i + 1] : null,
    });
  }
  rounds.push({ name: "Round 1", matches: matchesR1 });

  for (let r = 2; r <= roundCount; r++) {
    const matchCount = Math.floor(participants.length / 2);
    const matches: BracketMatch[] = [];
    for (let p = 0; p < matchCount; p++) {
      matches.push({
        id: nextId(),
        round: r,
        position: p,
        participantA: null,
        participantB: null,
      });
    }
    rounds.push({ name: `Round ${r}`, matches });
  }

  return rounds;
}

// ─── Combination (Groups + Knockout) ──────────────────────────────────────────

function generateCombination(
  participants: string[],
  advancersPerGroup = 2,
  autoAdvanceGroups: string[][] = [],
): {
  groups: { name: string; participants: string[]; rounds: BracketRound[]; autoAdvance?: boolean }[];
  knockoutRounds: BracketRound[];
} {
  // Filter out participants that are in auto-advance groups
  const autoAdvanceNames = new Set(autoAdvanceGroups.flat());
  const regularParticipants = participants.filter(p => !autoAdvanceNames.has(p));

  // Split into groups of 4 (or 3 if needed)
  const groupSize = 4;
  const groupCount = Math.max(2, Math.ceil(regularParticipants.length / groupSize));
  const groups: { name: string; participants: string[]; rounds: BracketRound[]; autoAdvance?: boolean }[] = [];

  for (let g = 0; g < groupCount; g++) {
    const groupParticipants = regularParticipants.slice(g * groupSize, (g + 1) * groupSize);
    const groupName = `Group ${String.fromCharCode(65 + g)}`;
    const rounds = groupParticipants.length >= 2 ? generateRoundRobin(groupParticipants) : [];
    groups.push({ name: groupName, participants: groupParticipants, rounds });
  }

  // Auto-advance groups: all members advance, no round-robin
  for (let a = 0; a < autoAdvanceGroups.length; a++) {
    const groupName = `Group ${String.fromCharCode(65 + groupCount + a)}`;
    groups.push({ name: groupName, participants: autoAdvanceGroups[a], rounds: [], autoAdvance: true });
  }

  // Knockout: top N from each regular group + all auto-advance members
  const regularAdvancing = Math.min(groupCount * advancersPerGroup, regularParticipants.length);
  const autoAdvancing = autoAdvanceGroups.reduce((sum, g) => sum + g.length, 0);
  const advancingCount = regularAdvancing + autoAdvancing;
  const knockoutSize = Math.pow(2, Math.ceil(Math.log2(Math.max(advancingCount, 2))));
  const knockoutParticipants: string[] = [];
  for (let i = 0; i < knockoutSize; i++) {
    knockoutParticipants.push(`TBD`);
  }
  const knockoutRounds = generateSingleElimination(knockoutParticipants);

  return { groups, knockoutRounds };
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

export interface BracketOptions {
  advancersPerGroup?: number;
  autoAdvanceGroups?: string[][];
}

export function generateBracket(participants: string[], format: TournamentFormat, options?: BracketOptions): Bracket {
  resetIds();

  switch (format) {
    case "single_elimination":
      return { format, rounds: generateSingleElimination(participants) };

    case "double_elimination": {
      const { winners, losers } = generateDoubleElimination(participants);
      return { format, rounds: winners, losersRounds: losers };
    }

    case "round_robin":
      return { format, rounds: generateRoundRobin(participants) };

    case "double_round_robin":
      return { format, rounds: generateRoundRobin(participants, true) };

    case "swiss":
      return { format, rounds: generateSwiss(participants) };

    case "combination": {
      const { groups, knockoutRounds } = generateCombination(
        participants,
        options?.advancersPerGroup,
        options?.autoAdvanceGroups,
      );
      return { format, rounds: [], groups, knockoutRounds, advancersPerGroup: options?.advancersPerGroup ?? 2 };
    }
  }
}
