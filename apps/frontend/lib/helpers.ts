/**
 * Returns a unique name by appending (2), (3), … if the trimmed name already
 * exists in the provided list. Returns null if the name is empty after trimming.
 */
export function generateUniqueName(name: string, existing: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (!existing.includes(trimmed)) return trimmed;
  let n = 2;
  while (existing.includes(`${trimmed} (${n})`)) n++;
  return `${trimmed} (${n})`;
}

/**
 * Formats a date string or Date object using toLocaleDateString.
 * Defaults to "Jan 1, 2025" style (short month, numeric day, numeric year).
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  return new Date(date).toLocaleDateString(undefined, options);
}

// ─── Matches ──────────────────────────────────────────────────────────────────

import type { Match } from "@/types";

export function getMatchWinner(match: Match): string | null {
  if (match.status !== "completed") return null;
  if (match.playerA.score === null || match.playerB.score === null) return null;
  if (match.playerA.score > match.playerB.score) return match.playerA.id;
  if (match.playerB.score > match.playerA.score) return match.playerB.id;
  return "draw";
}

export function getMatchBackNavigation(match: Match): { href: string; label: string } {
  if (!match.tournament) {
    return { href: "/matches", label: "← Back to matches" };
  }

  return {
    href: `/tournaments/view/${match.tournament.id}`,
    label: `← Back to ${match.tournament.name}`,
  };
}

export function getUserInitial(username: string): string {
  return username.charAt(0).toUpperCase();
}

// ─── Tournaments ──────────────────────────────────────────────────────────────

import type { Bracket } from "@/lib/generateBracket";
import type { TeamRelation } from "@/types";

/** Determine the winner of a tournament from its bracket data. */
export function getTournamentWinner(bracket: Bracket): string | null {
  // Tiebreaker result takes precedence
  if (bracket.tiebreaker?.completed && bracket.tiebreaker.winner) {
    return bracket.tiebreaker.winner;
  }

  switch (bracket.format) {
    case "single_elimination": {
      const last = bracket.rounds[bracket.rounds.length - 1];
      if (!last) return null;
      const m = last.matches[0];
      if (!m?.completed) return null;
      if (m.tie) return null;
      return m.winner ?? null;
    }
    case "double_elimination": {
      if (!bracket.losersRounds?.length) return null;
      const gf = bracket.losersRounds[bracket.losersRounds.length - 1].matches[0];
      if (!gf?.completed) return null;
      if (gf.tie) return null;
      return gf.winner ?? null;
    }
    case "combination": {
      if (!bracket.knockoutRounds?.length) return null;
      const last = bracket.knockoutRounds[bracket.knockoutRounds.length - 1];
      const m = last?.matches[0];
      if (!m?.completed) return null;
      if (m.tie) return null;
      return m.winner ?? null;
    }
    case "round_robin":
    case "double_round_robin":
    case "swiss": {
      const allMatches = bracket.rounds.flatMap((r) => r.matches);
      if (!allMatches.length || !allMatches.every((m) => m.completed)) return null;
      const wins = new Map<string, number>();
      for (const m of allMatches) {
        if (m.winner) wins.set(m.winner, (wins.get(m.winner) ?? 0) + 1);
      }
      const sorted = [...wins.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null;
      return sorted[0]?.[0] ?? null;
    }
    default:
      return null;
  }
}

// ─── Teams ────────────────────────────────────────────────────────────────────

/** Derive permission flags from the current user's team role. */
export function getTeamPermissions(role: TeamRelation) {
  const isLead = role === "lead";
  const isModerator = role === "moderator";
  const isMember = role === "member";
  const isUnrelated = role === "none";
  const canManage = isLead || isModerator;
  return { isLead, isModerator, isMember, isUnrelated, canManage };
}

// ─── Arrays ───────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle — returns a new array. */
export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
