import type { BracketData, BracketFormat, BracketRound } from '../models/Tournament';

interface BracketMatch {
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

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `m-${idCounter}`;
}

function resetIds(): void {
  idCounter = 0;
}

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

function createMatch(position: number, participantA: string | null, participantB: string | null): BracketMatch {
  return {
    id: nextId(),
    position,
    participantA,
    participantB,
    winner: null,
    tie: false,
    completed: false,
    scoreA: null,
    scoreB: null,
  };
}

function generateSingleElimination(participants: string[]): BracketRound[] {
  const totalParticipants = participants.length;
  if (totalParticipants < 2) return [];

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalParticipants)));
  const roundsTotal = Math.log2(bracketSize);
  const rounds: BracketRound[] = [];
  const seeds = generateSeedPositions(bracketSize);

  const firstRoundMatches: BracketMatch[] = [];
  for (let index = 0; index < bracketSize; index += 2) {
    const seedA = seeds[index];
    const seedB = seeds[index + 1];
    const participantA = seedA <= totalParticipants ? participants[seedA - 1] : null;
    const participantB = seedB <= totalParticipants ? participants[seedB - 1] : null;
    firstRoundMatches.push(createMatch(index / 2, participantA, participantB));
  }
  rounds.push({ matches: firstRoundMatches });

  for (let roundIndex = 2; roundIndex <= roundsTotal; roundIndex++) {
    const matchCount = bracketSize / Math.pow(2, roundIndex);
    const matches: BracketMatch[] = [];
    for (let position = 0; position < matchCount; position += 1) {
      matches.push(createMatch(position, null, null));
    }
    rounds.push({ matches });
  }

  if (rounds.length > 1) {
    const roundOne = rounds[0];
    const roundTwo = rounds[1];
    for (const match of roundOne.matches as BracketMatch[]) {
      const hasBye = match.participantA === null || match.participantB === null;
      if (!hasBye) continue;

      const winner = match.participantA ?? match.participantB;
      if (!winner) continue;

      const nextMatch = (roundTwo.matches as BracketMatch[])[Math.floor(match.position / 2)];
      if (!nextMatch) continue;

      if (match.position % 2 === 0) {
        nextMatch.participantA = winner;
      } else {
        nextMatch.participantB = winner;
      }
    }

    roundOne.matches = (roundOne.matches as BracketMatch[]).filter((match) => match.participantA !== null && match.participantB !== null);
    if (roundOne.matches.length === 0) {
      rounds.shift();
    }
  }

  return rounds;
}

function generateDoubleElimination(participants: string[]): { winners: BracketRound[]; losers: BracketRound[] } {
  const totalParticipants = participants.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalParticipants)));
  const winnersRoundCount = Math.log2(bracketSize);

  const winners = generateSingleElimination(participants);
  const losersRoundCount = Math.max(1, (winnersRoundCount - 1) * 2);
  const losers: BracketRound[] = [];

  let matchesInRound = Math.max(1, bracketSize / 4);
  for (let roundNumber = 1; roundNumber <= losersRoundCount; roundNumber += 1) {
    const matches: BracketMatch[] = [];
    for (let position = 0; position < matchesInRound; position += 1) {
      matches.push(createMatch(position, null, null));
    }

    losers.push({ matches });
    if (roundNumber % 2 === 0) {
      matchesInRound = Math.max(1, Math.ceil(matchesInRound / 2));
    }
  }

  losers.push({ matches: [createMatch(0, null, null)] });

  return { winners, losers };
}

function generateRoundRobin(participants: string[], doubleRoundRobin = false): BracketRound[] {
  const list = [...participants];
  if (list.length % 2 !== 0) list.push('BYE');

  const participantCount = list.length;
  const baseRounds = participantCount - 1;
  const iterations = doubleRoundRobin ? 2 : 1;
  const rounds: BracketRound[] = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const rotation = [...list];
    for (let roundIndex = 0; roundIndex < baseRounds; roundIndex += 1) {
      const matches: BracketMatch[] = [];
      for (let index = 0; index < participantCount / 2; index += 1) {
        const left = rotation[index];
        const right = rotation[participantCount - 1 - index];
        if (left === 'BYE' || right === 'BYE') continue;

        matches.push(createMatch(matches.length, iteration === 0 ? left : right, iteration === 0 ? right : left));
      }
      rounds.push({ matches });

      const last = rotation.pop();
      if (!last) continue;
      rotation.splice(1, 0, last);
    }
  }

  return rounds;
}

function generateSwiss(participants: string[]): BracketRound[] {
  const roundsTotal = Math.max(1, Math.ceil(Math.log2(participants.length)));
  const rounds: BracketRound[] = [];

  const firstRoundMatches: BracketMatch[] = [];
  for (let index = 0; index < participants.length; index += 2) {
    firstRoundMatches.push(createMatch(index / 2, participants[index], index + 1 < participants.length ? participants[index + 1] : null));
  }
  rounds.push({ matches: firstRoundMatches });

  for (let roundIndex = 2; roundIndex <= roundsTotal; roundIndex += 1) {
    const matchCount = Math.floor(participants.length / 2);
    const matches: BracketMatch[] = [];
    for (let position = 0; position < matchCount; position += 1) {
      matches.push(createMatch(position, null, null));
    }
    rounds.push({ matches });
  }

  return rounds;
}

function generateCombination(participants: string[], advancersPerGroup = 2): Pick<BracketData, 'groups' | 'knockoutRounds' | 'advancersPerGroup'> {
  const groupSize = 4;
  const groupCount = Math.max(2, Math.ceil(participants.length / groupSize));
  const groups: NonNullable<BracketData['groups']> = [];

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupParticipants = participants.slice(groupIndex * groupSize, (groupIndex + 1) * groupSize);
    groups.push({
      participants: groupParticipants,
      rounds: groupParticipants.length >= 2 ? generateRoundRobin(groupParticipants) : [],
    });
  }

  const advancingCount = Math.min(groupCount * advancersPerGroup, participants.length);
  const knockoutSize = Math.pow(2, Math.ceil(Math.log2(Math.max(advancingCount, 2))));
  const placeholders = Array.from({ length: knockoutSize }, () => 'TBD');

  return {
    groups,
    knockoutRounds: generateSingleElimination(placeholders),
    advancersPerGroup,
  };
}

export function generateBracket(participants: string[], format: BracketFormat): BracketData {
  resetIds();

  switch (format) {
    case 'single_elimination':
      return { format, rounds: generateSingleElimination(participants), allowTies: true };
    case 'double_elimination': {
      const bracket = generateDoubleElimination(participants);
      return { format, rounds: bracket.winners, losersRounds: bracket.losers, allowTies: true };
    }
    case 'round_robin':
      return { format, rounds: generateRoundRobin(participants), allowTies: true };
    case 'double_round_robin':
      return { format, rounds: generateRoundRobin(participants, true), allowTies: true };
    case 'swiss':
      return { format, rounds: generateSwiss(participants), allowTies: true };
    case 'combination': {
      const combination = generateCombination(participants, 2);
      return {
        format,
        rounds: [],
        groups: combination.groups,
        knockoutRounds: combination.knockoutRounds,
        advancersPerGroup: combination.advancersPerGroup,
        allowTies: true,
      };
    }
  }
}
