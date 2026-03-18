import type { NextFunction, Request, Response } from 'express';

import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

function attachUserFromToken(token: string, req: Request): void {
  const payload = jwt.verify(token, JWT_SECRET) as {
      sub?: string | number;
    username?: string;
    email?: string;
    role?: string;
  };

    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) {
      throw new Error('Invalid token subject');
    }

  req.user = {
      id: userId,
    username: payload.username,
    email: payload.email,
    role: payload.role,
  };
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = header.split(' ')[1];

  try {
    attachUserFromToken(token, req);
    return next();
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  try {
    attachUserFromToken(header.split(' ')[1], req);
  } catch {
  }

  return next();
}
