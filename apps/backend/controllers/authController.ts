import type { Request, Response } from 'express';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function register(req: Request, res: Response) {
  const { username, email, password, display_name, first_name, last_name, date_of_birth } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
  };

  const requiredFields = { username, email, password, date_of_birth, display_name, first_name, last_name };
  const missing = Object.entries(requiredFields)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const passwordErrors: string[] = [];
  if ((password as string).length < 8) passwordErrors.push('at least 8 characters');
  if (!/[a-z]/.test(password as string)) passwordErrors.push('at least one lowercase letter');
  if (!/[A-Z]/.test(password as string)) passwordErrors.push('at least one uppercase letter');
  if (!/[^a-zA-Z0-9]/.test(password as string)) passwordErrors.push('at least one special character');

  if (passwordErrors.length > 0) {
    const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(passwordErrors);
    return res.status(400).json({ error: `Password must contain ${list}` });
  }

  const dob = new Date(date_of_birth as string);
  if (isNaN(dob.getTime())) {
    return res.status(400).json({ error: 'Invalid date of birth' });
  }

  if (dob > new Date()) {
    return res.status(400).json({ error: 'Date of birth cannot be in the future' });
  }

  if (Math.floor((Date.now() - dob.getTime()) / (365 * 24 * 3600 * 1000)) > 100) {
    return res.status(400).json({ error: 'Invalid date of birth' });
  }

  try {
    const normalizedEmail = (email as string).toLowerCase();

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username }],
      },
    });

    if (existing) {
      const field = existing.email === normalizedEmail ? 'email' : 'username';
      return res.status(409).json({ error: `An account with that ${field} has already been created` });
    }

    const password_hash = await bcrypt.hash(password as string, 16);

    await prisma.user.create({
      data: {
        username: username as string,
        email: normalizedEmail,
        password_hash,
        display_name,
        first_name,
        last_name,
        date_of_birth: new Date(date_of_birth as string),
      },
    });

    return res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  const { email, username, password } = req.body as {
    email?: string;
    username?: string;
    password?: string;
  };

  if ((!email && !username) || !password) {
    return res.status(400).json({ error: 'email/username and password are required' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: email ? { email: email.toLowerCase() } : { username },
    });

    const passwordMatch = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!passwordMatch || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { sub: user.user_id, username: user.username, email: user.email, role: user.site_role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await prisma.refreshToken.create({
      data: {
        token: hashToken(refreshToken),
        user_id: user.user_id,
        expires_at: expiresAt,
      },
    });

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (stored.expires_at < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const accessToken = jwt.sign(
      {
        sub: stored.user.user_id,
        username: stored.user.username,
        email: stored.user.email,
        role: stored.user.site_role,
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.status(200).json({ accessToken });
  } catch (err) {
    console.error('[refresh]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    await prisma.refreshToken.deleteMany({
      where: { token: hashToken(refreshToken) },
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[logout]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
