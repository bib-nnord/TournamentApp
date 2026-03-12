import type { Request, Response } from 'express';

import prisma from '../lib/prisma';

type MessagePrivacy = 'everyone' | 'friends_only';

export async function list(req: Request, res: Response) {
  try {
    const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 20, 1), 100);
    const q = String(req.query.q ?? '').trim();

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
        select: {
          user_id: true,
          username: true,
          display_name: true,
          avatar_url: true,
          bio: true,
          location: true,
          created_at: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((user: any) => ({
        id: user.user_id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        location: user.location,
        createdAt: user.created_at.toISOString(),
      })),
      page,
      totalPages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('[users/list]', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function search(req: Request, res: Response) {
  try {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 10, 50);

    if (!q) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { display_name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { username: 'asc' },
      select: {
        user_id: true,
        username: true,
        display_name: true,
        avatar_url: true,
      },
    });

    const result = users.map((user: any) => ({
      id: user.user_id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    }));

    res.json(result);
  } catch (err) {
    console.error('[users/search]', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: req.user.id },
      select: {
        user_id: true,
        username: true,
        email: true,
        display_name: true,
        bio: true,
        location: true,
        avatar_url: true,
        allow_messages_from: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.user_id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      bio: user.bio,
      location: user.location,
      avatarUrl: user.avatar_url,
      allowMessagesFrom: user.allow_messages_from,
    });
  } catch (err) {
    console.error('[users/me]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function updateMe(req: Request, res: Response) {
  try {
    const data: { allow_messages_from?: MessagePrivacy } = {};
    const { allowMessagesFrom } = req.body as { allowMessagesFrom?: MessagePrivacy };

    if (allowMessagesFrom !== undefined) {
      if (!['everyone', 'friends_only'].includes(allowMessagesFrom)) {
        return res.status(400).json({ error: 'allowMessagesFrom must be "everyone" or "friends_only"' });
      }
      data.allow_messages_from = allowMessagesFrom;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await prisma.user.update({
      where: { user_id: req.user.id },
      data,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[users/updateMe]', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
}
