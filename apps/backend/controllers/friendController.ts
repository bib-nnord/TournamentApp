import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import * as friendService from '../services/friendService';

export async function listFriends(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const friendships = await friendService.findAcceptedByUser(userId);

    const friends = friendships.map((friendship: any) => friendService.toFriendListItem(friendship, userId));
    return res.json({ friends });
  } catch (err) {
    console.error('[friends.list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listRequests(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const [incomingRaw, outgoingRaw] = await Promise.all([
      friendService.findPendingIncoming(userId),
      friendService.findPendingOutgoing(userId),
    ]);

    return res.json({
      incoming: incomingRaw.map((friendship: any) => friendService.toFriendListItem(friendship, userId)),
      outgoing: outgoingRaw.map((friendship: any) => friendService.toFriendListItem(friendship, userId)),
    });
  } catch (err) {
    console.error('[friends.listRequests]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendRequest(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const { username } = req.body as { username?: string };

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const target = await prisma.user.findUnique({
      where: { username: username.trim() },
      select: { user_id: true, username: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.user_id === userId) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requester_id: userId, recipient_id: target.user_id },
          { requester_id: target.user_id, recipient_id: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ error: 'You are already friends with this user' });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ error: 'Friend request already pending' });
      }
      if (existing.status === 'blocked') {
        return res.status(403).json({ error: 'Unable to send friend request' });
      }
    }

    const friendship = await friendService.createRequest(userId, target.user_id);

    await prisma.message.create({
      data: {
        sender_id: userId,
        recipient_id: target.user_id,
        category: 'users',
        subject: 'Friend request',
        body: `${req.user.username} sent you a friend request.`,
        reference_id: friendship.id,
      },
    });

    return res.status(201).json({ friendship: friendService.toFriendListItem(friendship, userId) });
  } catch (err) {
    console.error('[friends.sendRequest]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function acceptRequest(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(String(req.params.id), 10);

    const friendship = await friendService.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (friendship.recipientId !== userId) {
      return res.status(403).json({ error: 'Only the recipient can accept' });
    }
    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' });
    }

    const updated = await friendService.acceptById(friendshipId);

    await prisma.message.create({
      data: {
        sender_id: userId,
        recipient_id: friendship.requesterId,
        category: 'users',
        subject: 'Friend request accepted',
        body: `${req.user.username} accepted your friend request.`,
        reference_id: friendship.id,
      },
    });

    return res.json({ friendship: friendService.toFriendListItem(updated, userId) });
  } catch (err) {
    console.error('[friends.accept]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function declineRequest(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(String(req.params.id), 10);

    const friendship = await friendService.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (friendship.recipientId !== userId) {
      return res.status(403).json({ error: 'Only the recipient can decline' });
    }
    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been answered' });
    }

    await prisma.friendship.delete({ where: { friendship_id: friendshipId } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends.decline]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function removeFriend(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(String(req.params.id), 10);

    const friendship = await friendService.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }
    if (friendship.requesterId !== userId && friendship.recipientId !== userId) {
      return res.status(403).json({ error: 'Not your friendship' });
    }

    await prisma.friendship.delete({ where: { friendship_id: friendshipId } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends.remove]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listUserFriends(req: Request, res: Response) {
  try {
    const username = String(req.params.username);

    const target = await prisma.user.findUnique({
      where: { username },
      select: { user_id: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendships = await friendService.findAcceptedByTargetUser(target.user_id);

    const friends = friendships.map((friendship: any) => friendService.toFriendListItem(friendship, target.user_id));
    return res.json({ friends });
  } catch (err) {
    console.error('[friends.listUserFriends]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStatus(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const username = String(req.params.username);

    const target = await prisma.user.findUnique({
      where: { username },
      select: { user_id: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.user_id === userId) {
      return res.json({ status: 'self' });
    }

    const friendship = await friendService.findBetweenUsers(userId, target.user_id);

    if (!friendship) {
      return res.json({ status: 'none' });
    }

    if (friendship.status === 'accepted') {
      return res.json({ status: 'accepted', friendshipId: friendship.id });
    }

    if (friendship.status === 'pending') {
      return res.json({ status: friendship.directionFor(userId), friendshipId: friendship.id });
    }

    return res.json({ status: friendship.status, friendshipId: friendship.id });
  } catch (err) {
    console.error('[friends.getStatus]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
