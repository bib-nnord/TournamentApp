const prisma = require('../lib/prisma');

const userSelect = {
  user_id: true,
  username: true,
  display_name: true,
  avatar_url: true,
};

function mapFriend(friendship, currentUserId) {
  const other =
    friendship.requester_id === currentUserId
      ? friendship.recipient
      : friendship.requester;
  return {
    id: friendship.friendship_id,
    userId: other.user_id,
    username: other.username,
    displayName: other.display_name,
  };
}

// GET /friends
// Headers: Authorization: Bearer <token>
// Body: none
// Response: { friends: [{ id, userId, username, displayName }] }
async function listFriends(req, res) {
  try {
    const userId = req.user.id;
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requester_id: userId }, { recipient_id: userId }],
      },
      include: {
        requester: { select: userSelect },
        recipient: { select: userSelect },
      },
      orderBy: { updated_at: 'desc' },
    });

    const friends = friendships.map((f) => mapFriend(f, userId));
    return res.json({ friends });
  } catch (err) {
    console.error('[friends.list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /friends/requests
// Headers: Authorization: Bearer <token>
// Body: none
// Response: { incoming: [{ id, userId, username, displayName }], outgoing: [{ id, userId, username, displayName }] }
async function listRequests(req, res) {
  try {
    const userId = req.user.id;
    const [incomingRaw, outgoingRaw] = await Promise.all([
      prisma.friendship.findMany({
        where: { recipient_id: userId, status: 'pending' },
        include: { requester: { select: userSelect } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.friendship.findMany({
        where: { requester_id: userId, status: 'pending' },
        include: { recipient: { select: userSelect } },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return res.json({
      incoming: incomingRaw.map((f) => mapFriend(f, userId)),
      outgoing: outgoingRaw.map((f) => mapFriend(f, userId)),
    });
  } catch (err) {
    console.error('[friends.listRequests]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /friends/request
// Headers: Authorization: Bearer <token>
// Body: { username }
// Response: 201 { friendship: { id, userId, username, displayName } }
async function sendRequest(req, res) {
  try {
    const userId = req.user.id;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const target = await prisma.user.findUnique({
      where: { username: username.trim() },
      select: { user_id: true, username: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.user_id === userId) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    }

    // Check for existing friendship in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requester_id: userId, recipient_id: target.user_id },
          { requester_id: target.user_id, recipient_id: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ error: 'You are already friends with this user' });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ error: 'Friend request already pending' });
      }
      if (existing.status === 'blocked') {
        return res.status(403).json({ error: 'Unable to send friend request' });
      }
    }

    const friendship = await prisma.friendship.create({
      data: { requester_id: userId, recipient_id: target.user_id },
      include: { recipient: { select: userSelect } },
    });

    // Send notification message
    await prisma.message.create({
      data: {
        sender_id: userId,
        recipient_id: target.user_id,
        category: 'users',
        subject: 'Friend request',
        body: `${req.user.username} sent you a friend request.`,
        reference_id: friendship.friendship_id,
      },
    });

    return res.status(201).json({ friendship: mapFriend(friendship, userId) });
  } catch (err) {
    console.error('[friends.sendRequest]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /friends/:id/accept
// Headers: Authorization: Bearer <token>
// Body: none (id from URL params)
// Response: { friendship: { id, userId, username, displayName } }
async function acceptRequest(req, res) {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.id);

    const friendship = await prisma.friendship.findUnique({
      where: { friendship_id: friendshipId },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (friendship.recipient_id !== userId) {
      return res.status(403).json({ error: 'Only the recipient can accept' });
    }
    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' });
    }

    const updated = await prisma.friendship.update({
      where: { friendship_id: friendshipId },
      data: { status: 'accepted' },
      include: {
        requester: { select: userSelect },
        recipient: { select: userSelect },
      },
    });

    // Notify the requester
    await prisma.message.create({
      data: {
        sender_id: userId,
        recipient_id: friendship.requester_id,
        category: 'users',
        subject: 'Friend request accepted',
        body: `${req.user.username} accepted your friend request.`,
        reference_id: friendship.friendship_id,
      },
    });

    return res.json({ friendship: mapFriend(updated, userId) });
  } catch (err) {
    console.error('[friends.accept]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /friends/:id/decline
// Headers: Authorization: Bearer <token>
// Body: none (id from URL params)
// Response: { ok: true }
async function declineRequest(req, res) {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.id);

    const friendship = await prisma.friendship.findUnique({
      where: { friendship_id: friendshipId },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (friendship.recipient_id !== userId) {
      return res.status(403).json({ error: 'Only the recipient can decline' });
    }
    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been answered' });
    }

    await prisma.friendship.delete({ where: { friendship_id: friendshipId } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends.decline]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /friends/:id
// Headers: Authorization: Bearer <token>
// Body: none (id from URL params)
// Response: { ok: true }
async function removeFriend(req, res) {
  //maybe notify the other one?
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.id);

    const friendship = await prisma.friendship.findUnique({
      where: { friendship_id: friendshipId },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }
    if (friendship.requester_id !== userId && friendship.recipient_id !== userId) {
      return res.status(403).json({ error: 'Not your friendship' });
    }

    await prisma.friendship.delete({ where: { friendship_id: friendshipId } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends.remove]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /friends/user/:username
// Returns the friends list of a given user (public).
// Response: { friends: [{ id, userId, username, displayName }] }
async function listUserFriends(req, res) {
  try {
    const { username } = req.params;

    const target = await prisma.user.findUnique({
      where: { username },
      select: { user_id: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requester_id: target.user_id }, { recipient_id: target.user_id }],
      },
      include: {
        requester: { select: userSelect },
        recipient: { select: userSelect },
      },
      orderBy: { updated_at: 'desc' },
    });

    const friends = friendships.map((f) => mapFriend(f, target.user_id));
    return res.json({ friends });
  } catch (err) {
    console.error('[friends.listUserFriends]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /friends/status/:username
// Returns the friendship status between the current user and the target user.
// Response: { status: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked', friendshipId?: number }
async function getStatus(req, res) {
  try {
    const userId = req.user.id;
    const { username } = req.params;

    const target = await prisma.user.findUnique({
      where: { username },
      select: { user_id: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.user_id === userId) {
      return res.json({ status: 'self' });
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requester_id: userId, recipient_id: target.user_id },
          { requester_id: target.user_id, recipient_id: userId },
        ],
      },
    });

    if (!friendship) {
      return res.json({ status: 'none' });
    }

    if (friendship.status === 'accepted') {
      return res.json({ status: 'accepted', friendshipId: friendship.friendship_id });
    }

    if (friendship.status === 'pending') {
      const direction = friendship.requester_id === userId ? 'pending_sent' : 'pending_received';
      return res.json({ status: direction, friendshipId: friendship.friendship_id });
    }

    return res.json({ status: friendship.status, friendshipId: friendship.friendship_id });
  } catch (err) {
    console.error('[friends.getStatus]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listFriends,
  listUserFriends,
  listRequests,
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  getStatus,
};
