import type { Request, Response } from 'express';

import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import * as userService from '../services/userService';
import type { MessagePrivacy } from '../models/User';

export async function list(req: Request, res: Response) {
  try {
    const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 20, 1), 100);
    const q = String(req.query.q ?? '').trim();

    const result = await userService.listUsers(page, limit, q || undefined);

    res.json({
      users: result.users.map(userService.mapUserListItem),
      total: result.total,
      totalPages: result.totalPages,
      page,
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

    const users = await userService.searchUsers(q, limit);
    res.json(users.map(userService.mapUserSearchResult));
  } catch (err) {
    console.error('[users/search]', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await userService.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(userService.mapUserProfile(user, true));
  } catch (err) {
    console.error('[users/me]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const username = String(req.params.username ?? '').trim();
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await userService.findUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isOwnProfile = req.user?.id === user.id;
    res.json({ profile: userService.mapUserProfile(user, isOwnProfile) });
  } catch (err) {
    console.error('[users/profile]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function updateMe(req: Request, res: Response) {
  try {
    const data: {
      allow_messages_from?: MessagePrivacy;
      display_name?: string | null;
      bio?: string | null;
      location?: string | null;
      date_of_birth?: Date | null;
      games_sports?: string[];
      bio_public?: boolean;
      location_public?: boolean;
      age_public?: boolean;
      games_sports_public?: boolean;
    } = {};
    const {
      allowMessagesFrom,
      displayName,
      bio,
      country,
      dateOfBirth,
      gamesSports,
      visibility,
    } = req.body as {
      allowMessagesFrom?: MessagePrivacy;
      displayName?: string;
      bio?: string | null;
      country?: string | null;
      dateOfBirth?: string | null;
      gamesSports?: string[];
      visibility?: {
        bio?: boolean;
        country?: boolean;
        age?: boolean;
        gamesSports?: boolean;
      };
    };

    if (allowMessagesFrom !== undefined) {
      if (!['everyone', 'friends_only'].includes(allowMessagesFrom)) {
        return res.status(400).json({ error: 'allowMessagesFrom must be "everyone" or "friends_only"' });
      }
      data.allow_messages_from = allowMessagesFrom;
    }

    if (displayName !== undefined) {
      const normalizedDisplayName = displayName.trim();
      data.display_name = normalizedDisplayName ? normalizedDisplayName : null;
    }

    if (bio !== undefined) {
      if (bio !== null && bio.length > 500) {
        return res.status(400).json({ error: 'Bio must be 500 characters or fewer' });
      }
      data.bio = bio && bio.trim() ? bio.trim() : null;
    }

    if (country !== undefined) {
      if (country !== null && country.length > 100) {
        return res.status(400).json({ error: 'Country must be 100 characters or fewer' });
      }
      data.location = country && country.trim() ? country.trim() : null;
    }

    if (dateOfBirth !== undefined) {
      if (dateOfBirth === null || dateOfBirth === '') {
        data.date_of_birth = null;
      } else {
        const parsedDate = new Date(dateOfBirth);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid date of birth' });
        }
        data.date_of_birth = parsedDate;
      }
    }

    if (gamesSports !== undefined) {
      if (!Array.isArray(gamesSports)) {
        return res.status(400).json({ error: 'gamesSports must be an array of strings' });
      }

      const cleanedGamesSports = [...new Set(
        gamesSports
          .map((item) => String(item).trim())
          .filter(Boolean)
      )].slice(0, 12);

      if (cleanedGamesSports.some((item) => item.length > 40)) {
        return res.status(400).json({ error: 'Each game or sport must be 40 characters or fewer' });
      }

      data.games_sports = cleanedGamesSports;
    }

    if (visibility !== undefined) {
      if (visibility.bio !== undefined) data.bio_public = Boolean(visibility.bio);
      if (visibility.country !== undefined) data.location_public = Boolean(visibility.country);
      if (visibility.age !== undefined) data.age_public = Boolean(visibility.age);
      if (visibility.gamesSports !== undefined) {
        data.games_sports_public = Boolean(visibility.gamesSports);
      }
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
