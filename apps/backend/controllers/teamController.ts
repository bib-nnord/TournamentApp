import type { Request, Response } from 'express';

import prisma from '../lib/prisma';

type TeamRole = 'lead' | 'moderator' | 'member' | 'none';

function mapTeamSummaryFromMembership(membership: any) {
  return {
    id: membership.team.team_id,
    name: membership.team.name,
    role: membership.role,
    members: membership.team._count.members,
    open: membership.team.is_open,
  };
}

function mapTeamDetail(team: any, currentUserId: number | null = null) {
  const members = team.members.map((member: any) => ({
    id: member.user.user_id,
    username: member.user.username,
    displayName: member.user.display_name,
    role: member.role,
  }));

  const myMembership = currentUserId ? team.members.find((member: any) => member.user_id === currentUserId) : null;

  return {
    id: team.team_id,
    name: team.name,
    description: team.description,
    imageUrl: team.image_url,
    open: team.is_open,
    disciplines: team.disciplines ?? [],
    createdBy: team.creator
      ? {
          id: team.creator.user_id,
          username: team.creator.username,
          displayName: team.creator.display_name,
        }
      : null,
    members,
    membersCount: members.length,
    myRole: (myMembership ? myMembership.role : 'none') as TeamRole,
  };
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

    const result = teams.map((team: any) => ({
      id: team.team_id,
      name: team.name,
      description: team.description,
      imageUrl: team.image_url,
      isOpen: team.is_open,
      createdBy: team.creator,
      members: team.members.map((member: any) => ({
        userId: member.user.user_id,
        username: member.user.username,
        displayName: member.user.display_name,
        role: member.role,
      })),
    }));

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

    const teams = memberships.map(mapTeamSummaryFromMembership);

    res.json({ teams });
  } catch (err) {
    console.error('[teams/my]', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
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

    const teams = memberships.map(mapTeamSummaryFromMembership);

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

    const team = await prisma.team.findUnique({
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

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const currentUserId = req.user?.id ?? null;
    return res.json({ team: mapTeamDetail(team, currentUserId) });
  } catch (err) {
    console.error('[teams/getById]', err);
    res.status(500).json({ error: 'Failed to fetch team' });
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

    return res.status(201).json({ team: mapTeamSummaryFromMembership(created) });
  } catch (err) {
    console.error('[teams/create]', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const membership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
    });

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

    const team = await prisma.team.update({
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

    return res.json({ team: mapTeamDetail(team, req.user.id) });
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

    const existing = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
    });
    if (existing) return res.status(409).json({ error: 'Already a member' });

    await prisma.teamMember.create({
      data: { team_id: teamId, user_id: req.user.id, role: 'member' },
    });

    const updated = await prisma.team.findUnique({
      where: { team_id: teamId },
      include: {
        creator: { select: { user_id: true, username: true, display_name: true } },
        members: {
          include: { user: { select: { user_id: true, username: true, display_name: true } } },
          orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
        },
      },
    });

    return res.json({ team: mapTeamDetail(updated, req.user.id) });
  } catch (err) {
    console.error('[teams/join]', err);
    res.status(500).json({ error: 'Failed to join team' });
  }
}

export async function leave(req: Request, res: Response) {
  try {
    const teamId = parseInt(String(req.params.id), 10);
    if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const membership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
    });
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

    const actorMembership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
    });
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

    const actorMembership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
    });
    if (!actorMembership) return res.status(403).json({ error: 'Not authorized' });

    const targetMembership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: targetId } },
    });
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

    const membership = await prisma.teamMember.findUnique({
      where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
    });
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
