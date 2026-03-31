import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import * as teamService from '../services/teamService';
import { publishTeamNews } from '../lib/teamNews';

export async function list(req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 6, 1), 20);

    const teams = await prisma.team.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { role: 'lead' },
          take: 1,
          include: {
            user: { select: { user_id: true, username: true, display_name: true } },
          },
        },
      },
    });

    return res.json({
      teams: teams.map((team) => ({
        id: team.team_id,
        name: team.name,
        bio: team.description ?? null,
        open: team.is_open,
        allowApplications: !team.is_open,
        members: team._count.members,
        disciplines: team.disciplines ?? [],
        leader: team.members[0]
          ? {
              id: team.members[0].user.user_id,
              username: team.members[0].user.username,
              displayName: team.members[0].user.display_name ?? null,
            }
          : null,
        createdAt: team.created_at,
      })),
    });
  } catch (err) {
    console.error('[teams/list]', err);
    return res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

export async function search(req: Request, res: Response) {
  try {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 10, 50);

    if (!q) {
      return res.json([]);
    }

    const teams = await prisma.team.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        members: {
          include: {
            user: { select: { user_id: true, username: true, display_name: true } },
          },
          orderBy: { role: 'asc' },
        },
        creator: { select: { user_id: true, username: true, display_name: true } },
      },
    });

    const result = teams.map((row: any) => teamService.mapTeamSearchResult(teamService.teamFromRow(row)));

    res.json(result);
  } catch (err) {
    console.error('[teams/search]', err);
    res.status(500).json({ error: 'Failed to search teams' });
  }
}

