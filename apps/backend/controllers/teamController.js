const prisma = require('../lib/prisma');

/**
 * GET /teams/search?q=<query>&limit=<n>
 * Search teams by name (case-insensitive contains).
 * Returns teams with their members (including user info).
 */
async function search(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (!q) {
      return res.json([]);
    }

    const teams = await prisma.team.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        members: {
          include: {
            user: { select: { user_id: true, username: true, display_name: true } },
          },
          orderBy: { role: 'asc' },
        },
        creator: { select: { user_id: true, username: true, display_name: true } },
      },
    });

    const result = teams.map((t) => ({
      id: t.team_id,
      name: t.name,
      description: t.description,
      imageUrl: t.image_url,
      isOpen: t.is_open,
      createdBy: t.creator,
      members: t.members.map((m) => ({
        userId: m.user.user_id,
        username: m.user.username,
        displayName: m.user.display_name,
        role: m.role,
      })),
    }));

    res.json(result);
  } catch (err) {
    console.error('[teams/search]', err);
    res.status(500).json({ error: 'Failed to search teams' });
  }
}

module.exports = { search };
