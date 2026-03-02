const prisma = require('../lib/prisma');

/**
 * GET /users/search?q=<query>&limit=<n>
 * Search users by username or display_name (case-insensitive contains).
 * Returns basic public profile info only.
 */
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

module.exports = { search };
