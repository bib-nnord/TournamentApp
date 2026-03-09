const prisma = require('../lib/prisma');
const { notifyUsers, collectAllUserIds, notifyUser } = require('../lib/notify');

// ─── POST /tournaments ─────────────────────────────────────────────────────
// Creates a tournament with participants and bracket data.
// Body: { name, game, description?, format, isPrivate?, participants, bracketData?, maxParticipants? }
// participants: [{ name, type: "account"|"guest"|"team", members?: [...], existingTeamId? }]
async function create(req, res) {
  const { name, game, description, format, isPrivate, participants, bracketData, maxParticipants, startDate, status } = req.body;

  if (!name || !game || !format) {
    return res.status(400).json({ error: 'name, game, and format are required' });
  }

  const validFormats = [
    'single_elimination',
    'double_elimination',
    'round_robin',
    'double_round_robin',
    'combination',
    'swiss',
  ];
  
  if (!validFormats.includes(format)) {
    return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
  }

  if (!Array.isArray(participants) || participants.length < 2) {
    return res.status(400).json({ error: 'At least 2 participants are required' });
  }

  // Check for duplicate participant names
  const participantNames = participants.map((p) => p.name.trim().toLowerCase());
  const seen = new Set();
  for (const n of participantNames) {
    if (seen.has(n)) {
      return res.status(400).json({ error: `Duplicate participant name: "${n}"` });
    }
    seen.add(n);
  }

  try {
    // ── Resolve account usernames → user_id ──────────────────────────────
    const accountNames = [];
    for (const p of participants) {
      if (p.type === 'account') accountNames.push(p.name);
      if (p.type === 'team' && Array.isArray(p.members)) {
        for (const m of p.members) {
          if (m.type === 'account') accountNames.push(m.name);
        }
      }
    }

    const userMap = {};
    if (accountNames.length > 0) {
      const unique = [...new Set(accountNames)];
      const users = await prisma.user.findMany({
        where: { username: { in: unique, mode: 'insensitive' } },
        select: { user_id: true, username: true, display_name: true },
      });
      for (const u of users) {
        userMap[u.username.toLowerCase()] = u;
      }

      // Competitor is marked as account but not found (shouldnt be possible from frontend unless deleted manually in the meantime, maybe with api)
      for (const name of unique) {
        if (!userMap[name.toLowerCase()]) {
          return res.status(400).json({ error: `Account not found: "${name}"` });
        }
      }
    }

    // ── Build participant create records ──────────────────────────────────
    const participantRecords = participants.map((p, i) => {
      const base = { seed: i + 1, display_name: p.name };

      if (p.type === 'team') {
        const membersSnapshot = (p.members || []).map((m) => {
          const resolved = m.type === 'account' ? userMap[m.name.toLowerCase()] : null;
          return {
            name: resolved ? resolved.display_name || resolved.username : m.name,
            type: m.type,
            userId: resolved?.user_id || null,
          };
        });
        // Team is confirmed if the creator is a member
        const creatorIsMember = membersSnapshot.some((m) => m.userId === req.user.id);
        return {
          ...base,
          participant_type: 'team',
          team_id: p.existingTeamId || null,
          members_snapshot: membersSnapshot,
          confirmed: creatorIsMember,
        };
      }

      if (p.type === 'account') {
        const resolved = userMap[p.name.toLowerCase()];
        return {
          ...base,
          participant_type: 'account',
          user_id: resolved?.user_id || null,
          display_name: resolved ? resolved.display_name || resolved.username : p.name,
          confirmed: resolved?.user_id === req.user.id,
        };
      }

      // guest
      return {
        ...base,
        participant_type: 'guest',
        guest_name: p.name,
      };
    });

    const tournament = await prisma.tournament.create({
      data: {
        name,
        game,
        description: description || null,
        format,
        status: status || 'active',
        is_private: isPrivate ?? false,
        max_participants: maxParticipants ?? participants.length,
        start_date: startDate ? new Date(startDate) : null,
        bracket_data: bracketData ?? null,
        created_by: req.user.id,
        participants: {
          create: participantRecords,
        },
      },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    // Notify all participants (including the creator if they added themselves)
    const recipientIds = collectAllUserIds(tournament.participants);
    notifyUsers(
      recipientIds,
      `You've been added to ${name}`,
      `You have been added as a participant in the tournament "${name}" (${game}). Visit the tournament page or your messages to accept or decline.`,
      tournament.tournament_id,
    );

    return res.status(201).json(formatTournament(tournament));
  } catch (err) {
    console.error('[tournament.create]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /tournaments ──────────────────────────────────────────────────────
// Query: ?status=active&page=1&limit=20
async function list(req, res) {
  const { status, page = '1', limit = '20' } = req.query;
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const where = {};
  if (status) where.status = status;
  // Hide private tournaments unless user is the creator or a confirmed participant
  where.OR = [
    { is_private: false },
    ...(req.user ? [
      { created_by: req.user.id },
      { participants: { some: { user_id: req.user.id, confirmed: true } } },
      { participants: { some: { confirmed: true, members_snapshot: { array_contains: [{ userId: req.user.id }] } } } },
    ] : []),
  ];

  try {
    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take,
        skip,
        include: {
          _count: { select: { participants: true } },
          creator: { select: { user_id: true, username: true } },
        },
      }),
      prisma.tournament.count({ where }),
    ]);

    return res.json({
      tournaments: tournaments.map((t) => ({
        id: t.tournament_id,
        name: t.name,
        game: t.game,
        format: t.format,
        status: t.status,
        isPrivate: t.is_private,
        participants: t._count.participants,
        max: t.max_participants,
        creator: { id: t.creator.user_id, username: t.creator.username },
        createdAt: t.created_at,
      })),
      page: Math.floor(skip / take) + 1,
      totalPages: Math.ceil(total / take),
      total,
    });
  } catch (err) {
    console.error('[tournament.list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /tournaments/:id ──────────────────────────────────────────────────
async function getById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: id },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
        matches: {
        orderBy: [{ round: 'asc' }, { position: 'asc' }],
        include: { participants: true },
      },
      },
    });

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    // Private check
    if (tournament.is_private) {
      const isParticipant = tournament.participants.some((p) =>
        p.user_id === req.user?.id ||
        (Array.isArray(p.members_snapshot) && p.members_snapshot.some((m) => m.userId === req.user?.id))
      );
      if (!req.user || (req.user.id !== tournament.created_by && !isParticipant)) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
    }

    return res.json(formatTournament(tournament));
  } catch (err) {
    console.error('[tournament.getById]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── PATCH /tournaments/:id ────────────────────────────────────────────────
// Allowed fields: name, game, description, status, bracketData
async function update(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const tournament = await prisma.tournament.findUnique({ where: { tournament_id: id } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can update it' });
    }

    const { name, game, description, status, bracketData, startDate, isPrivate, clientUpdatedAt } = req.body;

    if (clientUpdatedAt !== undefined) {
      const clientTime = new Date(clientUpdatedAt).getTime();
      const serverTime = new Date(tournament.updated_at).getTime();
      if (clientTime !== serverTime) {
        return res.status(409).json({ error: 'Tournament was modified by someone else. Reload to see the latest version.' });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (game !== undefined) data.game = game;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (bracketData !== undefined) data.bracket_data = bracketData;
    if (startDate !== undefined) data.start_date = startDate ? new Date(startDate) : null;
    if (isPrivate !== undefined) data.is_private = isPrivate;

    const updated = await prisma.tournament.update({
      where: { tournament_id: id },
      data,
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    // Notify participants on status changes
    if (status === 'completed' || status === 'cancelled') {
      const recipientIds = collectAllUserIds(updated.participants)
        .filter((uid) => uid !== req.user.id);
      const verb = status === 'completed' ? 'has been completed' : 'has been cancelled';
      notifyUsers(
        recipientIds,
        `${tournament.name} ${verb}`,
        `The tournament "${tournament.name}" ${verb}.`,
      );
    }

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.update]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── DELETE /tournaments/:id ───────────────────────────────────────────────
async function remove(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const tournament = await prisma.tournament.findUnique({ where: { tournament_id: id } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can delete it' });
    }

    await prisma.tournament.delete({ where: { tournament_id: id } });
    return res.json({ message: 'Tournament deleted' });
  } catch (err) {
    console.error('[tournament.remove]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── PATCH /tournaments/:id/confirm ───────────────────────────────────────
// Accept or decline a tournament invitation.
// Body: { accept: true|false }
async function confirmParticipation(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tournament ID' });

  const { accept } = req.body;
  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: '"accept" must be a boolean' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: id },
      include: { participants: true },
    });

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    // Find the participant record for this user (direct or via team snapshot)
    const participant = tournament.participants.find((p) => {
      if (p.user_id === req.user.id) return true;
      if (Array.isArray(p.members_snapshot)) {
        return p.members_snapshot.some((m) => m.userId === req.user.id);
      }
      return false;
    });

    if (!participant) {
      return res.status(404).json({ error: 'You are not a participant in this tournament' });
    }

    if (participant.confirmed) {
      return res.status(400).json({ error: 'Already confirmed' });
    }

    if (accept) {
      await prisma.tournamentParticipant.update({
        where: {
          tournament_id_seed: { tournament_id: id, seed: participant.seed },
        },
        data: { confirmed: true },
      });
    } else {
      // Decline: remove participant and clear from bracket
      await prisma.tournamentParticipant.delete({
        where: {
          tournament_id_seed: { tournament_id: id, seed: participant.seed },
        },
      });

      // Clear participant name from bracket data
      if (tournament.bracket_data) {
        const bracket = tournament.bracket_data;
        const name = participant.display_name;
        clearParticipantFromBracket(bracket, name);
        await prisma.tournament.update({
          where: { tournament_id: id },
          data: { bracket_data: bracket },
        });
      }
    }

    // Return updated tournament
    const updated = await prisma.tournament.findUnique({
      where: { tournament_id: id },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
        matches: {
          orderBy: [{ round: 'asc' }, { position: 'asc' }],
          include: { participants: true },
        },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.confirmParticipation]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Remove a participant name from all bracket matches (replace with null).
 */
function clearParticipantFromBracket(bracket, name) {
  const clearFromRounds = (rounds) => {
    if (!rounds) return;
    for (const round of rounds) {
      for (const match of round.matches) {
        if (match.participantA === name) match.participantA = null;
        if (match.participantB === name) match.participantB = null;
        if (match.winner === name) { match.winner = null; match.completed = false; }
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
        group.participants = group.participants.filter((p) => p !== name);
      }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTournament(t) {
  return {
    id: t.tournament_id,
    name: t.name,
    game: t.game,
    description: t.description,
    format: t.format,
    status: t.status,
    isPrivate: t.is_private,
    max: t.max_participants,
    startDate: t.start_date,
    bracketData: t.bracket_data,
    creator: t.creator
      ? { id: t.creator.user_id, username: t.creator.username }
      : undefined,
    participants: t.participants
      ? t.participants.map((p) => ({
          seed: p.seed,
          displayName: p.display_name,
          guestName: p.guest_name,
          userId: p.user_id,
          teamId: p.team_id,
          type: p.participant_type || (p.guest_name ? 'guest' : 'account'),
          membersSnapshot: p.members_snapshot || null,
          confirmed: p.confirmed,
        }))
      : undefined,
    matches: t.matches
      ? t.matches.map((m) => {
          const sideA = (m.participants || []).filter((p) => p.side === 'a');
          const sideB = (m.participants || []).filter((p) => p.side === 'b');
          return {
            id: m.match_id,
            round: m.round,
            position: m.position,
            status: m.status,
            scoreA: m.score_a,
            scoreB: m.score_b,
            sideA: {
              teamName: sideA[0]?.team_name || null,
              players: sideA.map((p) => ({
                displayName: p.display_name,
                userId: p.user_id,
                teamId: p.team_id,
              })),
            },
            sideB: {
              teamName: sideB[0]?.team_name || null,
              players: sideB.map((p) => ({
                displayName: p.display_name,
                userId: p.user_id,
                teamId: p.team_id,
              })),
            },
          };
        })
      : undefined,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

// ─── GET /tournaments/my-matches ───────────────────────────────────────────
// Returns the latest 5 matches for the authenticated user across all tournaments.
// Priority: upcoming (not completed) first, then completed; within each group by recency.
async function myMatches(req, res) {
  try {
    const userFilter = {
      OR: [
        { user_id: req.user.id },
        { members_snapshot: { array_contains: [{ userId: req.user.id }] } },
      ],
    };

    const tournaments = await prisma.tournament.findMany({
      where: { participants: { some: userFilter } },
      include: { participants: { where: userFilter } },
      orderBy: { created_at: 'desc' },
    });

    const allMatches = [];

    for (const tournament of tournaments) {
      if (!tournament.bracket_data) continue;

      const myNames = new Set(tournament.participants.map((p) => p.display_name));
      if (myNames.size === 0) continue;

      for (const m of extractAllMatches(tournament.bracket_data)) {
        if (!m.participantA || !m.participantB) continue;
        const isA = myNames.has(m.participantA);
        const isB = myNames.has(m.participantB);
        if (!isA && !isB) continue;

        const myName = isA ? m.participantA : m.participantB;
        const opponent = isA ? m.participantB : m.participantA;

        let myResult = null;
        if (m.completed) {
          if (m.tie) myResult = 'tie';
          else if (m.winner === myName) myResult = 'won';
          else myResult = 'lost';
        }

        allMatches.push({
          id: m.id,
          tournamentId: tournament.tournament_id,
          tournamentName: tournament.name,
          opponent,
          completed: m.completed ?? false,
          myResult,
          tournamentStatus: tournament.status,
          createdAt: tournament.created_at,
        });
      }
    }

    // Upcoming (not completed) first, then by tournament recency
    allMatches.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return res.json({ matches: allMatches.slice(0, 5) });
  } catch (err) {
    console.error('[tournament.myMatches]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function extractAllMatches(bracket) {
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

module.exports = { create, list, getById, update, remove, myMatches, confirmParticipation };
