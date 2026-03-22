import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import { notifyUsers, collectAllUserIds } from '../lib/notify';
import { generateBracket } from '../lib/generateBracket';
import Tournament from '../models/Tournament';
import * as tournamentService from '../services/tournamentService';
import { formatTournament } from './tournamentController';

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_TOURNAMENT_FORMATS = [
  'single_elimination',
  'double_elimination',
  'round_robin',
  'double_round_robin',
  'combination',
  'swiss',
] as const;

const VALID_REGISTRATION_MODES = ['invite_only', 'open', 'approval'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextSeed(participants: Array<{ seed: number }>): number {
  if (participants.length === 0) return 1;
  return Math.max(...participants.map((participant) => participant.seed)) + 1;
}

function isRegistrationClosed(tournament: { registration_closes_at: Date | null }): boolean {
  if (!tournament.registration_closes_at) return false;
  return new Date(tournament.registration_closes_at).getTime() < Date.now();
}

function countsAgainstCapacity(status: string): boolean {
  return status !== 'declined' && status !== 'withdrawn';
}

function countActiveCompetitors(
  tournament: { max_participants: number | null; team_mode?: boolean; team_assignments?: unknown },
  participants: Array<{ registration_status: string; participant_type?: string }>,
): number {
  if (!tournament.team_mode) {
    return participants.filter((participant) => countsAgainstCapacity(participant.registration_status)).length;
  }

  const assignments = Array.isArray(tournament.team_assignments) ? tournament.team_assignments : null;
  if (assignments) {
    return assignments.length;
  }

  return participants.filter(
    (participant) => countsAgainstCapacity(participant.registration_status) && participant.participant_type === 'team',
  ).length;
}

function hasCapacity(
  tournament: { max_participants: number | null; team_mode?: boolean; team_assignments?: unknown },
  participants: Array<{ registration_status: string; participant_type?: string }>,
  nextParticipantType: 'account' | 'team',
): boolean {
  if (!tournament.max_participants) return true;
  if (tournament.team_mode && nextParticipantType !== 'team') {
    return true;
  }

  const activeCount = countActiveCompetitors(tournament, participants);
  return activeCount < tournament.max_participants;
}

function isParticipantByUser(participant: any, userId: number): boolean {
  if (participant.user_id === userId) return true;
  if (Array.isArray(participant.members_snapshot)) {
    return participant.members_snapshot.some((member: any) => member.userId === userId);
  }
  return false;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function validateTournamentId(rawValue: unknown): number | null {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const id = parseInt(String(value), 10);
  return isNaN(id) ? null : id;
}

function isScheduledRegistrationOpen(tournament: any): boolean {
  return tournament.creation_mode === 'scheduled' && tournament.status === 'registration' && !isRegistrationClosed(tournament);
}

type ScheduledInviteInput = {
  type?: 'account' | 'team';
  userId?: number;
  username?: string;
  teamId?: number;
  displayName?: string;
};

type ResolvedScheduledInvite = {
  participant_type: 'account' | 'team';
  user_id?: number;
  team_id?: number;
  display_name: string;
  members_snapshot?: Array<{ name: string; type: 'account'; userId: number }>;
  confirmed: boolean;
  declined: boolean;
  registration_status: 'invited' | 'approved';
};

async function resolveScheduledInvites(
  inviteEntries: ScheduledInviteInput[],
  isTeamMode: boolean,
  requesterId: number,
): Promise<ResolvedScheduledInvite[]> {
  const usernameInvites = [...new Set(
    inviteEntries
      .filter((invite) => invite.type === 'account' && invite.username)
      .map((invite) => normalizeName(String(invite.username)))
  )];
  const userIdInvites = [...new Set(
    inviteEntries
      .filter((invite) => invite.type === 'account' && Number.isInteger(invite.userId))
      .map((invite) => Number(invite.userId))
  )];
  const teamIdInvites = [...new Set(
    inviteEntries
      .filter((invite) => invite.type === 'team' && Number.isInteger(invite.teamId))
      .map((invite) => Number(invite.teamId))
  )];

  const [usersByUsername, usersById, teams] = await Promise.all([
    usernameInvites.length > 0
      ? prisma.user.findMany({
          where: { username: { in: usernameInvites, mode: 'insensitive' } },
          select: { user_id: true, username: true, display_name: true },
        })
      : Promise.resolve([]),
    userIdInvites.length > 0
      ? prisma.user.findMany({
          where: { user_id: { in: userIdInvites } },
          select: { user_id: true, username: true, display_name: true },
        })
      : Promise.resolve([]),
    teamIdInvites.length > 0
      ? prisma.team.findMany({
          where: { team_id: { in: teamIdInvites } },
          select: {
            team_id: true,
            name: true,
            members: {
              include: { user: { select: { user_id: true, username: true, display_name: true } } },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const userByUsername = new Map(usersByUsername.map((user) => [normalizeName(user.username), user]));
  const userById = new Map(usersById.map((user) => [user.user_id, user]));
  const teamById = new Map(teams.map((team) => [team.team_id, team]));

  for (const username of usernameInvites) {
    if (!userByUsername.has(username)) {
      throw new Error(`Invited account not found: ${username}`);
    }
  }
  for (const userId of userIdInvites) {
    if (!userById.has(userId)) {
      throw new Error(`Invited account not found: ${userId}`);
    }
  }
  for (const teamId of teamIdInvites) {
    if (!teamById.has(teamId)) {
      throw new Error(`Invited team not found: ${teamId}`);
    }
  }

  const participantRecords: ResolvedScheduledInvite[] = [];
  const seenUsers = new Set<number>();
  const seenTeams = new Set<number>();
  const seenDisplayNames = new Set<string>();

  for (const invite of inviteEntries) {
    if (invite.type === 'team') {
      if (!isTeamMode) {
        throw new Error('Regular mode tournaments only accept individual account invites');
      }
      if (!Number.isInteger(invite.teamId)) {
        throw new Error('Team invite requires teamId');
      }

      const team = teamById.get(Number(invite.teamId));
      if (!team) {
        throw new Error(`Invited team not found: ${invite.teamId}`);
      }
      if (seenTeams.has(team.team_id)) continue;

      const displayName = invite.displayName?.trim() || team.name;
      const normalizedDisplay = normalizeName(displayName);
      if (seenDisplayNames.has(normalizedDisplay)) {
        throw new Error(`Duplicate participant display name: "${displayName}"`);
      }

      seenTeams.add(team.team_id);
      seenDisplayNames.add(normalizedDisplay);
      const creatorIsMember = team.members.some((member) => member.user.user_id === requesterId);
      participantRecords.push({
        participant_type: 'team',
        team_id: team.team_id,
        display_name: displayName,
        members_snapshot: team.members.map((member) => ({
          name: member.user.display_name || member.user.username,
          type: 'account',
          userId: member.user.user_id,
        })),
        confirmed: creatorIsMember,
        declined: false,
        registration_status: creatorIsMember ? 'approved' : 'invited',
      });
      continue;
    }

    if (invite.type === 'account') {
      const resolvedUser = Number.isInteger(invite.userId)
        ? userById.get(Number(invite.userId))
        : invite.username
          ? userByUsername.get(normalizeName(String(invite.username)))
          : null;

      if (!resolvedUser) {
        throw new Error('Account invite requires a valid userId or username');
      }
      if (seenUsers.has(resolvedUser.user_id)) continue;

      const displayName = invite.displayName?.trim() || resolvedUser.display_name || resolvedUser.username;
      const normalizedDisplay = normalizeName(displayName);
      if (seenDisplayNames.has(normalizedDisplay)) {
        throw new Error(`Duplicate participant display name: "${displayName}"`);
      }

      seenUsers.add(resolvedUser.user_id);
      seenDisplayNames.add(normalizedDisplay);
      const isCreatorInvite = resolvedUser.user_id === requesterId;
      participantRecords.push({
        participant_type: 'account',
        user_id: resolvedUser.user_id,
        display_name: displayName,
        confirmed: isCreatorInvite,
        declined: false,
        registration_status: isCreatorInvite ? 'approved' : 'invited',
      });
    }
  }

  return participantRecords;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function createScheduled(req: Request, res: Response) {
  const {
    name,
    game,
    description,
    format,
    isPrivate,
    registrationMode,
    maxParticipants,
    startDate,
    registrationClosesAt,
    autoStart,
    teamMode,
    invites,
  } = req.body as {
    name?: string;
    game?: string;
    description?: string;
    format?: string;
    isPrivate?: boolean;
    registrationMode?: string;
    maxParticipants?: number;
    startDate?: string;
    registrationClosesAt?: string;
    autoStart?: boolean;
    teamMode?: boolean;
    invites?: Array<{ type?: 'account' | 'team'; userId?: number; username?: string; teamId?: number; displayName?: string }>;
  };

  if (!name || !game || !format) {
    return res.status(400).json({ error: 'name, game, and format are required' });
  }

  if (!VALID_TOURNAMENT_FORMATS.includes(format as any)) {
    return res.status(400).json({ error: `Invalid format. Must be one of: ${VALID_TOURNAMENT_FORMATS.join(', ')}` });
  }

  if (registrationMode && !VALID_REGISTRATION_MODES.includes(registrationMode as any)) {
    return res.status(400).json({ error: `Invalid registrationMode. Must be one of: ${VALID_REGISTRATION_MODES.join(', ')}` });
  }

  if (maxParticipants !== undefined && (!Number.isInteger(maxParticipants) || maxParticipants < 2)) {
    return res.status(400).json({ error: 'maxParticipants must be an integer >= 2' });
  }

  const isPrivateTournament = isPrivate ?? false;
  const resolvedRegistrationMode = isPrivateTournament ? 'invite_only' : (registrationMode ?? 'open');
  const isTeamMode = teamMode ?? false;

  const inviteEntries = Array.isArray(invites) ? invites : [];

  if (!isTeamMode && inviteEntries.some((invite) => invite.type === 'team')) {
    return res.status(400).json({ error: 'Regular mode tournaments only accept individual account invites' });
  }

  try {
    const resolvedInviteRecords = await resolveScheduledInvites(inviteEntries, isTeamMode, req.user.id);
    const participantRecords = resolvedInviteRecords.map((participant, index) => ({
      seed: index + 1,
      ...participant,
    }));

    const invitedCompetitorCount = isTeamMode
      ? participantRecords.filter((participant) => participant.participant_type === 'team').length
      : participantRecords.length;

    if (maxParticipants !== undefined && invitedCompetitorCount > maxParticipants) {
      return res.status(400).json({
        error: isTeamMode
          ? 'Number of invited teams cannot exceed maxParticipants'
          : 'Number of invites cannot exceed maxParticipants',
      });
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        game,
        description: description || null,
        format: format as any,
        creation_mode: 'scheduled' as any,
        status: 'registration' as any,
        is_private: isPrivateTournament,
        registration_mode: resolvedRegistrationMode as any,
        auto_start: autoStart ?? false,
        team_mode: isTeamMode,
        max_participants: maxParticipants ?? null,
        start_date: startDate ? new Date(startDate) : null,
        registration_closes_at: registrationClosesAt ? new Date(registrationClosesAt) : null,
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

    const recipientIds = collectAllUserIds(tournament.participants).filter((userId: number) => userId !== req.user.id);
    if (recipientIds.length > 0) {
      notifyUsers(
        recipientIds,
        `You were invited to ${tournament.name}`,
        `You have been invited to join the scheduled tournament "${tournament.name}" (${tournament.game}).`,
        tournament.tournament_id,
      );
    }

    return res.status(201).json(formatTournament(tournament));
  } catch (err) {
    console.error('[tournament.createScheduled]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function inviteScheduled(req: Request, res: Response) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  const { invites } = req.body as { invites?: ScheduledInviteInput[] };
  const inviteEntries = Array.isArray(invites) ? invites : [];

  if (inviteEntries.length === 0) {
    return res.status(400).json({ error: 'At least one invite is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Invite endpoint is only available for scheduled tournaments' });
    }
    if (!isScheduledRegistrationOpen(tournament)) {
      return res.status(400).json({ error: 'Tournament registration is closed' });
    }
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can invite participants' });
    }
    if (!tournament.team_mode && inviteEntries.some((invite) => invite.type === 'team')) {
      return res.status(400).json({ error: 'Regular mode tournaments only accept individual account invites' });
    }

    const resolvedInviteRecords = await resolveScheduledInvites(inviteEntries, tournament.team_mode, req.user.id);
    const workingParticipants: any[] = [...tournament.participants];
    const operations: any[] = [];
    const notificationParticipants: any[] = [];
    let nextSeed = getNextSeed(tournament.participants);

    for (const invite of resolvedInviteRecords) {
      const existingParticipant = workingParticipants.find((participant: any) =>
        invite.participant_type === 'team'
          ? participant.team_id === invite.team_id
          : participant.user_id === invite.user_id
      );

      if (existingParticipant && countsAgainstCapacity(existingParticipant.registration_status)) {
        return res.status(400).json({ error: `${invite.display_name} is already part of this tournament` });
      }

      const duplicateDisplayName = workingParticipants.some((participant: any) => {
        const sameEntry = invite.participant_type === 'team'
          ? participant.team_id === invite.team_id
          : participant.user_id === invite.user_id;
        return !sameEntry &&
          countsAgainstCapacity(participant.registration_status) &&
          normalizeName(participant.display_name) === normalizeName(invite.display_name);
      });

      if (duplicateDisplayName) {
        return res.status(400).json({ error: `Participant name "${invite.display_name}" is already taken` });
      }

      if (!existingParticipant && !hasCapacity(tournament, workingParticipants as any, invite.participant_type)) {
        return res.status(400).json({ error: 'Tournament is full' });
      }

      if (existingParticipant) {
        operations.push(prisma.tournamentParticipant.update({
          where: { tournament_id_seed: { tournament_id: tournamentId, seed: existingParticipant.seed } },
          data: {
            display_name: invite.display_name,
            team_id: invite.team_id ?? null,
            user_id: invite.user_id ?? null,
            members_snapshot: invite.members_snapshot as any,
            confirmed: invite.confirmed,
            declined: false,
            registration_status: invite.registration_status as any,
          },
        }));

        Object.assign(existingParticipant, {
          display_name: invite.display_name,
          team_id: invite.team_id ?? null,
          user_id: invite.user_id ?? null,
          participant_type: invite.participant_type,
          members_snapshot: invite.members_snapshot ?? null,
          confirmed: invite.confirmed,
          declined: false,
          registration_status: invite.registration_status,
        });
      } else {
        operations.push(prisma.tournamentParticipant.create({
          data: {
            tournament_id: tournamentId,
            seed: nextSeed,
            participant_type: invite.participant_type,
            team_id: invite.team_id ?? null,
            user_id: invite.user_id ?? null,
            display_name: invite.display_name,
            members_snapshot: invite.members_snapshot as any,
            confirmed: invite.confirmed,
            declined: false,
            registration_status: invite.registration_status as any,
          },
        }));

        workingParticipants.push({
          seed: nextSeed,
          participant_type: invite.participant_type,
          team_id: invite.team_id ?? null,
          user_id: invite.user_id ?? null,
          display_name: invite.display_name,
          members_snapshot: invite.members_snapshot ?? null,
          confirmed: invite.confirmed,
          declined: false,
          registration_status: invite.registration_status,
        });
        nextSeed += 1;
      }

      notificationParticipants.push({
        user_id: invite.user_id ?? null,
        members_snapshot: invite.members_snapshot ?? null,
        team_id: invite.team_id ?? null,
        display_name: invite.display_name,
      });
    }

    operations.push(prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data: { preview_bracket_data: null as any },
    }));

    await prisma.$transaction(operations);

    const updated = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    const recipientIds = collectAllUserIds(notificationParticipants).filter((userId: number) => userId !== req.user.id);
    if (recipientIds.length > 0) {
      notifyUsers(
        recipientIds,
        `You were invited to ${tournament.name}`,
        `You have been invited to join the scheduled tournament "${tournament.name}" (${tournament.game}).`,
        tournament.tournament_id,
      );
    }

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.inviteScheduled]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = err instanceof Error && !message.includes('Internal server error') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}

export async function registerScheduled(req: Request, res: Response) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  const { teamId } = req.body as { teamId?: number };

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Register endpoint is only available for scheduled tournaments' });
    }
    if (!isScheduledRegistrationOpen(tournament)) {
      return res.status(400).json({ error: 'Tournament registration is closed' });
    }
    if (tournament.registration_mode === 'invite_only') {
      return res.status(400).json({ error: 'This tournament is invite-only' });
    }

    if (!tournament.team_mode && Number.isInteger(teamId)) {
      return res.status(400).json({ error: 'Regular mode tournaments do not accept team registrations. Register as an individual player.' });
    }

    const mode = tournament.registration_mode;
    const requesterIsCreator = req.user.id === tournament.created_by;
    const registrationStatus = requesterIsCreator || mode === 'open' ? 'approved' : 'pending';
    const confirmed = requesterIsCreator || mode === 'open';

    if (Number.isInteger(teamId)) {
      const team = await prisma.team.findUnique({
        where: { team_id: Number(teamId) },
        include: {
          members: {
            include: { user: { select: { user_id: true, username: true, display_name: true } } },
          },
        },
      });

      if (!team) return res.status(404).json({ error: 'Team not found' });

      const requesterIsMember = team.members.some((member) => member.user_id === req.user.id);
      if (!requesterIsMember) {
        return res.status(403).json({ error: 'You must be a team member to register this team' });
      }

      const existingParticipant = tournament.participants.find((participant: any) => participant.team_id === team.team_id);
      if (existingParticipant && countsAgainstCapacity(existingParticipant.registration_status)) {
        return res.status(400).json({ error: 'Team is already registered' });
      }

      if (!existingParticipant && !hasCapacity(tournament, tournament.participants, 'team')) {
        return res.status(400).json({ error: 'Tournament is full' });
      }

      const duplicateDisplayName = tournament.participants.some(
        (participant: any) =>
          participant.team_id !== team.team_id &&
          countsAgainstCapacity(participant.registration_status) &&
          normalizeName(participant.display_name) === normalizeName(team.name),
      );
      if (duplicateDisplayName) {
        return res.status(400).json({ error: `Participant name "${team.name}" is already taken` });
      }

      if (existingParticipant) {
        await prisma.tournamentParticipant.update({
          where: { tournament_id_seed: { tournament_id: tournamentId, seed: existingParticipant.seed } },
          data: {
            display_name: team.name,
            members_snapshot: team.members.map((member) => ({
              name: member.user.display_name || member.user.username,
              type: 'account',
              userId: member.user.user_id,
            })),
            confirmed,
            declined: false,
            registration_status: registrationStatus as any,
          },
        });
      } else {
        await prisma.tournamentParticipant.create({
          data: {
            tournament_id: tournamentId,
            seed: getNextSeed(tournament.participants),
            participant_type: 'team',
            team_id: team.team_id,
            display_name: team.name,
            members_snapshot: team.members.map((member) => ({
              name: member.user.display_name || member.user.username,
              type: 'account',
              userId: member.user.user_id,
            })),
            confirmed,
            declined: false,
            registration_status: registrationStatus as any,
          },
        });
      }
    } else {
      const existingParticipant = tournament.participants.find((participant: any) => participant.user_id === req.user.id);

      if (existingParticipant && countsAgainstCapacity(existingParticipant.registration_status)) {
        return res.status(400).json({ error: 'You are already registered' });
      }

      if (!existingParticipant && !hasCapacity(tournament, tournament.participants, 'account')) {
        return res.status(400).json({ error: 'Tournament is full' });
      }

      const user = await prisma.user.findUnique({
        where: { user_id: req.user.id },
        select: { user_id: true, username: true, display_name: true },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const displayName = user.display_name || user.username;
      const duplicateDisplayName = tournament.participants.some(
        (participant: any) =>
          participant.user_id !== req.user.id &&
          countsAgainstCapacity(participant.registration_status) &&
          normalizeName(participant.display_name) === normalizeName(displayName),
      );
      if (duplicateDisplayName) {
        return res.status(400).json({ error: `Participant name "${displayName}" is already taken` });
      }

      if (existingParticipant) {
        await prisma.tournamentParticipant.update({
          where: { tournament_id_seed: { tournament_id: tournamentId, seed: existingParticipant.seed } },
          data: {
            display_name: displayName,
            confirmed,
            declined: false,
            registration_status: registrationStatus as any,
          },
        });
      } else {
        await prisma.tournamentParticipant.create({
          data: {
            tournament_id: tournamentId,
            seed: getNextSeed(tournament.participants),
            participant_type: 'account',
            user_id: req.user.id,
            display_name: displayName,
            confirmed,
            declined: false,
            registration_status: registrationStatus as any,
          },
        });
      }
    }

    // Invalidate stale preview bracket since participant list changed
    await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data: { preview_bracket_data: null as any },
    });

    const updated = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.registerScheduled]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function unregisterScheduled(req: Request, res: Response) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Unregister endpoint is only available for scheduled tournaments' });
    }

    const participant = tournament.participants.find((candidate: any) => isParticipantByUser(candidate, req.user.id));
    if (!participant) {
      return res.status(404).json({ error: 'You are not registered in this tournament' });
    }
    if (participant.registration_status === 'withdrawn') {
      return res.status(400).json({ error: 'Registration already withdrawn' });
    }

    const tournamentModel = new Tournament({
      tournament_id: tournament.tournament_id,
      name: tournament.name,
      game: tournament.game,
      format: tournament.format as any,
      status: tournament.status as any,
      creation_mode: tournament.creation_mode as any,
      registration_mode: tournament.registration_mode as any,
      created_by: tournament.created_by,
      is_private: tournament.is_private,
      bracket_data: tournament.bracket_data as any,
      preview_bracket_data: tournament.preview_bracket_data as any,
    });

    if (tournamentModel.bracket_data) {
      tournamentService.clearParticipant(tournamentModel, participant.display_name);
    }
    if (tournamentModel.preview_bracket_data) {
      const previewModel = new Tournament({
        tournament_id: tournament.tournament_id,
        name: tournament.name,
        game: tournament.game,
        format: tournament.format as any,
        status: tournament.status as any,
        creation_mode: tournament.creation_mode as any,
        registration_mode: tournament.registration_mode as any,
        created_by: tournament.created_by,
        is_private: tournament.is_private,
        bracket_data: tournament.preview_bracket_data as any,
      });
      tournamentService.clearParticipant(previewModel, participant.display_name);
      tournamentModel.preview_bracket_data = previewModel.bracket_data;
    }

    await prisma.$transaction([
      prisma.tournamentParticipant.update({
        where: { tournament_id_seed: { tournament_id: tournamentId, seed: participant.seed } },
        data: {
          confirmed: false,
          declined: false,
          registration_status: 'withdrawn' as any,
        },
      }),
      prisma.tournament.update({
        where: { tournament_id: tournamentId },
        data: {
          bracket_data: tournamentModel.bracket_data as any,
          preview_bracket_data: tournamentModel.preview_bracket_data as any,
        },
      }),
    ]);

    const updated = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.unregisterScheduled]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function respondInviteScheduled(req: Request, res: Response) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  const { accept } = req.body as { accept?: boolean };
  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: '"accept" must be a boolean' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Invite response endpoint is only available for scheduled tournaments' });
    }

    const participant = tournament.participants.find((candidate: any) => isParticipantByUser(candidate, req.user.id));
    if (!participant) {
      return res.status(404).json({ error: 'You do not have an invite for this tournament' });
    }
    if (participant.registration_status !== 'invited') {
      return res.status(400).json({ error: 'Invite can only be responded to while status is invited' });
    }

    await prisma.tournamentParticipant.update({
      where: { tournament_id_seed: { tournament_id: tournamentId, seed: participant.seed } },
      data: accept
        ? { confirmed: true, declined: false, registration_status: 'approved' as any }
        : { confirmed: false, declined: true, registration_status: 'declined' as any },
    });

    // Invalidate stale preview bracket since participant list changed
    await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data: { preview_bracket_data: null as any },
    });

    const updated = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.respondInviteScheduled]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateParticipantDecision(
  req: Request,
  res: Response,
  decision: 'approved' | 'declined',
) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  const seed = parseInt(String(req.params.seed), 10);
  if (isNaN(seed)) return res.status(400).json({ error: 'Invalid participant seed' });

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Participant decision endpoint is only available for scheduled tournaments' });
    }
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can manage participants' });
    }

    const participant = tournament.participants.find((candidate: any) => candidate.seed === seed);
    if (!participant) return res.status(404).json({ error: 'Participant not found' });

    if (participant.registration_status !== 'pending') {
      return res.status(400).json({ error: 'Only pending applications can be approved or declined by the organizer' });
    }

    const participantType = participant.participant_type === 'team' ? 'team' : 'account';

    if (
      decision === 'approved' &&
      !countsAgainstCapacity(participant.registration_status) &&
      !hasCapacity(tournament, tournament.participants, participantType)
    ) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    const tournamentModel = new Tournament({
      tournament_id: tournament.tournament_id,
      name: tournament.name,
      game: tournament.game,
      format: tournament.format as any,
      status: tournament.status as any,
      creation_mode: tournament.creation_mode as any,
      registration_mode: tournament.registration_mode as any,
      created_by: tournament.created_by,
      is_private: tournament.is_private,
      bracket_data: tournament.bracket_data as any,
      preview_bracket_data: tournament.preview_bracket_data as any,
    });

    if (decision === 'declined') {
      if (tournamentModel.bracket_data) {
        tournamentService.clearParticipant(tournamentModel, participant.display_name);
      }
      if (tournamentModel.preview_bracket_data) {
        const previewModel = new Tournament({
          tournament_id: tournament.tournament_id,
          name: tournament.name,
          game: tournament.game,
          format: tournament.format as any,
          status: tournament.status as any,
          creation_mode: tournament.creation_mode as any,
          registration_mode: tournament.registration_mode as any,
          created_by: tournament.created_by,
          is_private: tournament.is_private,
          bracket_data: tournament.preview_bracket_data as any,
        });
        tournamentService.clearParticipant(previewModel, participant.display_name);
        tournamentModel.preview_bracket_data = previewModel.bracket_data;
      }
    }

    await prisma.$transaction([
      prisma.tournamentParticipant.update({
        where: { tournament_id_seed: { tournament_id: tournamentId, seed } },
        data:
          decision === 'approved'
            ? { confirmed: true, declined: false, registration_status: 'approved' as any }
            : { confirmed: false, declined: true, registration_status: 'declined' as any },
      }),
      prisma.tournament.update({
        where: { tournament_id: tournamentId },
        data: {
          bracket_data: tournamentModel.bracket_data as any,
          // Approval changes participant list, so invalidate stale preview
          preview_bracket_data: decision === 'approved' ? (null as any) : (tournamentModel.preview_bracket_data as any),
        },
      }),
    ]);

    const updated = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.updateParticipantDecision]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function approveScheduledParticipant(req: Request, res: Response) {
  return updateParticipantDecision(req, res, 'approved');
}

