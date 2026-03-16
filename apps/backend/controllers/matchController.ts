import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import { notifyUsers, buildNameToUserIds, resolveNamesToUserIds } from '../lib/notify';
import { publishTeamNewsToTeams } from '../lib/teamNews';
import Tournament from '../models/Tournament';
import * as tournamentService from '../services/tournamentService';

export async function reportResult(req: Request, res: Response) {
  const tournamentId = parseInt(String(req.params.id), 10);
  const matchId = String(req.params.matchId);

  if (isNaN(tournamentId)) {
    return res.status(400).json({ error: 'Invalid tournament ID' });
  }

  const { winner, scoreA, scoreB, clientUpdatedAt } = req.body as {
    winner?: string;
    scoreA?: number | string | null;
    scoreB?: number | string | null;
    clientUpdatedAt?: string;
    reset?: boolean;
  };
  const isReset = (req.body as { reset?: boolean }).reset === true;

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

    if (tournament.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament organizer can report results' });
    }

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

    const found = tournamentService.findMatch(tournamentModel, matchId);
    if (!found) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const { match, section, roundIndex } = found;

    if (section === 'tiebreaker') {
      if (isReset) {
        if (tournamentModel.bracket_data?.tiebreaker) {
          tournamentModel.bracket_data.tiebreaker = { id: 'tiebreaker', participants: tournamentModel.bracket_data.tiebreaker.participants };
        }
        const updated = await prisma.tournament.update({
          where: { tournament_id: tournamentId },
          data: { bracket_data: tournamentModel.bracket_data as any },
        });
        return res.json({ bracketData: updated.bracket_data, updatedAt: updated.updated_at });
      }
      if (!tournamentModel.bracket_data?.tiebreaker?.participants.includes(String(winner))) {
        return res.status(400).json({ error: 'Invalid tiebreaker winner' });
      }
      if (tournamentModel.bracket_data?.tiebreaker) {
        tournamentModel.bracket_data.tiebreaker.winner = String(winner);
        tournamentModel.bracket_data.tiebreaker.completed = true;
      }
      const updated = await prisma.tournament.update({
        where: { tournament_id: tournamentId },
        data: { bracket_data: tournamentModel.bracket_data as any },
      });
      return res.json({ bracketData: updated.bracket_data, updatedAt: updated.updated_at });
    }

    if (isReset) {
      return res.status(400).json({ error: 'Reset is only supported for tiebreaker matches' });
    }

    if (!['a', 'b', 'tie'].includes(String(winner))) {
      return res.status(400).json({ error: 'winner must be "a", "b", or "tie"' });
    }

    if (!match.participantA || !match.participantB) {
      return res.status(400).json({ error: 'Match participants are not set yet' });
    }

    const wasEdited = !!match.completed;
    const isTie = winner === 'tie';
    const winnerName = isTie ? null : winner === 'a' ? match.participantA : match.participantB;
    const loserName = isTie ? null : winner === 'a' ? match.participantB : match.participantA;

    match.winner = winnerName;
    match.tie = isTie;
    match.scoreA = scoreA != null ? Number(scoreA) : null;
    match.scoreB = scoreB != null ? Number(scoreB) : null;
    match.completed = true;

    if (!isTie) {
      tournamentService.advanceBracket(tournamentModel, section, roundIndex, match, winnerName, loserName);
    } else if (section.startsWith('group_')) {
      tournamentService.advanceBracket(tournamentModel, section, roundIndex, match, null, null);
    }

    if (tournamentService.isTrueFinalMatch(tournamentModel, section, roundIndex)) {
      if (isTie && !tournamentModel.bracket_data?.tiebreaker?.completed) {
        if (tournamentModel.bracket_data) {
          tournamentModel.bracket_data.tiebreaker = { id: 'tiebreaker', participants: [match.participantA, match.participantB] };
        }
      } else if (!isTie && tournamentModel.bracket_data) {
        delete tournamentModel.bracket_data.tiebreaker;
      }
    }

    if (tournamentModel.bracket_data && ['round_robin', 'double_round_robin', 'swiss'].includes(tournamentModel.bracket_data.format)) {
      if (!tournamentModel.bracket_data.tiebreaker?.completed) {
        const tied = tournamentService.findRRTiedParticipants(tournamentModel);
        if (tied) {
          tournamentModel.bracket_data.tiebreaker = { id: 'tiebreaker', participants: tied };
        } else if (tournamentModel.bracket_data.tiebreaker) {
          delete tournamentModel.bracket_data.tiebreaker;
        }
      }
    }

    const updated = await prisma.tournament.update({
      where: { tournament_id: tournamentId },
      data: { bracket_data: tournamentModel.bracket_data as any },
      include: { participants: true },
    });

    const confirmedParticipants = (updated.participants as any)?.filter((participant: any) => participant.confirmed) ?? [];
    const nameMap = buildNameToUserIds(confirmedParticipants);
    const tournamentName = tournament.name || 'Tournament';

    const sectionLabels: Record<string, string> = { winners: 'Winners Bracket', losers: 'Losers Bracket', knockout: 'Knockout' };
    const sectionLabel = section.startsWith('group_')
      ? `Group ${parseInt(section.split('_')[1], 10) + 1}`
      : (sectionLabels[section] ?? section);
    const roundLabel = roundIndex >= 0 ? `${sectionLabel}, Round ${roundIndex + 1}` : sectionLabel;

    if (match.participantA && match.participantB) {
      const scoreText = match.scoreA != null && match.scoreB != null ? ` Score: ${match.scoreA}–${match.scoreB}.` : '';

      const subject = wasEdited ? `Result updated in ${tournamentName}` : `Match result in ${tournamentName}`;

      const notifyResult = (playerName: string, opponentName: string) => {
        const userIds = resolveNamesToUserIds(nameMap, [playerName]);
        if (userIds.length === 0) return;

        let outcome: string;
        if (isTie) outcome = `You tied against ${opponentName}.`;
        else if (playerName === winnerName) outcome = `You won against ${opponentName}.`;
        else outcome = `You lost against ${opponentName}.`;

        const prefix = wasEdited ? '[Updated] ' : '';

        notifyUsers(userIds, subject, `${prefix}${roundLabel}: ${outcome}${scoreText}`, tournamentId);
      };

      notifyResult(match.participantA, match.participantB);
      notifyResult(match.participantB, match.participantA);

      const teamIdsForCompletedMatch = [...new Set(
        confirmedParticipants
          .filter((participant: any) => [match.participantA, match.participantB].includes(participant.display_name) && participant.team_id != null)
          .map((participant: any) => participant.team_id)
      )] as number[];

      if (teamIdsForCompletedMatch.length > 0) {
        try {
          await publishTeamNewsToTeams(
            teamIdsForCompletedMatch,
            `Match completed: ${tournamentName}`,
            `${match.participantA} vs ${match.participantB} has been completed.${scoreText}`
          );
        } catch (newsErr) {
          console.error('[match.reportResult.teamNews]', newsErr);
        }
      }
    }

    if (!isTie && section !== 'tiebreaker') {
      const allBracketMatches = tournamentService.extractAllMatches(tournamentModel);
      for (const nextMatch of allBracketMatches) {
        if (nextMatch.participantA && nextMatch.participantB && !nextMatch.completed) {
          if (nextMatch.participantA === winnerName || nextMatch.participantB === winnerName) {
            const ids = resolveNamesToUserIds(nameMap, [nextMatch.participantA, nextMatch.participantB]);
            notifyUsers(
              ids,
              `New match in ${tournamentName}`,
              `Your next match is ready: ${nextMatch.participantA} vs ${nextMatch.participantB}.`,
              tournamentId
            );
            break;
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

export async function getMatch(req: Request, res: Response) {
  const tournamentId = parseInt(String(req.params.id), 10);
  const matchId = String(req.params.matchId);

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
      const isParticipant = tournament.participants.some(
        (participant: any) =>
          participant.user_id === req.user?.id ||
          (Array.isArray(participant.members_snapshot) &&
            participant.members_snapshot.some((member: any) => member.userId === req.user?.id))
      );
      if (!req.user || (req.user.id !== tournament.created_by && !isParticipant)) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
    }

    if (!tournament.bracket_data) {
      return res.status(404).json({ error: 'No bracket data' });
    }

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

    const found = tournamentService.findMatch(tournamentModel, matchId);
    if (!found) return res.status(404).json({ error: 'Match not found' });

    return res.json({
      match: found.match,
      section: found.section,
      roundIndex: found.roundIndex,
      allowTies: (tournament.bracket_data as any).allowTies !== false,
      tournament: {
        id: tournament.tournament_id,
        name: tournament.name,
        game: tournament.game,
        format: (tournament.bracket_data as any).format,
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
