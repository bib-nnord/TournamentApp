const prisma = require('../lib/prisma');

// GET /teams/search?q=<query>&limit=<n>
// Body: none (query params: q, limit)
// Response: [{ id, name, description, imageUrl, isOpen, createdBy, members: [{ userId, username, displayName, role }] }]
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

// GET /teams/my
// Headers: Authorization: Bearer <token>
// Body: none
// Response: { teams: [{ id, name, role, members, open }] }
async function myTeams(req, res) {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { user_id: req.user.id },
      include: {
        team: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    const teams = memberships.map((m) => ({
      id: m.team.team_id,
      name: m.team.name,
      role: m.role,
      members: m.team._count.members,
      open: m.team.is_open,
    }));

    res.json({ teams });
  } catch (err) {
    console.error('[teams/my]', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

// GET /teams/user/:userId
// Body: none (userId from URL params)
// Response: { teams: [{ id, name, role, members, open }] }
async function userTeams(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const memberships = await prisma.teamMember.findMany({
      where: { user_id: userId },
      include: {
        team: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    const teams = memberships.map((m) => ({
      id: m.team.team_id,
      name: m.team.name,
      role: m.role,
      members: m.team._count.members,
      open: m.team.is_open,
    }));

    res.json({ teams });
  } catch (err) {
    console.error('[teams/user]', err);
    res.status(500).json({ error: 'Failed to fetch user teams' });
  }
}

module.exports = { search, myTeams, userTeams };
