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
  date_of_birth: true,
  bio: true,
  location: true,
  games_sports: true,
  avatar_url: true,
  allow_messages_from: true,
  bio_public: true,
  location_public: true,
  age_public: true,
  games_sports_public: true,
};

// ─── Row → Model ─────────────────────────────────────────────────────────────

export function userFromRow(row: Record<string, any>): User {
  return new User({
    id: row.user_id ?? row.id ?? null,
    username: row.username ?? null,
    displayName: row.display_name ?? row.displayName ?? null,
    email: row.email ?? null,
    dateOfBirth: row.date_of_birth ?? row.dateOfBirth ?? null,
    bio: row.bio ?? null,
    location: row.location ?? null,
    gamesSports: row.games_sports ?? row.gamesSports ?? [],
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    allowMessagesFrom: row.allow_messages_from ?? row.allowMessagesFrom ?? null,
    bioPublic: row.bio_public ?? row.bioPublic ?? true,
    locationPublic: row.location_public ?? row.locationPublic ?? true,
    agePublic: row.age_public ?? row.agePublic ?? true,
    gamesSportsPublic: row.games_sports_public ?? row.gamesSportsPublic ?? true,
    createdAt: row.created_at ?? row.createdAt ?? null,
    deleted: false,
  });
}

function calculateAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;

  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  const beforeBirthday =
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < dateOfBirth.getDate());

  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

// ─── Model → Response ────────────────────────────────────────────────────────

export function mapUserProfile(user: User, isOwnProfile = false) {
  const age = calculateAge(user.dateOfBirth);

  return {
    id: user.id,
    username: user.username,
    email: isOwnProfile ? user.email : null,
    displayName: user.displayName,
    dateOfBirth: isOwnProfile && user.dateOfBirth
      ? user.dateOfBirth.toISOString().slice(0, 10)
      : null,
    bio: isOwnProfile || user.bioPublic ? user.bio : null,
    country: isOwnProfile || user.locationPublic ? user.location : null,
    age: isOwnProfile || user.agePublic ? age : null,
    gamesSports: isOwnProfile || user.gamesSportsPublic ? user.gamesSports : [],
    avatarUrl: user.avatarUrl,
    allowMessagesFrom: isOwnProfile ? user.allowMessagesFrom : null,
    visibility: {
      bio: user.bioPublic,
      country: user.locationPublic,
      age: user.agePublic,
      gamesSports: user.gamesSportsPublic,
    },
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

export async function findUserByUsername(username: string): Promise<User | null> {
  const row = await prisma.user.findUnique({
    where: { username },
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
