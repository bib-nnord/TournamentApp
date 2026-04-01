import type { Request, Response } from 'express';
import type { CookieOptions } from 'express';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { sendEmail } from '../lib/email';
import type { BracketData } from '../models/Tournament';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const isProduction = process.env.NODE_ENV === 'production';
const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';

function authCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

function clearAuthCookies(res: Response): void {
  const clearOptions: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };

  res.clearCookie(ACCESS_TOKEN_COOKIE, clearOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearOptions);
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createAuthSession(
  res: Response,
  user: { user_id: number; username: string | null; email: string; site_role: string },
) {
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

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, authCookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, authCookieOptions(7 * 24 * 60 * 60 * 1000));
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
        site_role: { not: 'guest' },
      },
    });

    if (existing) {
      const field = existing.email === normalizedEmail ? 'email' : 'username';
      return res.status(409).json({ error: `An account with that ${field} has already been created` });
    }

    const password_hash = await bcrypt.hash(password as string, 16);

    // Check if a ghost user exists with this email — clean it up
    const ghost = await prisma.user.findFirst({
      where: { email: normalizedEmail, site_role: 'guest' },
    });

    if (ghost) {
      // Null out user_id on tournament participants (keep guest entries)
      await prisma.tournamentParticipant.updateMany({
        where: { user_id: ghost.user_id },
        data: { user_id: null },
      });
      // Delete ghost's invite tokens (invalidates invite links)
      await prisma.guestInviteToken.deleteMany({
        where: { user_id: ghost.user_id },
      });
      // Delete the ghost user
      await prisma.user.delete({ where: { user_id: ghost.user_id } });
    }

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

    await createAuthSession(res, user);

    return res.status(200).json({
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
  const body = req.body as { refreshToken?: string };
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? body.refreshToken;

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

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, authCookieOptions(15 * 60 * 1000));

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[refresh]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(req: Request, res: Response) {
  const body = req.body as { refreshToken?: string };
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? body.refreshToken;

  try {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: hashToken(refreshToken) },
      });
    }

    clearAuthCookies(res);

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[logout]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
    }

    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { user_id: user.user_id },
    });

    // Generate token and store its hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        token: tokenHash,
        user_id: user.user_id,
        expires_at: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/forgot-password/${rawToken}`;

    await sendEmail(
      user.email,
      'Reset your password',
      `<p>Hi ${user.display_name || user.username},</p>
       <p>You requested a password reset. Click the link below to set a new password:</p>
       <p><a href="${resetLink}">${resetLink}</a></p>
       <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`
    );

    return res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    console.error('[forgotPassword]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  const passwordErrors: string[] = [];
  if (password.length < 8) passwordErrors.push('at least 8 characters');
  if (!/[a-z]/.test(password)) passwordErrors.push('at least one lowercase letter');
  if (!/[A-Z]/.test(password)) passwordErrors.push('at least one uppercase letter');
  if (!/[^a-zA-Z0-9]/.test(password)) passwordErrors.push('at least one special character');

  if (passwordErrors.length > 0) {
    const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(passwordErrors);
    return res.status(400).json({ error: `Password must contain ${list}` });
  }

  try {
    const tokenHash = hashToken(token);

    const stored = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!stored || stored.expires_at < new Date()) {
      if (stored) {
        await prisma.passwordResetToken.delete({ where: { id: stored.id } });
      }
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 16);

    await prisma.$transaction([
      prisma.user.update({
        where: { user_id: stored.user_id },
        data: { password_hash: passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { user_id: stored.user_id },
      }),
      // Invalidate all refresh tokens so existing sessions are logged out
      prisma.refreshToken.deleteMany({
        where: { user_id: stored.user_id },
      }),
    ]);

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('[resetPassword]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function validateInvite(req: Request, res: Response) {
  const { token } = req.query as { token?: string };

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const tokenHash = hashToken(token);
    const stored = await prisma.guestInviteToken.findUnique({
      where: { token: tokenHash },
      include: { user: { select: { email: true, display_name: true } }, tournament: { select: { name: true } } },
    });

    if (!stored) {
      return res.status(404).json({ error: 'Invalid invite token' });
    }

    if (stored.expires_at < new Date()) {
      return res.status(410).json({ error: 'Invite token has expired' });
    }

    return res.status(200).json({
      email: stored.user.email,
      displayName: stored.user.display_name,
      tournamentName: stored.tournament.name,
    });
  } catch (err) {
    console.error('[validateInvite]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function registerInvite(req: Request, res: Response) {
  const { invite, username, password, display_name, first_name, last_name, date_of_birth } = req.body as {
    invite?: string;
    username?: string;
    password?: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
  };

  if (!invite) {
    return res.status(400).json({ error: 'Invite token is required' });
  }

  const requiredFields = { username, password, date_of_birth, display_name, first_name, last_name };
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

  try {
    const tokenHash = hashToken(invite);
    const stored = await prisma.guestInviteToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!stored) {
      return res.status(404).json({ error: 'Invalid invite token' });
    }

    if (stored.expires_at < new Date()) {
      await prisma.guestInviteToken.delete({ where: { id: stored.id } });
      return res.status(410).json({ error: 'Invite token has expired' });
    }

    // Check the ghost user's email hasn't been taken by a real user
    const ghostEmail = stored.user.email;
    const realUserWithEmail = await prisma.user.findFirst({
      where: { email: ghostEmail, site_role: { not: 'guest' } },
    });

    if (realUserWithEmail) {
      // Someone registered with this email independently — invalidate token
      await prisma.guestInviteToken.delete({ where: { id: stored.id } });
      return res.status(409).json({ error: 'This email has already been registered' });
    }

    // Check username isn't taken
    const usernameExists = await prisma.user.findFirst({
      where: { username, user_id: { not: stored.user.user_id } },
    });

    if (usernameExists) {
      return res.status(409).json({ error: 'An account with that username has already been created' });
    }

    const password_hash = await bcrypt.hash(password as string, 16);
    const newName = display_name as string;
    const ghostUserId = stored.user.user_id;

    const linkedParticipants = await prisma.tournamentParticipant.findMany({
      where: { user_id: ghostUserId },
      select: {
        tournament_id: true,
        seed: true,
        display_name: true,
      },
    });

    await prisma.$transaction([
      prisma.user.update({
        where: { user_id: ghostUserId },
        data: {
          username: username as string,
          password_hash,
          display_name: newName,
          first_name,
          last_name,
          date_of_birth: dob,
          site_role: 'user',
        },
      }),
      prisma.tournamentParticipant.updateMany({
        where: { user_id: ghostUserId },
        data: {
          participant_type: 'account',
          user_id: ghostUserId,
          guest_name: null,
          display_name: newName,
          confirmed: true,
          declined: false,
          registration_status: 'approved',
        },
      }),
      prisma.guestInviteToken.deleteMany({
        where: { user_id: ghostUserId },
      }),
    ]);

    const tournamentsToUpdate = [...new Set(linkedParticipants.map((participant) => participant.tournament_id))];
    if (tournamentsToUpdate.length > 0) {
      const tournaments = await prisma.tournament.findMany({
        where: { tournament_id: { in: tournamentsToUpdate } },
        select: {
          tournament_id: true,
          bracket_data: true,
          preview_bracket_data: true,
        },
      });

      for (const tournament of tournaments) {
        const namesToReplace = linkedParticipants
          .filter((participant) => participant.tournament_id === tournament.tournament_id)
          .map((participant) => participant.display_name)
          .filter((name): name is string => Boolean(name) && name !== newName);

        if (namesToReplace.length === 0) continue;

        let updatedBracket = tournament.bracket_data as unknown as BracketData | null;
        let updatedPreviewBracket = tournament.preview_bracket_data as unknown as BracketData | null;

        for (const oldName of namesToReplace) {
          if (updatedBracket) {
            updatedBracket = replaceBracketName(updatedBracket, oldName, newName);
          }
          if (updatedPreviewBracket) {
            updatedPreviewBracket = replaceBracketName(updatedPreviewBracket, oldName, newName);
          }
        }

        await prisma.tournament.update({
          where: { tournament_id: tournament.tournament_id },
          data: {
            bracket_data: updatedBracket as any,
            preview_bracket_data: updatedPreviewBracket as any,
          },
        });
      }
    }

    const currentTournament = await prisma.tournament.findUnique({
      where: { tournament_id: stored.tournament_id },
      select: { name: true, game: true },
    });

    if (currentTournament) {
      await prisma.message.create({
        data: {
          recipient_id: ghostUserId,
          recipient_name: newName,
          sender_id: null,
          category: 'tournaments',
          subject: `Welcome! You're in ${currentTournament.name}`,
          body: `Your account has been created and you've been added to the tournament "${currentTournament.name}" (${currentTournament.game}). Head to the tournament page to see the bracket and your upcoming matches.`,
          reference_id: stored.tournament_id,
        },
      });
    }

    await createAuthSession(res, {
      user_id: ghostUserId,
      username: username as string,
      email: stored.user.email,
      site_role: 'user',
    });

    return res.status(201).json({
      message: 'Account created successfully',
      tournamentId: stored.tournament_id,
      user: {
        id: ghostUserId,
        username: username as string,
        email: stored.user.email,
      },
    });
  } catch (err) {
    console.error('[registerInvite]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** Replace a participant name across all sections of bracket data. */
function replaceBracketName(bracket: BracketData, oldName: string, newName: string): BracketData {
  const updated = structuredClone(bracket);

  function replaceInRounds(rounds: BracketData['rounds']) {
    for (const round of rounds) {
      for (const match of round.matches) {
        if (match.participantA === oldName) match.participantA = newName;
        if (match.participantB === oldName) match.participantB = newName;
        if (match.winner === oldName) match.winner = newName;
      }
    }
  }

  if (updated.rounds) replaceInRounds(updated.rounds);
  if (updated.losersRounds) replaceInRounds(updated.losersRounds);
  if (updated.knockoutRounds) replaceInRounds(updated.knockoutRounds);

  if (updated.groups) {
    for (const group of updated.groups) {
      group.participants = group.participants.map((p) => (p === oldName ? newName : p));
      if (group.rounds) replaceInRounds(group.rounds);
    }
  }

  if (updated.tiebreaker) {
    updated.tiebreaker.participants = updated.tiebreaker.participants.map((p) => (p === oldName ? newName : p));
    if (updated.tiebreaker.winner === oldName) updated.tiebreaker.winner = newName;
  }

  return updated;
}
