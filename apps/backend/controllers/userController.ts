import type { Request, Response } from 'express';

import bcrypt from 'bcryptjs';
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

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  const passwordErrors: string[] = [];
  if (newPassword.length < 8) passwordErrors.push('at least 8 characters');
  if (!/[a-z]/.test(newPassword)) passwordErrors.push('at least one lowercase letter');
  if (!/[A-Z]/.test(newPassword)) passwordErrors.push('at least one uppercase letter');
  if (!/[^a-zA-Z0-9]/.test(newPassword)) passwordErrors.push('at least one special character');
  if (passwordErrors.length > 0) {
    const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(passwordErrors);
    return res.status(400).json({ error: `Password must contain ${list}` });
  }

  try {
    const user = await prisma.user.findUnique({ where: { user_id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const password_hash = await bcrypt.hash(newPassword, 16);
    await prisma.user.update({ where: { user_id: req.user.id }, data: { password_hash } });

    res.json({ ok: true });
  } catch (err) {
    console.error('[users/changePassword]', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

export async function changeEmail(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { user_id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Password is incorrect' });

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.user_id !== req.user.id) {
      return res.status(409).json({ error: 'Email is already in use' });
    }

    await prisma.user.update({ where: { user_id: req.user.id }, data: { email: normalizedEmail } });

    res.json({ ok: true });
  } catch (err) {
    console.error('[users/changeEmail]', err);
    res.status(500).json({ error: 'Failed to change email' });
  }
}
