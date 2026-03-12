import prisma from '../lib/prisma';

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

export function mapUserListItem(user: any) {
  return {
    id: user.user_id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    location: user.location,
    createdAt: user.created_at.toISOString(),
  };
}

export function mapUserSearchResult(user: any) {
  return {
    id: user.user_id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  };
}

export function mapUserProfile(user: any) {
  return {
    id: user.user_id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    bio: user.bio,
    location: user.location,
    avatarUrl: user.avatar_url,
    allowMessagesFrom: user.allow_messages_from,
  };
}

export async function findUserById(userId: number) {
  return prisma.user.findUnique({
    where: { user_id: userId },
    select: userProfileSelect,
  });
}

export async function searchUsers(q: string, limit: number) {
  const users = await prisma.user.findMany({
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

  return users.map(mapUserSearchResult);
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

  const [users, total] = await Promise.all([
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
    users: users.map(mapUserListItem),
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
