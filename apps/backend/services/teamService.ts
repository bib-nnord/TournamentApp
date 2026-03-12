import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';

export type TeamRole = 'lead' | 'moderator' | 'member' | 'none';

const teamDetailInclude = {
  creator: { select: { user_id: true, username: true, display_name: true } },
  members: {
    include: {
      user: { select: { user_id: true, username: true, display_name: true } },
    },
    orderBy: [{ role: 'asc' as Prisma.SortOrder }, { joined_at: 'asc' as Prisma.SortOrder }],
  },
} satisfies Prisma.TeamInclude;

const membershipSummaryInclude = {
  team: {
    include: {
      _count: { select: { members: true } },
    },
  },
};

export function mapTeamSummaryFromMembership(membership: any) {
  return {
    id: membership.team.team_id,
    name: membership.team.name,
    role: membership.role,
    members: membership.team._count.members,
    open: membership.team.is_open,
  };
}

export function mapTeamDetail(team: any, currentUserId: number | null = null) {
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

export async function findTeamById(teamId: number, currentUserId: number | null = null) {
  const team = await prisma.team.findUnique({
    where: { team_id: teamId },
    include: teamDetailInclude,
  });

  if (!team) return null;
  return mapTeamDetail(team, currentUserId);
}

export async function findMembershipsByUser(userId: number) {
  const memberships = await prisma.teamMember.findMany({
    where: { user_id: userId },
    include: membershipSummaryInclude,
    orderBy: { joined_at: 'desc' },
  });

  return memberships.map(mapTeamSummaryFromMembership);
}

export async function findMembership(teamId: number, userId: number) {
  return prisma.teamMember.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: userId } },
  });
}
