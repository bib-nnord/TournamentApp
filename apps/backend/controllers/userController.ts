import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import * as userService from '../services/userService';

type MessagePrivacy = 'everyone' | 'friends_only';

export async function list(req: Request, res: Response) {
  try {
    const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 20, 1), 100);
    const q = String(req.query.q ?? '').trim();

    const result = await userService.listUsers(page, limit, q || undefined);

    res.json({ ...result, page });
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

    const result = await userService.searchUsers(q, limit);
    res.json(result);
  } catch (err) {
    console.error('[users/search]', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await userService.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(userService.mapUserProfile(user));
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
