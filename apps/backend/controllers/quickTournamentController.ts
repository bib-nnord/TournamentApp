import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import { notifyUsers, collectAllUserIds } from '../lib/notify';
import { publishTeamNewsToTeams } from '../lib/teamNews';
import Tournament from '../models/Tournament';
import * as tournamentService from '../services/tournamentService';
import { formatTournament, tournamentCreatorSelect, tournamentParticipantInclude } from './tournamentController';

export async function create(req: Request, res: Response) {
  const { name, game, description, format, isPrivate, participants, bracketData, maxParticipants, startDate, status, teamMode } =
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
      teamMode?: boolean;
    };

  const isTeamMode = teamMode ?? false;

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

  if (!isTeamMode && participants.some((participant) => participant?.type === 'team')) {
    return res.status(400).json({ error: 'Regular mode tournaments only allow individual participants (accounts or guests)' });
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
          registration_status: creatorIsMember ? 'approved' : 'invited',
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
          registration_status: resolved?.user_id === req.user.id ? 'approved' : 'invited',
        };
      }

      return {
        ...base,
        participant_type: 'guest',
        guest_name: participant.name,
        registration_status: 'approved',
      };
    });

    const tournament: any = await prisma.tournament.create({
      data: {
        name,
        game,
        description: description || null,
        format: format as any,
        creation_mode: 'quick' as any,
        status: (status || 'active') as any,
        is_private: isPrivate ?? false,
        team_mode: isTeamMode,
        registration_mode: 'invite_only',
        auto_start: false,
        max_participants: maxParticipants ?? participants.length,
        start_date: startDate ? new Date(startDate) : null,
        bracket_data: bracketData ?? null,
        preview_bracket_data: bracketData ?? null,
        created_by: req.user.id,
        participants: {
          create: participantRecords as any,
        },
      },
      include: {
        participants: tournamentParticipantInclude,
        creator: { select: tournamentCreatorSelect },
      },
    });

    const recipientIds = collectAllUserIds(tournament.participants).filter((uid: number) => uid !== req.user.id);
    notifyUsers(
      recipientIds,
      `You've been added to ${name}`,
      `You have been added as a participant in the tournament "${name}" (${game}). Visit the tournament page to review and accept or decline.`,
      tournament.tournament_id
    );

    const participatingTeamIds = tournament.participants
      .map((participant: { team_id?: number | null }) => participant.team_id ?? null)
      .filter((teamId: number | null): teamId is number => teamId != null);

    if (tournament.start_date && new Date(tournament.start_date).getTime() > Date.now() && participatingTeamIds.length > 0) {
      const startText = new Date(tournament.start_date).toLocaleString();
      try {
        await publishTeamNewsToTeams(
          participatingTeamIds,
          `Upcoming tournament: ${name}`,
          `${name} (${game}) is scheduled for ${startText}.`
        );
      } catch (newsErr) {
        console.error('[tournament.create.teamNews]', newsErr);
      }
    }

    return res.status(201).json(formatTournament(tournament));
  } catch (err) {
    console.error('[tournament.create]', err);
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
        data: { confirmed: true, registration_status: 'approved' as any },
      });
    } else {
      await prisma.tournamentParticipant.update({
        where: {
          tournament_id_seed: { tournament_id: id, seed: participant.seed },
        },
        data: { declined: true, registration_status: 'declined' as any },
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
        tournamentService.clearParticipant(tournamentModel, name);
        await prisma.tournament.update({
          where: { tournament_id: id },
          data: { bracket_data: tournamentModel.bracket_data as any },
        });
      }
    }

    const updated = await prisma.tournament.findUnique({
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

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.confirmParticipation]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
