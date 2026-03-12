import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import { notifyUsers, collectAllUserIds } from '../lib/notify';
import Tournament from '../models/Tournament';

export async function create(req: Request, res: Response) {
  const { name, game, description, format, isPrivate, participants, bracketData, maxParticipants, startDate, status } =
    req.body as {
      name?: string;
      game?: string;
      description?: string;
      format?: string;
      isPrivate?: boolean;
      participants?: any[];
      bracketData?: any;
      maxParticipants?: number;
      startDate?: string;
      status?: string;
    };

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

  const participantNames = participants.map((participant) => String(participant.name).trim().toLowerCase());
  const seen = new Set<string>();
  for (const participantName of participantNames) {
    if (seen.has(participantName)) {
      return res.status(400).json({ error: `Duplicate participant name: "${participantName}"` });
    }
    seen.add(participantName);
  }

  try {
    const accountNames: string[] = [];
    for (const participant of participants) {
      if (participant.type === 'account') accountNames.push(participant.accountName || participant.name);
      if (participant.type === 'team' && Array.isArray(participant.members)) {
        for (const member of participant.members) {
          if (member.type === 'account') accountNames.push(member.accountName || member.name);
        }
      }
    }

    const seenAccounts = new Set<string>();
    for (const accountName of accountNames) {
      const lower = accountName.toLowerCase();
      if (seenAccounts.has(lower)) {
        return res.status(400).json({ error: `Duplicate account: "${accountName}"` });
      }
      seenAccounts.add(lower);
    }

    const userMap: Record<string, any> = {};
    if (accountNames.length > 0) {
      const unique = [...new Set(accountNames)];
      const users = await prisma.user.findMany({
        where: { username: { in: unique, mode: 'insensitive' } },
        select: { user_id: true, username: true, display_name: true },
      });
      for (const user of users) {
        userMap[user.username.toLowerCase()] = user;
      }

      for (const accountName of unique) {
        if (!userMap[accountName.toLowerCase()]) {
          return res.status(400).json({ error: `Account not found: "${accountName}"` });
        }
      }
    }

    const participantRecords: any[] = participants.map((participant, index) => {
      const base = { seed: index + 1, display_name: participant.name };

      if (participant.type === 'team') {
        const membersSnapshot = (participant.members || []).map((member: any) => {
          const resolved = member.type === 'account' ? userMap[(member.accountName || member.name).toLowerCase()] : null;
          return {
            name: resolved ? resolved.display_name || resolved.username : member.name,
            type: member.type,
            userId: resolved?.user_id || null,
          };
        });
        const creatorIsMember = membersSnapshot.some((member: any) => member.userId === req.user.id);
        return {
          ...base,
          participant_type: 'team',
          team_id: participant.existingTeamId || null,
          members_snapshot: membersSnapshot,
          confirmed: creatorIsMember,
        };
      }

      if (participant.type === 'account') {
        const resolved = userMap[(participant.accountName || participant.name).toLowerCase()];
        return {
          ...base,
          participant_type: 'account',
          user_id: resolved?.user_id || null,
          display_name: resolved ? resolved.display_name || resolved.username : participant.name,
          confirmed: resolved?.user_id === req.user.id,
        };
      }

      return {
        ...base,
        participant_type: 'guest',
        guest_name: participant.name,
      };
    });

    const tournament: any = await prisma.tournament.create({
      data: {
        name,
        game,
        description: description || null,
        format: format as any,
        status: (status || 'active') as any,
        is_private: isPrivate ?? false,
        max_participants: maxParticipants ?? participants.length,
        start_date: startDate ? new Date(startDate) : null,
        bracket_data: bracketData ?? null,
        created_by: req.user.id,
        participants: {
          create: participantRecords as any,
        },
      },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    const recipientIds = collectAllUserIds(tournament.participants).filter((uid: number) => uid !== req.user.id);
    notifyUsers(
      recipientIds,
      `You've been added to ${name}`,
      `You have been added as a participant in the tournament "${name}" (${game}). Visit the tournament page to review and accept or decline.`,
      tournament.tournament_id
    );

    return res.status(201).json(formatTournament(tournament));
  } catch (err) {
    console.error('[tournament.create]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function list(req: Request, res: Response) {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const pageRaw = typeof req.query.page === 'string' ? req.query.page : '1';
  const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '20';
  const take = Math.min(parseInt(limitRaw, 10) || 20, 100);
  const skip = (Math.max(parseInt(pageRaw, 10) || 1, 1) - 1) * take;

  const where: any = {};
  if (status) where.status = status;
  where.OR = [
    { is_private: false },
    ...(req.user
      ? [
          { created_by: req.user.id },
          { participants: { some: { user_id: req.user.id, confirmed: true } } },
          { participants: { some: { confirmed: true, members_snapshot: { array_contains: [{ userId: req.user.id }] } } } },
        ]
      : []),
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
      tournaments: tournaments.map((t: any) => ({
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

export async function getById(req: Request, res: Response) {
  const id = parseInt(String(req.params.id), 10);
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

    if (tournament.is_private) {
      const isParticipant = tournament.participants.some((participant: any) =>
        participant.user_id === req.user?.id ||
        (Array.isArray(participant.members_snapshot) && participant.members_snapshot.some((member: any) => member.userId === req.user?.id))
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

export async function update(req: Request, res: Response) {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const tournament = await prisma.tournament.findUnique({ where: { tournament_id: id } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can update it' });
    }

    const { name, game, description, status, bracketData, startDate, isPrivate, clientUpdatedAt } = req.body as any;

    if (clientUpdatedAt !== undefined) {
      const clientTime = new Date(clientUpdatedAt).getTime();
      const serverTime = new Date(tournament.updated_at).getTime();
      if (clientTime !== serverTime) {
        return res.status(409).json({ error: 'Tournament was modified by someone else. Reload to see the latest version.' });
      }
    }

    const data: any = {};
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

    if (status === 'completed' || status === 'cancelled') {
      const confirmedParticipants = updated.participants.filter((participant: any) => participant.confirmed);
      const recipientIds = collectAllUserIds(confirmedParticipants).filter((uid: number) => uid !== req.user.id);
      const verb = status === 'completed' ? 'has been completed' : 'has been cancelled';
      notifyUsers(recipientIds, `${tournament.name} ${verb}`, `The tournament "${tournament.name}" ${verb}.`, tournament.tournament_id);
    }

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.update]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function remove(req: Request, res: Response) {
  const id = parseInt(String(req.params.id), 10);
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

export async function confirmParticipation(req: Request, res: Response) {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tournament ID' });

  const { accept } = req.body as { accept?: boolean };
  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: '"accept" must be a boolean' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: id },
      include: { participants: true },
    });

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const participant = tournament.participants.find((candidate: any) => {
      if (candidate.user_id === req.user.id) return true;
      if (Array.isArray(candidate.members_snapshot)) {
        return candidate.members_snapshot.some((member: any) => member.userId === req.user.id);
      }
      return false;
    });

    if (!participant) {
      return res.status(404).json({ error: 'You are not a participant in this tournament' });
    }

    if (participant.confirmed) {
      return res.status(400).json({ error: 'Already confirmed' });
    }

    if (participant.declined) {
      return res.status(400).json({ error: 'Already declined' });
    }

    if (accept) {
      await prisma.tournamentParticipant.update({
        where: {
          tournament_id_seed: { tournament_id: id, seed: participant.seed },
        },
        data: { confirmed: true },
      });
    } else {
      await prisma.tournamentParticipant.update({
        where: {
          tournament_id_seed: { tournament_id: id, seed: participant.seed },
        },
        data: { declined: true },
      });

      if (tournament.bracket_data) {
        const tournamentModel = new Tournament({
          tournament_id: tournament.tournament_id,
          name: tournament.name,
          game: tournament.game,
          format: tournament.format as any,
          status: tournament.status as any,
          created_by: tournament.created_by,
          is_private: tournament.is_private,
          bracket_data: tournament.bracket_data as any,
        });
        const name = participant.display_name;
        tournamentModel.clearParticipant(name);
        await prisma.tournament.update({
          where: { tournament_id: id },
          data: { bracket_data: tournamentModel.bracket_data as any },
        });
      }
    }

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


function formatTournament(tournament: any) {
  return {
    id: tournament.tournament_id,
    name: tournament.name,
    game: tournament.game,
    description: tournament.description,
    format: tournament.format,
    status: tournament.status,
    isPrivate: tournament.is_private,
    max: tournament.max_participants,
    startDate: tournament.start_date,
    bracketData: tournament.bracket_data,
    creator: tournament.creator
      ? { id: tournament.creator.user_id, username: tournament.creator.username }
      : undefined,
    participants: tournament.participants
      ? tournament.participants.map((participant: any) => ({
          seed: participant.seed,
          displayName: participant.display_name,
          guestName: participant.guest_name,
          userId: participant.user_id,
          teamId: participant.team_id,
          type: participant.participant_type || (participant.guest_name ? 'guest' : 'account'),
          membersSnapshot: participant.members_snapshot || null,
          confirmed: participant.confirmed,
          declined: participant.declined,
        }))
      : undefined,
    matches: tournament.matches
      ? tournament.matches.map((match: any) => {
          const sideA = (match.participants || []).filter((participant: any) => participant.side === 'a');
          const sideB = (match.participants || []).filter((participant: any) => participant.side === 'b');
          return {
            id: match.match_id,
            round: match.round,
            position: match.position,
            status: match.status,
            scoreA: match.score_a,
            scoreB: match.score_b,
            sideA: {
              teamName: sideA[0]?.team_name || null,
              players: sideA.map((participant: any) => ({
                displayName: participant.display_name,
                userId: participant.user_id,
                teamId: participant.team_id,
              })),
            },
            sideB: {
              teamName: sideB[0]?.team_name || null,
              players: sideB.map((participant: any) => ({
                displayName: participant.display_name,
                userId: participant.user_id,
                teamId: participant.team_id,
              })),
            },
          };
        })
      : undefined,
    createdAt: tournament.created_at,
    updatedAt: tournament.updated_at,
  };
}

export async function myMatches(req: Request, res: Response) {
  try {
    const userFilter = {
      OR: [{ user_id: req.user.id }, { members_snapshot: { array_contains: [{ userId: req.user.id }] } }],
    };

    const tournaments = await prisma.tournament.findMany({
      where: { participants: { some: userFilter } },
      include: { participants: { where: userFilter } },
      orderBy: { created_at: 'desc' },
    });

    const allMatches: any[] = [];

    for (const tournament of tournaments) {
      if (!tournament.bracket_data) continue;

      const myNames = new Set(tournament.participants.map((participant: any) => participant.display_name));
      if (myNames.size === 0) continue;

      for (const match of extractAllMatches(tournament.bracket_data)) {
        if (!match.participantA || !match.participantB) continue;
        const isA = myNames.has(match.participantA);
        const isB = myNames.has(match.participantB);
        if (!isA && !isB) continue;

        const myName = isA ? match.participantA : match.participantB;
        const opponent = isA ? match.participantB : match.participantA;

        let myResult: 'tie' | 'won' | 'lost' | null = null;
        if (match.completed) {
          if (match.tie) myResult = 'tie';
          else if (match.winner === myName) myResult = 'won';
          else myResult = 'lost';
        }

        allMatches.push({
          id: match.id,
          tournamentId: tournament.tournament_id,
          tournamentName: tournament.name,
          opponent,
          completed: match.completed ?? false,
          myResult,
          tournamentStatus: tournament.status,
          createdAt: tournament.created_at,
        });
      }
    }

    allMatches.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return res.json({ matches: allMatches.slice(0, 5) });
  } catch (err) {
    console.error('[tournament.myMatches]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function extractAllMatches(bracket: any) {
  const matches: any[] = [];
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
