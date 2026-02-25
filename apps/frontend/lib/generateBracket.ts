import type { TournamentFormat } from "@/types";

export interface BracketMatch {
  id: string;
  /** 1-based round number */
  round: number;
  /** Position within the round (0-based) */
  position: number;
  participantA: string | null;
  participantB: string | null;
}

export interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

export interface Bracket {
  format: TournamentFormat;
  rounds: BracketRound[];
  /** Double elimination only */
  losersRounds?: BracketRound[];
  /** Combination only: group stage as round-robin groups */
  groups?: { name: string; participants: string[]; rounds: BracketRound[] }[];
  /** Combination only: knockout stage following group stage */
  knockoutRounds?: BracketRound[];
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

function generateSingleElimination(participants: string[]): BracketRound[] {
  const n = participants.length;
  if (n < 2) return [];

  // If n is a power of 2, no prelims needed — mainSize = n
  // Otherwise, mainSize = largest power of 2 ≤ n, and extras play a preliminary round
  const isPow2 = (n & (n - 1)) === 0;
  const mainSize = isPow2 ? n : Math.pow(2, Math.floor(Math.log2(n)));
  const extras = n - mainSize; // number of extra players beyond mainSize
  // extras players need to be paired into preliminary matches
  // 2 * extras players compete in prelims, winners fill the bottom slots of round 1
  // the top (mainSize - extras) players go directly to round 1

  const directCount = mainSize - extras;
  const directPlayers = participants.slice(0, directCount);
  const prelimPlayers = participants.slice(directCount); // 2 * extras players

  const mainRounds = Math.log2(mainSize);
  const rounds: BracketRound[] = [];

  // Preliminary round (only if not a power of 2)
  if (extras > 0) {
    const prelimMatches: BracketMatch[] = [];
    for (let i = 0; i < prelimPlayers.length; i += 2) {
      prelimMatches.push({
        id: nextId(),
        round: 0,
        position: i / 2,
        participantA: prelimPlayers[i],
        participantB: i + 1 < prelimPlayers.length ? prelimPlayers[i + 1] : null,
      });
    }
    rounds.push({ name: "Preliminary", matches: prelimMatches });
  }

  // Round 1: mainSize / 2 matches
  // Top seeds (direct players) fill slots from the top
  // Preliminary winners fill the remaining bottom slots (shown as TBD)
  const r1Matches: BracketMatch[] = [];
  for (let i = 0; i < mainSize; i += 2) {
    const slotA = i < directCount ? directPlayers[i] : null;
    const slotB = i + 1 < directCount ? directPlayers[i + 1] : null;
    r1Matches.push({
      id: nextId(),
      round: 1,
      position: i / 2,
      participantA: slotA,
      participantB: slotB,
    });
  }
  rounds.push({ name: roundName(1, mainRounds), matches: r1Matches });

  // Subsequent rounds (round 2 to final)
  for (let r = 2; r <= mainRounds; r++) {
    const matchCount = mainSize / Math.pow(2, r);
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
    rounds.push({ name: roundName(r, mainRounds), matches });
  }

  return rounds;
}

// ─── Double Elimination ───────────────────────────────────────────────────────

function generateDoubleElimination(participants: string[]): { winners: BracketRound[]; losers: BracketRound[] } {
  const winners = generateSingleElimination(participants);

  // Losers bracket has (totalWinnerRounds - 1) * 2 rounds roughly
  const totalWinnerRounds = winners.length;
  const losersRoundCount = Math.max(1, (totalWinnerRounds - 1) * 2);
  const losers: BracketRound[] = [];

  let matchesInRound = Math.floor(participants.length / 4);
  for (let r = 1; r <= losersRoundCount; r++) {
    matchesInRound = Math.max(1, matchesInRound);
    const matches: BracketMatch[] = [];
    for (let p = 0; p < matchesInRound; p++) {
      matches.push({
        id: nextId(),
        round: r,
        position: p,
        participantA: null,
        participantB: null,
      });
    }
    losers.push({ name: `Losers Round ${r}`, matches });
    // Every other round halves the matches
    if (r % 2 === 0) matchesInRound = Math.ceil(matchesInRound / 2);
  }

  // Grand final
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

function generateCombination(participants: string[]): {
  groups: { name: string; participants: string[]; rounds: BracketRound[] }[];
  knockoutRounds: BracketRound[];
} {
  // Split into groups of 4 (or 3 if needed)
  const groupSize = 4;
  const groupCount = Math.max(2, Math.ceil(participants.length / groupSize));
  const groups: { name: string; participants: string[]; rounds: BracketRound[] }[] = [];

  for (let g = 0; g < groupCount; g++) {
    const groupParticipants = participants.slice(g * groupSize, (g + 1) * groupSize);
    const groupName = `Group ${String.fromCharCode(65 + g)}`;
    const rounds = groupParticipants.length >= 2 ? generateRoundRobin(groupParticipants) : [];
    groups.push({ name: groupName, participants: groupParticipants, rounds });
  }

  // Knockout: top 2 from each group advance (placeholder)
  const advancingCount = Math.min(groupCount * 2, participants.length);
  const knockoutSize = Math.pow(2, Math.ceil(Math.log2(Math.max(advancingCount, 2))));
  const knockoutParticipants: string[] = [];
  for (let i = 0; i < knockoutSize; i++) {
    knockoutParticipants.push(`TBD`);
  }
  const knockoutRounds = generateSingleElimination(knockoutParticipants);

  return { groups, knockoutRounds };
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

export function generateBracket(participants: string[], format: TournamentFormat): Bracket {
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
      const { groups, knockoutRounds } = generateCombination(participants);
      return { format, rounds: [], groups, knockoutRounds };
    }
  }
}
