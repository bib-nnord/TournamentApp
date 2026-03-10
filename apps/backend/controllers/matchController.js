const prisma = require('../lib/prisma');
const { notifyUsers, buildNameToUserIds, resolveNamesToUserIds } = require('../lib/notify');

//maybe a different controller and db entry for non-tournament matches?

// ─── PATCH /tournaments/:id/matches/:matchId ───────────────────────────────
// Headers: Authorization: Bearer <token>
// Body: { winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number, clientUpdatedAt?, reset?: boolean }
// Response: { bracketData, updatedAt }

async function reportResult(req, res) {
  const tournamentId = parseInt(req.params.id, 10);
  const { matchId } = req.params;

  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: 'Invalid tournament ID' });
  }

  const { winner, scoreA, scoreB, clientUpdatedAt } = req.body;
  const isReset = req.body.reset === true;

  if (!isReset && (!winner || typeof winner !== 'string')) {
    return res.status(400).json({ error: 'winner is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }


    // TODO add a moderator role who can also report results

    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament organizer can report results' });
    }

    //this is useless until the thing above is implemented
    if (clientUpdatedAt !== undefined) {
      const clientTime = new Date(clientUpdatedAt).getTime();
      const serverTime = new Date(tournament.updated_at).getTime();
      if (clientTime !== serverTime) {
        return res.status(409).json({ error: 'Tournament was modified by someone else. Reload to see the latest version.' });
      }
    }

    if (!tournament.bracket_data) {
      return res.status(400).json({ error: 'Tournament has no bracket data' });
    }

    // bracket_data is parsed JSON from Prisma
    const bracket = tournament.bracket_data;

    const found = findMatch(bracket, matchId);
    if (!found) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const { match, section, roundIndex } = found;

    // ── Tiebreaker match ────────────────────────────────────────────────────
    if (section === 'tiebreaker') {
      // Reset tiebreaker (undo)
      if (isReset) {
        bracket.tiebreaker = { id: 'tiebreaker', participants: bracket.tiebreaker.participants };
        const updated = await prisma.tournament.update({
          where: { tournament_id: tournamentId },
          data:  { bracket_data: bracket },
        });
        return res.json({ bracketData: updated.bracket_data, updatedAt: updated.updated_at });
      }
      if (!bracket.tiebreaker.participants.includes(winner)) {
        return res.status(400).json({ error: 'Invalid tiebreaker winner' });
      }
      bracket.tiebreaker.winner = winner;
      bracket.tiebreaker.completed = true;
      const updated = await prisma.tournament.update({
        where: { tournament_id: tournamentId },
        data:  { bracket_data: bracket },
      });
      return res.json({ bracketData: updated.bracket_data, updatedAt: updated.updated_at });
    }

    // ── Regular match ───────────────────────────────────────────────────────
    if (isReset) {
      return res.status(400).json({ error: 'Reset is only supported for tiebreaker matches' });
    }

    if (!['a', 'b', 'tie'].includes(winner)) {
      return res.status(400).json({ error: 'winner must be "a", "b", or "tie"' });
    }

    if (!match.participantA || !match.participantB) {
      return res.status(400).json({ error: 'Match participants are not set yet' });
    }

    const wasEdited = !!match.completed;
    const isTie     = winner === 'tie';
    const winnerName = isTie ? null : (winner === 'a' ? match.participantA : match.participantB);
    const loserName  = isTie ? null : (winner === 'a' ? match.participantB : match.participantA);

    // Record result on the match object
    match.winner    = winnerName;
    match.tie       = isTie;
    match.scoreA    = scoreA != null ? Number(scoreA) : null;
    match.scoreB    = scoreB != null ? Number(scoreB) : null;
    match.completed = true;

    // Advance bracket (ties leave the next slot as TBD)
    if (!isTie) {
      advanceBracket(bracket, section, roundIndex, match, winnerName, loserName);
    } else if (section.startsWith('group_')) {
      // Ties in group matches still count toward group completion
      populateKnockoutFromGroups(bracket);
    }

    // ── Tiebreaker detection ────────────────────────────────────────────────
    // Elimination finals: create/remove tiebreaker based on whether result is a tie
    if (isTrueFinalMatch(bracket, section, roundIndex)) {
      if (isTie && !bracket.tiebreaker?.completed) {
        bracket.tiebreaker = { id: 'tiebreaker', participants: [match.participantA, match.participantB] };
      } else if (!isTie) {
        delete bracket.tiebreaker;
      }
    }

    // Round robin / swiss: recompute tiebreaker after every result
    if (['round_robin', 'double_round_robin', 'swiss'].includes(bracket.format)) {
      if (!bracket.tiebreaker?.completed) {
        const tied = findRRTiedParticipants(bracket);
        if (tied) {
          bracket.tiebreaker = { id: 'tiebreaker', participants: tied };
        } else {
          delete bracket.tiebreaker;
        }
      }
    }

    const updated = await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data:  { bracket_data: bracket },
      include: { participants: true },
    });

    // ── Notifications (fire-and-forget) ──────────────────────────────────
    const confirmedParticipants = updated.participants.filter((p) => p.confirmed);
    const nameMap = buildNameToUserIds(confirmedParticipants);
    const tournamentName = tournament.name || 'Tournament';

    // Build a human-readable round label
    const sectionLabels = { winners: 'Winners Bracket', losers: 'Losers Bracket', knockout: 'Knockout' };
    const sectionLabel = section.startsWith('group_')
      ? `Group ${parseInt(section.split('_')[1]) + 1}`
      : (sectionLabels[section] ?? section);
    const roundLabel = roundIndex >= 0 ? `${sectionLabel}, Round ${roundIndex + 1}` : sectionLabel;

    // Notify match participants of the result
    if (match.participantA && match.participantB) {
      const scoreText = match.scoreA != null && match.scoreB != null
        ? ` Score: ${match.scoreA}–${match.scoreB}.`
        : '';

      const subject = wasEdited
        ? `Result updated in ${tournamentName}`
        : `Match result in ${tournamentName}`;

      const notifyResult = (playerName, opponentName) => {
        const userIds = resolveNamesToUserIds(nameMap, [playerName]);
        if (userIds.length === 0) return;

        let outcome;
        if (isTie) outcome = `You tied against ${opponentName}.`;
        else if (playerName === winnerName) outcome = `You won against ${opponentName}.`;
        else outcome = `You lost against ${opponentName}.`;

        const prefix = wasEdited ? '[Updated] ' : '';

        notifyUsers(
          userIds,
          subject,
          `${prefix}${roundLabel}: ${outcome}${scoreText}`,
          tournamentId,
        );
      };

      notifyResult(match.participantA, match.participantB);
      notifyResult(match.participantB, match.participantA);
    }

    // Notify participants of newly ready matches (advancement filled both slots)
    if (!isTie && section !== 'tiebreaker') {
      const allBracketMatches = extractAllBracketMatches(bracket);
      for (const nm of allBracketMatches) {
        if (nm.participantA && nm.participantB && !nm.completed) {
          // Check if this match was just filled by the current advancement
          if (nm.participantA === winnerName || nm.participantB === winnerName) {
            const ids = resolveNamesToUserIds(nameMap, [nm.participantA, nm.participantB]);
            notifyUsers(
              ids,
              `New match in ${tournamentName}`,
              `Your next match is ready: ${nm.participantA} vs ${nm.participantB}.`,
              tournamentId,
            );
            break; // Only one match gets advanced per result
          }
        }
      }
    }

    return res.json({ bracketData: updated.bracket_data, updatedAt: updated.updated_at });
  } catch (err) {
    console.error('[match.reportResult]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Bracket helpers ──────────────────────────────────────────────────────

/** Extract all matches from every bracket section into a flat array. */
function extractAllBracketMatches(bracket) {
  const matches = [];
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

// ─── Bracket search ────────────────────────────────────────────────────────

/**
 * Find a match by ID across all bracket sections.
 * Returns { match, section, roundIndex } or null.
 * section: 'tiebreaker' | 'winners' | 'losers' | 'group_N' | 'knockout'
 */
function findMatch(bracket, matchId) {
  // Tiebreaker match
  if (bracket.tiebreaker && bracket.tiebreaker.id === matchId) {
    return { match: bracket.tiebreaker, section: 'tiebreaker', roundIndex: -1 };
  }

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

// ─── Tiebreaker helpers ─────────────────────────────────────────────────────

/**
 * Returns true if this match is the true tournament final (the match whose
 * winner would be declared champion).
 */
function isTrueFinalMatch(bracket, section, roundIndex) {
  if (section === 'winners') {
    // True final only for single_elimination; double_elim final is Grand Final in losers
    return bracket.format === 'single_elimination' && roundIndex === bracket.rounds.length - 1;
  }
  if (section === 'losers') {
    // Grand Final for double_elimination
    return roundIndex === (bracket.losersRounds?.length ?? 0) - 1;
  }
  if (section === 'knockout') {
    // Final for combination format
    return roundIndex === (bracket.knockoutRounds?.length ?? 0) - 1;
  }
  return false;
}

/**
 * For round-robin and swiss formats: if all matches are complete and two or
 * more participants are tied for first place, returns their names. Otherwise null.
 */
function findRRTiedParticipants(bracket) {
  const allMatches = bracket.rounds.flatMap(r => r.matches);
  if (!allMatches.length || !allMatches.every(m => m.completed)) return null;

  const points = new Map();
  for (const m of allMatches) {
    if (m.participantA) points.set(m.participantA, points.get(m.participantA) ?? 0);
    if (m.participantB) points.set(m.participantB, points.get(m.participantB) ?? 0);
    if (m.winner) {
      points.set(m.winner, (points.get(m.winner) ?? 0) + 1);
    } else if (m.tie) {
      if (m.participantA) points.set(m.participantA, (points.get(m.participantA) ?? 0) + 0.5);
      if (m.participantB) points.set(m.participantB, (points.get(m.participantB) ?? 0) + 0.5);
    }
  }

  const sorted = [...points.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  const topPts = sorted[0][1];
  const tied = sorted.filter(([, pts]) => pts === topPts).map(([name]) => name);
  return tied.length > 1 ? tied : null;
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

  } else if (section.startsWith('group_')) {
    // After every group match, try to populate the knockout round 1
    populateKnockoutFromGroups(bracket);
  }
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

// ─── Combination: group → knockout advancement ────────────────────────────────

/** Same seeding algorithm as the frontend's generateSeedPositions. */
function generateSeedPositions(size) {
  let positions = [1, 2];
  while (positions.length < size) {
    const next = [];
    const currentSize = positions.length * 2;
    for (const seed of positions) next.push(seed, currentSize + 1 - seed);
    positions = next;
  }
  return positions;
}

/**
 * Compute a group's standings.
 * Returns null if any match in the group is not yet complete.
 * Otherwise returns participants sorted by points desc, then score-diff desc.
 */
function computeGroupStandings(group) {
  const points = new Map();
  const scoreDiff = new Map();
  for (const p of group.participants) { points.set(p, 0); scoreDiff.set(p, 0); }

  for (const round of group.rounds) {
    for (const match of round.matches) {
      if (!match.completed) return null;
      if (match.winner) {
        points.set(match.winner, (points.get(match.winner) ?? 0) + 2);
      } else if (match.tie) {
        if (match.participantA) points.set(match.participantA, (points.get(match.participantA) ?? 0) + 1);
        if (match.participantB) points.set(match.participantB, (points.get(match.participantB) ?? 0) + 1);
      }
      if (match.scoreA != null && match.participantA)
        scoreDiff.set(match.participantA, (scoreDiff.get(match.participantA) ?? 0) + match.scoreA - (match.scoreB ?? 0));
      if (match.scoreB != null && match.participantB)
        scoreDiff.set(match.participantB, (scoreDiff.get(match.participantB) ?? 0) + match.scoreB - (match.scoreA ?? 0));
    }
  }

  return [...group.participants].sort((a, b) => {
    const pd = (points.get(b) ?? 0) - (points.get(a) ?? 0);
    return pd !== 0 ? pd : (scoreDiff.get(b) ?? 0) - (scoreDiff.get(a) ?? 0);
  });
}

/**
 * When all regular groups are complete, seed the knockout round 1 using
 * the same generateSeedPositions algorithm used by the frontend.
 * Only fills slots that are still TBD / null — never overwrites real names.
 */
function populateKnockoutFromGroups(bracket) {
  if (!bracket.knockoutRounds?.length || !bracket.groups) return;

  const regularGroups = bracket.groups.filter(g => !g.autoAdvance);
  const autoAdvanceGroups = bracket.groups.filter(g => g.autoAdvance);
  const advancersPerGroup = bracket.advancersPerGroup ?? 2;

  // Collect advancers — bail out if any regular group isn't finished yet
  const advancers = [];
  for (const group of regularGroups) {
    const standings = computeGroupStandings(group);
    if (!standings) return; // group still in progress
    for (let i = 0; i < advancersPerGroup; i++) advancers.push(standings[i] ?? null);
  }
  for (const group of autoAdvanceGroups) {
    for (const p of group.participants) advancers.push(p);
  }

  const r1 = bracket.knockoutRounds[0];
  if (!r1) return;

  // knockoutSize = totalPositions × 2 (same as when bracket was generated)
  const knockoutSize = (r1.totalPositions ?? r1.matches.length) * 2;
  const seeds = generateSeedPositions(knockoutSize);

  // Pad advancers list to knockoutSize with nulls
  while (advancers.length < knockoutSize) advancers.push(null);

  for (let i = 0; i < seeds.length; i += 2) {
    const advancerA = advancers[seeds[i] - 1] ?? null;
    const advancerB = advancers[seeds[i + 1] - 1] ?? null;
    const matchPos = i / 2;
    const match = r1.matches.find(m => m.position === matchPos);
    if (!match) continue;

    // Only fill slots that are still TBD / empty
    if ((!match.participantA || match.participantA === 'TBD') && advancerA)
      match.participantA = advancerA;
    if ((!match.participantB || match.participantB === 'TBD') && advancerB)
      match.participantB = advancerB;
  }
}

// ─── GET /tournaments/:id/matches/:matchId ─────────────────────────────────
// Body: none (id, matchId from URL params)
// Response: { match, section, roundIndex, allowTies, tournament: { id, name, game, format, isPrivate, status, creator, updatedAt } }
async function getMatch(req, res) {
  const tournamentId = parseInt(req.params.id, 10);
  const { matchId } = req.params;

  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: 'Invalid tournament ID' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        creator: { select: { user_id: true, username: true } },
        participants: { select: { user_id: true, members_snapshot: true } },
      },
    });

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    if (tournament.is_private) {
      const isParticipant = tournament.participants.some((p) =>
        p.user_id === req.user?.id ||
        (Array.isArray(p.members_snapshot) && p.members_snapshot.some((m) => m.userId === req.user?.id))
      );
      if (!req.user || (req.user.id !== tournament.created_by && !isParticipant)) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
    }

    if (!tournament.bracket_data) {
      return res.status(404).json({ error: 'No bracket data' });
    }

    const found = findMatch(tournament.bracket_data, matchId);
    if (!found) return res.status(404).json({ error: 'Match not found' });

    return res.json({
      match: found.match,
      section: found.section,
      roundIndex: found.roundIndex,
      allowTies: tournament.bracket_data.allowTies !== false,
      tournament: {
        id: tournament.tournament_id,
        name: tournament.name,
        game: tournament.game,
        format: tournament.bracket_data.format,
        isPrivate: tournament.is_private,
        status: tournament.status,
        creator: { id: tournament.creator.user_id, username: tournament.creator.username },
        updatedAt: tournament.updated_at,
      },
    });
  } catch (err) {
    console.error('[match.getMatch]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { reportResult, getMatch };
