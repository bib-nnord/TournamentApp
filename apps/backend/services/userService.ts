import prisma from '../lib/prisma';
import User from '../models/User';

// ─── Prisma select sets ──────────────────────────────────────────────────────

export const userListSelect = {
  user_id: true,
  username: true,
  display_name: true,
  avatar_url: true,
  bio: true,
  location: true,
  created_at: true,
};

export const userSearchSelect = {
  user_id: true,
  username: true,
  display_name: true,
  avatar_url: true,
};

export const userProfileSelect = {
  user_id: true,
  username: true,
  email: true,
  display_name: true,
  bio: true,
  location: true,
  avatar_url: true,
  allow_messages_from: true,
};

// ─── Row → Model ─────────────────────────────────────────────────────────────

export function userFromRow(row: Record<string, any>): User {
  return new User({
    id: row.user_id ?? row.id ?? null,
    username: row.username ?? null,
    displayName: row.display_name ?? row.displayName ?? null,
    email: row.email ?? null,
    bio: row.bio ?? null,
    location: row.location ?? null,
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    allowMessagesFrom: row.allow_messages_from ?? row.allowMessagesFrom ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    deleted: false,
  });
}

// ─── Model → Response ────────────────────────────────────────────────────────

export function mapUserProfile(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    location: user.location,
    avatarUrl: user.avatarUrl,
    allowMessagesFrom: user.allowMessagesFrom,
  };
}

export function mapUserListItem(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    createdAt: user.createdAt?.toISOString() ?? null,
  };
}

export function mapUserSearchResult(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function findUserById(userId: number): Promise<User | null> {
  const row = await prisma.user.findUnique({
    where: { user_id: userId },
    select: userProfileSelect,
  });
  if (!row) return null;
  return userFromRow(row);
}

export async function searchUsers(q: string, limit: number): Promise<User[]> {
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { display_name: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { username: 'asc' },
    select: userSearchSelect,
  });

  return rows.map(userFromRow);
}

export async function listUsers(page: number, limit: number, q?: string) {
  const where: any = q
    ? {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { display_name: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: userListSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: rows.map(userFromRow),
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