export async function myTeams(req: Request, res: Response) {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { user_id: req.user.id },
      include: {
        team: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    const teams = memberships.map((m) => teamService.mapTeamSummary(teamService.teamSummaryFromMembershipRow(m)));

    res.json({ teams });
  } catch (err) {
    console.error('[teams/my]', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

export async function myApplications(req: Request, res: Response) {
  try {
    const sentApps = await prisma.message.findMany({
      where: {
        sender_id: req.user.id,
        category: 'teams',
        folder: 'sent',
        subject: 'Team application',
        reference_id: { not: null },
      },
      select: { reference_id: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });

    if (sentApps.length === 0) {
      return res.json({ teams: [] });
    }

    const teamIds = sentApps.map((a) => a.reference_id!);

    // Exclude teams where the user is already a member (application was accepted)
    const memberships = await prisma.teamMember.findMany({
      where: { user_id: req.user.id, team_id: { in: teamIds } },
      select: { team_id: true },
    });
    const memberTeamIds = new Set(memberships.map((m) => m.team_id));
    const pendingTeamIds = teamIds.filter((id) => !memberTeamIds.has(id));

    if (pendingTeamIds.length === 0) {
      return res.json({ teams: [] });
    }

    const teams = await prisma.team.findMany({
      where: { team_id: { in: pendingTeamIds } },
      include: { _count: { select: { members: true } } },
    });

    const appliedAtMap = new Map(sentApps.map((a) => [a.reference_id, a.created_at]));

    return res.json({
      teams: teams.map((t) => ({
        id: t.team_id,
        name: t.name,
        open: t.is_open,
        members: t._count.members,
        appliedAt: appliedAtMap.get(t.team_id)?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error('[teams/myApplications]', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
}

export async function userTeams(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const memberships = await prisma.teamMember.findMany({
      where: { user_id: userId },
      include: {
        team: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    const teams = memberships.map((m) => teamService.mapTeamSummary(teamService.teamSummaryFromMembershipRow(m)));

    res.json({ teams });
  } catch (err) {
    console.error('[teams/user]', err);
    res.status(500).json({ error: 'Failed to fetch user teams' });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const row = await prisma.team.findUnique({
      where: { team_id: teamId },
      include: {
        creator: { select: { user_id: true, username: true, display_name: true } },
        members: {
          include: {
            user: { select: { user_id: true, username: true, display_name: true } },
          },
          orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
        },
      },
    });

    if (!row) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const currentUserId = req.user?.id ?? null;
    const team = teamService.teamFromRow(row, currentUserId);
    return res.json({ team: teamService.mapTeamDetail(team) });
  } catch (err) {
    console.error('[teams/getById]', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
}

export async function news(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const membership = await teamService.findMembership(teamId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 20, 1), 100);

    const messages = await prisma.message.findMany({
      where: {
        category: 'teams',
        folder: 'inbox',
        recipient_id: req.user.id,
        reference_id: teamId,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return res.json({
      news: messages.map((message) => ({
        id: message.message_id,
        subject: message.subject,
        body: message.body,
        read: message.is_read,
        time: message.created_at.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[teams/news]', err);
    return res.status(500).json({ error: 'Failed to fetch team news' });
  }
}

export async function markAllNewsRead(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const membership = await teamService.findMembership(teamId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.message.updateMany({
      where: {
        category: 'teams',
        folder: 'inbox',
        recipient_id: req.user.id,
        reference_id: teamId,
        is_read: false,
      },
      data: { is_read: true },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[teams/markAllNewsRead]', err);
    return res.status(500).json({ error: 'Failed to mark team news as read' });
  }
}

export async function allNews(req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 10, 1), 50);

    const messages = await prisma.message.findMany({
      where: {
        category: 'teams',
        folder: 'inbox',
        recipient_id: req.user.id,
        subject: { not: 'Team invitation' },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return res.json({
      news: messages.map((message) => ({
        id: message.message_id,
        teamId: message.reference_id,
        subject: message.subject,
        body: message.body,
        read: message.is_read,
        time: message.created_at.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[teams/allNews]', err);
    return res.status(500).json({ error: 'Failed to fetch team news' });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const { name, description, open, disciplines } = req.body as {
      name?: string;
      description?: string;
      open?: boolean;
      disciplines?: string[];
    };

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const created = await prisma.$transaction(async (tx: any) => {
      const team = await tx.team.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          is_open: !!open,
          disciplines: Array.isArray(disciplines) ? disciplines : [],
          created_by: userId,
        },
      });

      await tx.teamMember.create({
        data: {
          team_id: team.team_id,
          user_id: userId,
          role: 'lead',
        },
      });

      return tx.teamMember.findUnique({
        where: {
          team_id_user_id: {
            team_id: team.team_id,
            user_id: userId,
          },
        },
        include: {
          team: {
            include: {
              _count: { select: { members: true } },
            },
          },
        },
      });
    });

    return res.status(201).json({ team: teamService.mapTeamSummary(teamService.teamSummaryFromMembershipRow(created)) });
  } catch (err) {
    console.error('[teams/create]', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const membership = await teamService.findMembership(teamId, req.user.id);

    if (!membership || (membership.role !== 'lead' && membership.role !== 'moderator')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { name, description, open, disciplines } = req.body as {
      name?: string;
      description?: string;
      open?: boolean;
      disciplines?: string[];
    };

    const data: {
      name?: string;
      description?: string | null;
      is_open?: boolean;
      disciplines?: string[];
    } = {};

    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (open !== undefined) data.is_open = !!open;
    if (disciplines !== undefined) data.disciplines = Array.isArray(disciplines) ? disciplines : [];

    const updated = await prisma.team.update({
      where: { team_id: teamId },
      data,
      include: {
        creator: { select: { user_id: true, username: true, display_name: true } },
        members: {
          include: {
            user: { select: { user_id: true, username: true, display_name: true } },
          },
          orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
        },
      },
    });

    return res.json({ team: teamService.mapTeamDetail(teamService.teamFromRow(updated, req.user.id)) });
  } catch (err) {
    console.error('[teams/update]', err);
    res.status(500).json({ error: 'Failed to update team' });
  }
}

export async function join(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const team = await prisma.team.findUnique({ where: { team_id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.is_open) return res.status(403).json({ error: 'This team is closed' });

    const existing = await teamService.findMembership(teamId, req.user.id);
    if (existing) return res.status(409).json({ error: 'Already a member' });

    await prisma.teamMember.create({
      data: { team_id: teamId, user_id: req.user.id, role: 'member' },
    });

    try {
      const user = await prisma.user.findUnique({
        where: { user_id: req.user.id },
        select: { username: true, display_name: true },
      });
      const memberName = user?.display_name || user?.username || 'A member';
      await publishTeamNews(teamId, `${memberName} joined ${team.name}`, `${memberName} just joined the team.`);
    } catch (newsErr) {
      console.error('[teams/join.news]', newsErr);
    }

    const refreshed = await prisma.team.findUnique({
      where: { team_id: teamId },
      include: {
        creator: { select: { user_id: true, username: true, display_name: true } },
        members: {
          include: { user: { select: { user_id: true, username: true, display_name: true } } },
          orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
        },
      },
    });

    return res.json({ team: teamService.mapTeamDetail(teamService.teamFromRow(refreshed!, req.user.id)) });
  } catch (err) {
    console.error('[teams/join]', err);
    res.status(500).json({ error: 'Failed to join team' });
  }
}

export async function apply(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const [team, applicant] = await Promise.all([
      prisma.team.findUnique({ where: { team_id: teamId }, select: { team_id: true, name: true, is_open: true } }),
      prisma.user.findUnique({ where: { user_id: req.user.id }, select: { user_id: true, username: true, display_name: true } }),
    ]);

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.is_open) return res.status(400).json({ error: 'This team is open. Use join instead.' });

    const existing = await teamService.findMembership(teamId, req.user.id);
    if (existing) return res.status(409).json({ error: 'Already a member' });

    const existingApplication = await prisma.message.findFirst({
      where: {
        sender_id: req.user.id,
        category: 'teams',
        folder: 'sent',
        subject: 'Team application',
        reference_id: teamId,
      },
      select: { message_id: true },
    });
    if (existingApplication) {
      return res.status(409).json({ error: 'You already sent an application to this team' });
    }

    const approvers = await prisma.teamMember.findMany({
      where: { team_id: teamId, role: { in: ['lead', 'moderator'] as any } },
      include: { user: { select: { user_id: true, username: true, display_name: true } } },
    });

    if (approvers.length === 0) {
      return res.status(400).json({ error: 'This team cannot accept applications right now' });
    }

    const applicantName = applicant?.display_name || applicant?.username || 'A user';
    const applicantUsername = applicant?.username || 'unknown';

    await prisma.$transaction([
      ...approvers.map((member) =>
        prisma.message.create({
          data: {
            sender_id: req.user.id,
            recipient_id: member.user.user_id,
            sender_name: applicantName,
            recipient_name: member.user.display_name || member.user.username,
            category: 'teams',
            folder: 'inbox',
            subject: 'Team application',
            body: `${applicantName} (@${applicantUsername}) applied to join "${team.name}".`,
            reference_id: teamId,
          },
        })
      ),
      prisma.message.create({
        data: {
          sender_id: req.user.id,
          recipient_id: req.user.id,
          sender_name: applicantName,
          recipient_name: applicantName,
          category: 'teams',
          folder: 'sent',
          subject: 'Team application',
          body: `You applied to join "${team.name}".`,
          reference_id: teamId,
          is_read: true,
        },
      }),
    ]);

    try {
      await publishTeamNews(
        teamId,
        `New application for ${team.name}`,
        `${applicantName} applied to join the team.`
      );
    } catch (newsErr) {
      console.error('[teams/apply.news]', newsErr);
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[teams/apply]', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
}

export async function withdrawApplication(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    // Delete the applicant's sent copy
    const sentCopy = await prisma.message.findFirst({
      where: {
        sender_id: req.user.id,
        category: 'teams',
        folder: 'sent',
        subject: 'Team application',
        reference_id: teamId,
      },
      select: { message_id: true },
    });

    if (!sentCopy) {
      return res.status(404).json({ error: 'No pending application found for this team' });
    }

    // Delete all related application messages (inbox copies to approvers + sent copy)
    await prisma.message.deleteMany({
      where: {
        sender_id: req.user.id,
        category: 'teams',
        subject: 'Team application',
        reference_id: teamId,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[teams/withdrawApplication]', err);
    res.status(500).json({ error: 'Failed to withdraw application' });
  }
}

export async function inviteMember(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const actorMembership = await teamService.findMembership(teamId, req.user.id);
    if (!actorMembership || (actorMembership.role !== 'lead' && actorMembership.role !== 'moderator')) {
      return res.status(403).json({ error: 'Not authorized to invite members' });
    }

    const username = String((req.body as { username?: string }).username ?? '').trim();
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    const [team, targetUser, senderUser] = await Promise.all([
      prisma.team.findUnique({ where: { team_id: teamId }, select: { team_id: true, name: true } }),
      prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
        select: { user_id: true, username: true, display_name: true },
      }),
      prisma.user.findUnique({
        where: { user_id: req.user.id },
        select: { user_id: true, username: true, display_name: true },
      }),
    ]);

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.user_id === req.user.id) return res.status(400).json({ error: 'You cannot invite yourself' });

    const existingMembership = await teamService.findMembership(teamId, targetUser.user_id);
    if (existingMembership) {
      return res.status(409).json({ error: 'User is already a member of this team' });
    }

    const pendingInvite = await prisma.message.findFirst({
      where: {
        category: 'teams',
        folder: 'inbox',
        recipient_id: targetUser.user_id,
        reference_id: teamId,
        subject: 'Team invitation',
        is_read: false,
      },
      select: { message_id: true },
    });

    if (pendingInvite) {
      return res.status(409).json({ error: 'A pending invite already exists for this user' });
    }

    const senderName = senderUser?.display_name || senderUser?.username || null;
    const recipientName = targetUser.display_name || targetUser.username;

    await prisma.$transaction([
      prisma.message.create({
        data: {
          sender_id: req.user.id,
          recipient_id: targetUser.user_id,
          sender_name: senderName,
          recipient_name: recipientName,
          category: 'teams',
          folder: 'inbox',
          subject: 'Team invitation',
          body: `${senderName || 'A team member'} invited you to join the team "${team.name}".`,
          reference_id: teamId,
        },
      }),
      prisma.message.create({
        data: {
          sender_id: req.user.id,
          recipient_id: targetUser.user_id,
          sender_name: senderName,
          recipient_name: recipientName,
          category: 'teams',
          folder: 'sent',
          subject: 'Team invitation',
          body: `You invited ${recipientName} to join "${team.name}".`,
          reference_id: teamId,
          is_read: true,
        },
      }),
    ]);

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[teams/inviteMember]', err);
    return res.status(500).json({ error: 'Failed to send invite' });
  }
}

export async function leave(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const membership = await teamService.findMembership(teamId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Not a member' });

    if (membership.role === 'lead') {
      const otherLeads = await prisma.teamMember.count({
        where: { team_id: teamId, role: 'lead', NOT: { user_id: req.user.id } },
      });
      if (otherLeads === 0) {
        return res.status(400).json({ error: 'Transfer leadership before leaving, or disband the team' });
      }
    }

    await prisma.teamMember.delete({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
    });

    return res.status(204).send();
  } catch (err) {
    console.error('[teams/leave]', err);
    res.status(500).json({ error: 'Failed to leave team' });
  }
}

export async function updateMember(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    const targetId = parseInt(String(req.params.userId), 10);
    if (isNaN(teamId) || isNaN(targetId)) return res.status(400).json({ error: 'Invalid IDs' });

    const actorMembership = await teamService.findMembership(teamId, req.user.id);
    if (!actorMembership || actorMembership.role !== 'lead') {
      return res.status(403).json({ error: 'Only the team lead can change roles' });
    }

    const { role } = req.body as { role?: 'moderator' | 'member' };
    if (!['moderator', 'member'].includes(String(role))) {
      return res.status(400).json({ error: 'Role must be moderator or member' });
    }

    const updated = await prisma.teamMember.update({
      where: { team_id_user_id: { team_id: teamId, user_id: targetId } },
      data: { role },
      include: { user: { select: { user_id: true, username: true, display_name: true } } },
    });

    return res.json({
      member: {
        id: updated.user.user_id,
        username: updated.user.username,
        displayName: updated.user.display_name,
        role: updated.role,
      },
    });
  } catch (err) {
    console.error('[teams/updateMember]', err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
}

export async function kickMember(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    const targetId = parseInt(String(req.params.userId), 10);
    if (isNaN(teamId) || isNaN(targetId)) return res.status(400).json({ error: 'Invalid IDs' });

    const actorMembership = await teamService.findMembership(teamId, req.user.id);
    if (!actorMembership) return res.status(403).json({ error: 'Not authorized' });

    const targetMembership = await teamService.findMembership(teamId, targetId);
    if (!targetMembership) return res.status(404).json({ error: 'Member not found' });

    const canKick = actorMembership.role === 'lead' || (actorMembership.role === 'moderator' && targetMembership.role === 'member');

    if (!canKick) return res.status(403).json({ error: 'Not authorized to kick this member' });

    await prisma.teamMember.delete({
      where: { team_id_user_id: { team_id: teamId, user_id: targetId } },
    });

    return res.status(204).send();
  } catch (err) {
    console.error('[teams/kickMember]', err);
    res.status(500).json({ error: 'Failed to kick member' });
  }
}

export async function disband(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const membership = await teamService.findMembership(teamId, req.user.id);
    if (!membership || membership.role !== 'lead') {
      return res.status(403).json({ error: 'Only the team lead can disband the team' });
    }

    await prisma.$transaction([
      prisma.teamMember.deleteMany({ where: { team_id: teamId } }),
      prisma.team.delete({ where: { team_id: teamId } }),
    ]);

    return res.status(204).send();
  } catch (err) {
    console.error('[teams/disband]', err);
    res.status(500).json({ error: 'Failed to disband team' });
  }
}
