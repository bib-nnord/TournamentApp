const prisma = require('../lib/prisma');

// ─── PATCH /tournaments/:id/matches/:matchId ───────────────────────────────
// Reports a match result and advances the bracket.
// Body: { winner: "a" | "b", scoreA?: number, scoreB?: number }
// Auth: required — organizer only
async function reportResult(req, res) {
  const tournamentId = parseInt(req.params.id, 10);
  const { matchId } = req.params;

  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: 'Invalid tournament ID' });
  }

  const { winner, scoreA, scoreB } = req.body;

  if (!winner || !['a', 'b'].includes(winner)) {
    return res.status(400).json({ error: 'winner must be "a" or "b"' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament organizer can report results' });
    }

    if (!tournament.bracket_data) {
      return res.status(400).json({ error: 'Tournament has no bracket data' });
    }

    // bracket_data is parsed JSON from Prisma — mutate in place
    const bracket = tournament.bracket_data;

    const found = findMatch(bracket, matchId);
    if (!found) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const { match, section, roundIndex } = found;

    if (!match.participantA || !match.participantB) {
      return res.status(400).json({ error: 'Match participants are not set yet' });
    }

    if (match.completed) {
      return res.status(400).json({ error: 'Match result has already been reported' });
    }

    const winnerName = winner === 'a' ? match.participantA : match.participantB;
    const loserName  = winner === 'a' ? match.participantB : match.participantA;

    // Record result on the match object
    match.winner    = winnerName;
    match.scoreA    = scoreA != null ? Number(scoreA) : null;
    match.scoreB    = scoreB != null ? Number(scoreB) : null;
    match.completed = true;

    // Advance bracket
    advanceBracket(bracket, section, roundIndex, match, winnerName, loserName);

    const updated = await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data:  { bracket_data: bracket },
    });

    return res.json({ bracketData: updated.bracket_data });
  } catch (err) {
    console.error('[match.reportResult]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Bracket search ────────────────────────────────────────────────────────

/**
 * Find a match by ID across all bracket sections.
 * Returns { match, section, roundIndex } or null.
 * section: 'winners' | 'losers' | 'group_N' | 'knockout'
 */
function findMatch(bracket, matchId) {
  // Winners / main rounds
  for (let ri = 0; ri < bracket.rounds.length; ri++) {
    for (const m of bracket.rounds[ri].matches) {
      if (m.id === matchId) return { match: m, section: 'winners', roundIndex: ri };
    }
  }

  // Losers bracket + Grand Final (double elimination)
  if (bracket.losersRounds) {
    for (let ri = 0; ri < bracket.losersRounds.length; ri++) {
      for (const m of bracket.losersRounds[ri].matches) {
        if (m.id === matchId) return { match: m, section: 'losers', roundIndex: ri };
      }
    }
  }

  // Group stages (combination)
  if (bracket.groups) {
    for (let gi = 0; gi < bracket.groups.length; gi++) {
      const group = bracket.groups[gi];
      for (let ri = 0; ri < group.rounds.length; ri++) {
        for (const m of group.rounds[ri].matches) {
          if (m.id === matchId) return { match: m, section: `group_${gi}`, roundIndex: ri };
        }
      }
    }
  }

  // Knockout rounds (combination)
  if (bracket.knockoutRounds) {
    for (let ri = 0; ri < bracket.knockoutRounds.length; ri++) {
      for (const m of bracket.knockoutRounds[ri].matches) {
        if (m.id === matchId) return { match: m, section: 'knockout', roundIndex: ri };
      }
    }
  }

  return null;
}

// ─── Bracket advancement ───────────────────────────────────────────────────

function advanceBracket(bracket, section, roundIndex, match, winnerName, loserName) {
  const format = bracket.format;

  if (section === 'winners') {
    if (format === 'single_elimination') {
      advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);

    } else if (format === 'double_elimination') {
      // Winner advances in WB (unless this is the WB Final)
      advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
      // Loser drops to LB
      dropToLosers(bracket, roundIndex, match, loserName);
      // WB Final winner → Grand Final side A
      if (roundIndex === bracket.rounds.length - 1 && bracket.losersRounds) {
        const gf = bracket.losersRounds[bracket.losersRounds.length - 1];
        gf.matches[0].participantA = winnerName;
      }

    } else if (format === 'combination') {
      // Knockout rounds use single-elim advancement
      advanceSingleElim(bracket.rounds, roundIndex, match, winnerName);
    }
    // round_robin, double_round_robin, swiss: all matches are pre-set, no advancement needed

  } else if (section === 'losers') {
    const isGrandFinal = roundIndex === bracket.losersRounds.length - 1;
    if (!isGrandFinal) {
      advanceLosers(bracket.losersRounds, roundIndex, match, winnerName);
    }
    // Grand Final: no next match — tournament complete

  } else if (section === 'knockout') {
    advanceSingleElim(bracket.knockoutRounds, roundIndex, match, winnerName);

  }
  // group_N: round-robin within a group, no advancement
}

/**
 * Advance the winner of a match to the next round in a single-elimination
 * style rounds array.  The next match slot is determined by position:
 *   next position = floor(currentPosition / 2)
 *   side A if currentPosition is even, side B if odd
 */
function advanceSingleElim(rounds, roundIndex, match, winnerName) {
  const nextRi = roundIndex + 1;
  if (nextRi >= rounds.length) return; // already the final

  const nextPosition = Math.floor(match.position / 2);
  const nextMatch = rounds[nextRi].matches.find(m => m.position === nextPosition);
  if (!nextMatch) return;

  if (match.position % 2 === 0) {
    nextMatch.participantA = winnerName;
  } else {
    nextMatch.participantB = winnerName;
  }
}

/**
 * Drop the loser of a WB match into the appropriate LB slot.
 *
 * Mapping (wbRoundIndex = 0-based WB round index, K = wbRoundIndex + 1):
 *   K=1 (WR1): → LR1 (lbIndex 0), wbDropDown "both"
 *              position = floor(P / 2), side A if P%2===0 else B
 *   K≥2:       → LR(2K−2) (lbIndex 2K−3 = 2*wbRoundIndex−1), wbDropDown "b"
 *              same position P, side B
 *
 * The WB Final loser maps to the Losers Final via the K≥2 rule.
 */
function dropToLosers(bracket, wbRoundIndex, match, loserName) {
  if (!bracket.losersRounds) return;

  if (wbRoundIndex === 0) {
    // WR1 losers fill both slots of LR1
    const lbMatch = bracket.losersRounds[0].matches.find(
      m => m.position === Math.floor(match.position / 2),
    );
    if (!lbMatch) return;
    if (match.position % 2 === 0) {
      lbMatch.participantA = loserName;
    } else {
      lbMatch.participantB = loserName;
    }
  } else {
    // WR round K (K = wbRoundIndex+1, K≥2) → LB index 2*wbRoundIndex−1
    const lbIndex = 2 * wbRoundIndex - 1;
    if (lbIndex >= bracket.losersRounds.length) return;
    const lbMatch = bracket.losersRounds[lbIndex].matches.find(
      m => m.position === match.position,
    );
    if (lbMatch) lbMatch.participantB = loserName;
  }
}

/**
 * Advance the winner of an LB match to the next LB round.
 *
 * LB round numbering (1-based, from the generation code):
 *   Odd rounds  (LR1, LR3, …): pairing — winner keeps same position, takes side A
 *                               in the next drop-down round.
 *   Even rounds (LR2, LR4, …): drop-down — winner advances with position halving,
 *                               side determined by current position parity.
 *
 * Special case: if the next round is the Grand Final, winner takes side B
 * (WB champion holds side A).
 */
function advanceLosers(losersRounds, roundIndex, match, winnerName) {
  const nextRi = roundIndex + 1;
  if (nextRi >= losersRounds.length) return;

  const isGrandFinal = nextRi === losersRounds.length - 1;

  if (isGrandFinal) {
    losersRounds[nextRi].matches[0].participantB = winnerName;
    return;
  }

  const lbRoundNum = roundIndex + 1; // 1-based

  if (lbRoundNum % 2 === 1) {
    // Odd LB round (pairing) → next round (even, drop-down): same position, side A
    const nextMatch = losersRounds[nextRi].matches.find(m => m.position === match.position);
    if (nextMatch) nextMatch.participantA = winnerName;
  } else {
    // Even LB round (drop-down) → next round (odd, pairing): halved position
    const nextPosition = Math.floor(match.position / 2);
    const nextMatch = losersRounds[nextRi].matches.find(m => m.position === nextPosition);
    if (!nextMatch) return;
    if (match.position % 2 === 0) {
      nextMatch.participantA = winnerName;
    } else {
      nextMatch.participantB = winnerName;
    }
  }
}

module.exports = { reportResult };
