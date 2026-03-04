const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /auth/register
// Body: { username, email, password, display_name?, first_name?, last_name?, date_of_birth? }
// Response 201: { message: string }
async function register(req, res) {
  const { username, email, password, display_name, first_name, last_name, date_of_birth } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  //add proper verification later (cases and symbols)
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (date_of_birth) {
  const dob = new Date(date_of_birth);
  if (isNaN(dob.getTime())) {
    return res.status(400).json({ error: 'Invalid date of birth' });
  }
  if (dob > new Date()) {
    return res.status(400).json({ error: 'Date of birth cannot be in the future' });
  }

  //100 years
  if ( Math.floor((Date.now() - dob.getTime()) / (365 * 24 * 3600 * 1000)) > 100) {
    return res.status(400).json({ error: 'Invalid date of birth' });
  }
}

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { username }],
      },
    });

    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(409).json({ error: `An account with that ${field} has already been created` });
    }

    const password_hash = await bcrypt.hash(password, 16);

    await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password_hash,
        display_name: display_name || null,
        first_name: first_name || null,
        last_name: last_name || null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      },
    });

    return res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /auth/login
// Body: { email, password }
// Response 200: { token: string, user: { id, username, email } }
async function login(req, res) {
  const { email, username, password } = req.body;

  if ((!email && !username) || !password) {
    return res.status(400).json({ error: 'email/username and password are required' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: email
        ? { email: email.toLowerCase() }
        : { username },
    });


    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { sub: user.user_id, username: user.username, email: user.email, role: user.site_role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    //7 days
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

// POST /auth/refresh
// Body: { refreshToken }
// Response 200: { accessToken }
async function refresh(req, res) {
  const { refreshToken } = req.body;

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
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.status(200).json({ accessToken });
  } catch (err) {
    console.error('[refresh]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /auth/logout
// Body: { refreshToken }
// Response 200: { message }
async function logout(req, res) {
  const { refreshToken } = req.body;

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

module.exports = { register, login, refresh, logout };
