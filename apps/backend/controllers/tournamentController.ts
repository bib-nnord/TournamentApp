import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import { notifyUsers, collectAllUserIds } from '../lib/notify';
import { publishTeamNewsToTeams } from '../lib/teamNews';

// ─── Shared formatter (used by quick & scheduled controllers too) ────────────

export const tournamentCreatorSelect = { user_id: true, username: true, display_name: true } as const;

export const tournamentParticipantInclude = {
  orderBy: { seed: 'asc' as const },
  include: {
    user: { select: { username: true } },
  },
} as const;

export function formatTournament(tournament: any) {
  return {
    id: tournament.tournament_id,
    name: tournament.name,
    game: tournament.game,
    description: tournament.description,
    format: tournament.format,
    creationMode: tournament.creation_mode,
    status: tournament.status,
    isPrivate: tournament.is_private,
    registrationMode: tournament.registration_mode,
    autoStart: tournament.auto_start,
    teamMode: tournament.team_mode,
    teamAssignments: tournament.team_assignments,
    max: tournament.max_participants,
    startDate: tournament.start_date,
    bracketData: tournament.bracket_data,
    previewBracketData: tournament.preview_bracket_data,
    registrationClosesAt: tournament.registration_closes_at,
    startedAt: tournament.started_at,
    creator: tournament.creator
      ? {
          id: tournament.creator.user_id,
          username: tournament.creator.username,
          displayName: tournament.creator.display_name ?? null,
        }
      : undefined,
    participants: tournament.participants
      ? tournament.participants.map((participant: any) => ({
          seed: participant.seed,
          displayName: participant.display_name,
          username: participant.user?.username ?? null,
          guestName: participant.guest_name,
          userId: participant.user_id,
          teamId: participant.team_id,
          type: participant.participant_type || (participant.guest_name ? 'guest' : 'account'),
          membersSnapshot: participant.members_snapshot || null,
          confirmed: participant.confirmed,
          declined: participant.declined,
          registrationStatus: participant.registration_status,
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

// ─── Shared CRUD handlers ────────────────────────────────────────────────────

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
          creator: { select: tournamentCreatorSelect },
        },
      }),
      prisma.tournament.count({ where }),
    ]);

    // Fetch match progress for active tournaments
    const activeTournamentIds = tournaments
      .filter((t: any) => t.status === 'active')
      .map((t: any) => t.tournament_id);

    const matchStats: Record<number, { total: number; completed: number }> = {};
    if (activeTournamentIds.length > 0) {
      const matchGroups = await prisma.match.groupBy({
        by: ['tournament_id', 'status'],
        where: { tournament_id: { in: activeTournamentIds } },
        _count: { match_id: true },
      });
      for (const group of matchGroups) {
        const tid = group.tournament_id!;
        if (!matchStats[tid]) matchStats[tid] = { total: 0, completed: 0 };
        matchStats[tid].total += group._count.match_id;
        if (group.status === 'completed' || group.status === 'tie') {
          matchStats[tid].completed += group._count.match_id;
        }
      }
    }

    const joinedTournamentIds = new Set<number>();
    if (req.user && tournaments.length > 0) {
      const participantRows = await prisma.tournamentParticipant.findMany({
        where: {
          tournament_id: { in: tournaments.map((t: any) => t.tournament_id) },
          OR: [
            { user_id: req.user.id },
            { members_snapshot: { array_contains: [{ userId: req.user.id }] } },
          ],
          declined: false,
          registration_status: { notIn: ['declined', 'withdrawn'] as any },
        },
        select: { tournament_id: true },
      });
      for (const row of participantRows) {
        joinedTournamentIds.add(row.tournament_id);
      }
    }

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
        creator: {
          id: t.creator.user_id,
          username: t.creator.username,
          displayName: t.creator.display_name ?? null,
        },
        createdAt: t.created_at,
        startDate: t.start_date ?? null,
        startedAt: t.started_at ?? null,
        isJoined: req.user
          ? t.created_by === req.user.id || joinedTournamentIds.has(t.tournament_id)
          : false,
        matchProgress: t.status === 'active'
          ? (matchStats[t.tournament_id] ?? { total: 0, completed: 0 })
          : undefined,
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
        participants: tournamentParticipantInclude,
        creator: { select: tournamentCreatorSelect },
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

    const { name, game, description, status, bracketData, previewBracketData, startDate, isPrivate, clientUpdatedAt } = req.body as any;

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
    if (previewBracketData !== undefined) data.preview_bracket_data = previewBracketData;
    if (startDate !== undefined) data.start_date = startDate ? new Date(startDate) : null;
    if (isPrivate !== undefined) data.is_private = isPrivate;

    const updated = await prisma.tournament.update({
      where: { tournament_id: id },
      data,
      include: {
        participants: tournamentParticipantInclude,
        creator: { select: tournamentCreatorSelect },
      },
    });

    if (status === 'completed' || status === 'cancelled') {
      const confirmedParticipants = updated.participants.filter((participant: any) => participant.confirmed);
      const recipientIds = collectAllUserIds(confirmedParticipants).filter((uid: number) => uid !== req.user.id);
      const verb = status === 'completed' ? 'has been completed' : 'has been cancelled';
      notifyUsers(recipientIds, `${tournament.name} ${verb}`, `The tournament "${tournament.name}" ${verb}.`, tournament.tournament_id);

      if (status === 'completed') {
        const teamIds = confirmedParticipants
          .map((participant: { team_id?: number | null }) => participant.team_id ?? null)
          .filter((teamId: number | null): teamId is number => teamId != null);
        try {
          await publishTeamNewsToTeams(
            teamIds,
            `Tournament completed: ${tournament.name}`,
            `The tournament "${tournament.name}" has been completed.`
          );
        } catch (newsErr) {
          console.error('[tournament.update.teamNews]', newsErr);
        }
      }
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

// ─── My Matches ──────────────────────────────────────────────────────────────

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
