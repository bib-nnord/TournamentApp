import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import User from '../models/User';
import Team, { TeamMember, TeamSummary } from '../models/Team';
import type { TeamRole } from '../models/Team';

export type { TeamRole } from '../models/Team';

// ─── Prisma include sets ─────────────────────────────────────────────────────

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

// ─── Row → Model ─────────────────────────────────────────────────────────────

function teamMemberFromRow(row: Record<string, any>): TeamMember {
  return new TeamMember({
    id: row.user?.user_id ?? row.user_id ?? row.id,
    username: row.user?.username ?? row.username ?? null,
    displayName: row.user?.display_name ?? row.display_name ?? row.displayName ?? null,
    role: row.role ?? 'member',
  });
}

export function teamFromRow(row: Record<string, any>, currentUserId: number | null = null): Team {
  const members = (row.members ?? []).map((m: Record<string, any>) => teamMemberFromRow(m));
  const creator = row.creator
    ? new User({
        id: row.creator.user_id ?? null,
        username: row.creator.username ?? null,
        displayName: row.creator.display_name ?? null,
      })
    : null;
  const myMembership = currentUserId
    ? (row.members ?? []).find((m: Record<string, any>) => m.user_id === currentUserId)
    : null;

  return new Team({
    id: row.team_id ?? row.id,
    name: row.name,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    isOpen: row.is_open ?? false,
    disciplines: row.disciplines ?? [],
    creator,
    members,
    membersCount: members.length,
    myRole: myMembership ? myMembership.role : 'none',
  });
}

export function teamSummaryFromMembershipRow(row: Record<string, any>): TeamSummary {
  return new TeamSummary({
    id: row.team.team_id,
    name: row.team.name,
    role: row.role,
    membersCount: row.team._count?.members ?? 0,
    isOpen: row.team.is_open ?? false,
  });
}

// ─── Model → Response ────────────────────────────────────────────────────────

export function mapTeamDetail(team: Team) {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    imageUrl: team.imageUrl,
    open: team.isOpen,
    disciplines: team.disciplines,
    createdBy: team.creator
      ? {
          id: team.creator.id,
          username: team.creator.username,
          displayName: team.creator.displayName,
        }
      : null,
    members: team.members.map((m) => ({
      id: m.id,
      username: m.username,
      displayName: m.displayName,
      role: m.role,
    })),
    membersCount: team.membersCount,
    myRole: team.myRole,
  };
}

export function mapTeamSearchResult(team: Team) {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    imageUrl: team.imageUrl,
    isOpen: team.isOpen,
    createdBy: team.creator
      ? {
          id: team.creator.id,
          username: team.creator.username,
          displayName: team.creator.displayName,
        }
      : null,
    members: team.members.map((m) => ({
      userId: m.id,
      username: m.username,
      displayName: m.displayName,
      role: m.role,
    })),
  };
}

export function mapTeamSummary(summary: TeamSummary) {
  return {
    id: summary.id,
    name: summary.name,
    role: summary.role,
    members: summary.membersCount,
    open: summary.isOpen,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function findTeamById(teamId: number, currentUserId: number | null = null): Promise<Team | null> {
  const row = await prisma.team.findUnique({
    where: { team_id: teamId },
    include: teamDetailInclude,
  });

  if (!row) return null;
  return teamFromRow(row, currentUserId);
}

export async function findMembershipsByUser(userId: number): Promise<TeamSummary[]> {
  const memberships = await prisma.teamMember.findMany({
    where: { user_id: userId },
    include: membershipSummaryInclude,
    orderBy: { joined_at: 'desc' },
  });

  return memberships.map(teamSummaryFromMembershipRow);
}

export async function findMembership(teamId: number, userId: number) {
  return prisma.teamMember.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: userId } },
  });
}
