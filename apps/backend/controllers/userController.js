const prisma = require('../lib/prisma');

// GET /users/search?q=<query>&limit=<n>
// Body: none (query params: q, limit)
// Response: [{ id, username, displayName, avatarUrl }]
async function search(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

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

    const result = users.map((u) => ({
      id: u.user_id,
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
    }));

    res.json(result);
  } catch (err) {
    console.error('[users/search]', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
}

// GET /users/me
// Headers: Authorization: Bearer <token>
// Body: none
// Response: { id, username, email, displayName, bio, location, avatarUrl, allowMessagesFrom }
async function getMe(req, res) {
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

// PATCH /users/me
// Headers: Authorization: Bearer <token>
// Body: { allowMessagesFrom?: "everyone" | "friends_only" }
// Response: { ok: true }
async function updateMe(req, res) {
  try {
    const data = {};
    const { allowMessagesFrom } = req.body;

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

module.exports = { search, getMe, updateMe };
