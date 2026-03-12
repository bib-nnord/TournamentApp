import prisma from '../lib/prisma';
import User from '../models/User';
import Friendship from '../models/Friendship';

const userSelect = {
  user_id: true,
  username: true,
  display_name: true,
  avatar_url: true,
};

function toDomainUser(userRow: any): User | null {
  if (!userRow) return null;

  return new User({
    id: userRow.user_id,
    username: userRow.username ?? null,
    displayName: userRow.display_name ?? null,
    deleted: false,
  });
}

export function toDomainFriendship(friendshipRow: any): Friendship {
  return new Friendship({
    id: friendshipRow.friendship_id,
    requesterId: friendshipRow.requester_id,
    recipientId: friendshipRow.recipient_id,
    status: friendshipRow.status,
    requester: toDomainUser(friendshipRow.requester),
    recipient: toDomainUser(friendshipRow.recipient),
    createdAt: friendshipRow.created_at ?? null,
    updatedAt: friendshipRow.updated_at ?? null,
  });
}

export function toFriendListItem(friendship: Friendship, currentUserId: number) {
  const other = friendship.otherUserFor(currentUserId);

  return {
    id: friendship.id,
    userId: other?.id ?? null,
    username: other?.username ?? null,
    displayName: other?.displayName ?? null,
  };
}

export async function findAcceptedByUser(userId: number): Promise<Friendship[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requester_id: userId }, { recipient_id: userId }],
    },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { updated_at: 'desc' },
  });

  return friendships.map(toDomainFriendship);
}

export async function findPendingIncoming(userId: number): Promise<Friendship[]> {
  const friendships = await prisma.friendship.findMany({
    where: { recipient_id: userId, status: 'pending' },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { created_at: 'desc' },
  });

  return friendships.map(toDomainFriendship);
}

export async function findPendingOutgoing(userId: number): Promise<Friendship[]> {
  const friendships = await prisma.friendship.findMany({
    where: { requester_id: userId, status: 'pending' },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { created_at: 'desc' },
  });

  return friendships.map(toDomainFriendship);
}

export async function createRequest(requesterId: number, recipientId: number): Promise<Friendship> {
  const friendship = await prisma.friendship.create({
    data: { requester_id: requesterId, recipient_id: recipientId },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  return toDomainFriendship(friendship);
}

export async function findById(friendshipId: number): Promise<Friendship | null> {
  const friendship = await prisma.friendship.findUnique({
    where: { friendship_id: friendshipId },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  if (!friendship) return null;
  return toDomainFriendship(friendship);
}

export async function acceptById(friendshipId: number): Promise<Friendship> {
  const friendship = await prisma.friendship.update({
    where: { friendship_id: friendshipId },
    data: { status: 'accepted' },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  return toDomainFriendship(friendship);
}

export async function findAcceptedByTargetUser(targetUserId: number): Promise<Friendship[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requester_id: targetUserId }, { recipient_id: targetUserId }],
    },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { updated_at: 'desc' },
  });

  return friendships.map(toDomainFriendship);
}

export async function findBetweenUsers(userId: number, targetUserId: number): Promise<Friendship | null> {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requester_id: userId, recipient_id: targetUserId },
        { requester_id: targetUserId, recipient_id: userId },
      ],
    },
    include: {
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  if (!friendship) return null;
  return toDomainFriendship(friendship);
}