export async function declineScheduledParticipant(req: Request, res: Response) {
  return updateParticipantDecision(req, res, 'declined');
}

export async function saveTeamAssignments(req: Request, res: Response) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  const { teams } = req.body as {
    teams?: Array<{ name: string; memberSeeds: number[] }>;
  };

  if (!Array.isArray(teams)) {
    return res.status(400).json({ error: '"teams" must be an array' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    if (!tournament.team_mode) {
      return res.status(400).json({ error: 'Team assignments are only available for team mode tournaments' });
    }
    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Team assignments are only available for scheduled tournaments' });
    }
    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Team assignments can only be modified during registration phase' });
    }
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can assign teams' });
    }

    // Validate team data
    if (teams.length === 0) {
      // Allow clearing assignments
      const updated = await prisma.tournament.update({
        where: { tournament_id: tournamentId },
        data: { team_assignments: null as any, preview_bracket_data: null as any },
        include: {
          participants: { orderBy: { seed: 'asc' } },
          creator: { select: { user_id: true, username: true } },
        },
      });
      return res.json(formatTournament(updated));
    }

    const approvedSeeds = new Set(
      tournament.participants
        .filter((p: any) => p.registration_status === 'approved' && !p.declined)
        .map((p: any) => p.seed),
    );

    const teamNames = new Set<string>();
    const assignedSeeds = new Set<number>();

    for (const team of teams) {
      if (!team.name || typeof team.name !== 'string' || !team.name.trim()) {
        return res.status(400).json({ error: 'Each team must have a non-empty name' });
      }

      const normalizedName = normalizeName(team.name);
      if (teamNames.has(normalizedName)) {
        return res.status(400).json({ error: `Duplicate team name: "${team.name}"` });
      }
      teamNames.add(normalizedName);

      if (!Array.isArray(team.memberSeeds) || team.memberSeeds.length === 0) {
        return res.status(400).json({ error: `Team "${team.name}" must have at least one member` });
      }

      for (const seed of team.memberSeeds) {
        if (!Number.isInteger(seed)) {
          return res.status(400).json({ error: `Invalid member seed in team "${team.name}"` });
        }
        if (!approvedSeeds.has(seed)) {
          return res.status(400).json({ error: `Seed ${seed} is not an approved participant` });
        }
        if (assignedSeeds.has(seed)) {
          return res.status(400).json({ error: `Participant seed ${seed} is assigned to multiple teams` });
        }
        assignedSeeds.add(seed);
      }
    }

    if (tournament.max_participants && teams.length > tournament.max_participants) {
      return res.status(400).json({ error: `Team assignments cannot exceed ${tournament.max_participants} teams` });
    }

    // Build the assignments payload with resolved display names
    const participantBySeed = new Map(
      tournament.participants.map((p: any) => [p.seed, p]),
    );

    const assignments = teams.map((team) => ({
      name: team.name.trim(),
      memberSeeds: team.memberSeeds,
      members: team.memberSeeds.map((seed) => {
        const p = participantBySeed.get(seed)!;
        return {
          seed: p.seed,
          displayName: p.display_name,
          userId: p.user_id,
        };
      }),
    }));

    const updated = await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data: { team_assignments: assignments as any, preview_bracket_data: null as any },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.saveTeamAssignments]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function previewScheduledBracket(req: Request, res: Response) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Preview endpoint is only available for scheduled tournaments' });
    }
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can preview the bracket' });
    }

    const approvedParticipants = tournament.participants.filter(
      (participant: any) => participant.registration_status === 'approved' && !participant.declined,
    );
    if (approvedParticipants.length < 2) {
      return res.status(400).json({ error: 'At least 2 approved participants are required to preview bracket' });
    }

    // In team mode, use team assignment names instead of individual participant names
    let bracketNames: string[];
    if (tournament.team_mode) {
      const assignments = tournament.team_assignments as any[] | null;
      if (!assignments || assignments.length < 2) {
        return res.status(400).json({ error: 'At least 2 teams must be assigned before previewing bracket in team mode' });
      }
      if (tournament.max_participants && assignments.length > tournament.max_participants) {
        return res.status(400).json({ error: `Bracket preview exceeds the ${tournament.max_participants}-team limit` });
      }
      bracketNames = assignments.map((t: any) => t.name);
    } else {
      bracketNames = approvedParticipants.map((participant: any) => participant.display_name);
    }

    const bracket = generateBracket(
      bracketNames,
      tournament.format as any,
    );

    const updated = await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data: { preview_bracket_data: bracket as any },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.previewScheduledBracket]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function startScheduled(req: Request, res: Response) {
  const tournamentId = validateTournamentId(req.params.id);
  if (tournamentId == null) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { tournament_id: tournamentId },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    if (tournament.creation_mode !== 'scheduled') {
      return res.status(400).json({ error: 'Start endpoint is only available for scheduled tournaments' });
    }
    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament creator can start the tournament' });
    }
    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Only registration tournaments can be started' });
    }

    const approvedParticipants = tournament.participants.filter(
      (participant: any) => participant.registration_status === 'approved' && !participant.declined,
    );
    if (approvedParticipants.length < 2) {
      return res.status(400).json({ error: 'At least 2 approved participants are required to start' });
    }

    // In team mode, validate team assignments and use team names
    if (tournament.team_mode) {
      const assignments = tournament.team_assignments as any[] | null;
      if (!assignments || assignments.length < 2) {
        return res.status(400).json({ error: 'At least 2 teams must be assigned before starting in team mode' });
      }
      if (tournament.max_participants && assignments.length > tournament.max_participants) {
        return res.status(400).json({ error: `Tournament exceeds the ${tournament.max_participants}-team limit` });
      }

      // Verify all approved participants are assigned to a team
      const assignedSeeds = new Set(assignments.flatMap((t: any) => t.memberSeeds));
      const unassigned = approvedParticipants.filter((p: any) => !assignedSeeds.has(p.seed));
      if (unassigned.length > 0) {
        const names = unassigned.map((p: any) => p.display_name).join(', ');
        return res.status(400).json({ error: `All approved participants must be assigned to a team. Unassigned: ${names}` });
      }
    }

    let bracketNames: string[];
    if (tournament.team_mode) {
      bracketNames = (tournament.team_assignments as any[]).map((t: any) => t.name);
    } else {
      bracketNames = approvedParticipants.map((participant: any) => participant.display_name);
    }

    const finalBracket =
      (tournament.preview_bracket_data as any) ??
      generateBracket(
        bracketNames,
        tournament.format as any,
      );

    const updated = await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data: {
        status: 'active',
        started_at: new Date(),
        bracket_data: finalBracket,
      },
      include: {
        participants: { orderBy: { seed: 'asc' } },
        creator: { select: { user_id: true, username: true } },
      },
    });

    return res.json(formatTournament(updated));
  } catch (err) {
    console.error('[tournament.startScheduled]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
