const prisma = require('../lib/prisma');

const VALID_CATEGORIES = ['users', 'teams', 'tournaments', 'website'];

function mapMessage(m) {
  return {
    id: m.message_id,
    category: m.category,
    from: m.sender ? (m.sender.display_name || m.sender.username) : 'Tournament App',
    senderId: m.sender_id,
    subject: m.subject,
    preview: m.body.length > 100 ? m.body.slice(0, 100) + '…' : m.body,
    body: m.body,
    read: m.is_read,
    referenceId: m.reference_id ?? null,
    time: m.created_at.toISOString(),
  };
}

/**
 * GET /messages
 * List messages for the authenticated user.
 * Query: ?category=users|teams|tournaments|website  &page=1  &limit=20
 */
async function list(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const category = req.query.category;

    const where = { recipient_id: userId };
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sender: { select: { username: true, display_name: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      messages: messages.map(mapMessage),
      page,
      totalPages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('[messages/list]', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

/**
 * GET /messages/unread-count
 * Returns the number of unread messages for the authenticated user.
 */
async function unreadCount(req, res) {
  try {
    const count = await prisma.message.count({
      where: { recipient_id: req.user.id, is_read: false },
    });
    res.json({ count });
  } catch (err) {
    console.error('[messages/unreadCount]', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
}

/**
 * GET /messages/:id
 * Get a single message by ID (must belong to authenticated user).
 */
async function getById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await prisma.message.findUnique({
      where: { message_id: id },
      include: {
        sender: { select: { username: true, display_name: true } },
      },
    });

    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(mapMessage(message));
  } catch (err) {
    console.error('[messages/getById]', err);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
}

/**
 * PATCH /messages/:id/read
 * Toggle read status. Body: { read: true|false }
 */
async function markRead(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await prisma.message.findUnique({ where: { message_id: id } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const read = req.body.read;
    if (typeof read !== 'boolean') {
      return res.status(400).json({ error: '"read" must be a boolean' });
    }

    await prisma.message.update({
      where: { message_id: id },
      data: { is_read: read },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[messages/markRead]', err);
    res.status(500).json({ error: 'Failed to update message' });
  }
}

/**
 * PATCH /messages/read-all
 * Mark all messages as read. Optional body: { category: "users" }
 */
async function markAllRead(req, res) {
  try {
    const where = { recipient_id: req.user.id, is_read: false };
    const category = req.body.category;
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    await prisma.message.updateMany({ where, data: { is_read: true } });

    res.json({ ok: true });
  } catch (err) {
    console.error('[messages/markAllRead]', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
}

/**
 * DELETE /messages/:id
 * Delete a message (must belong to authenticated user).
 */
async function remove(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await prisma.message.findUnique({ where: { message_id: id } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.message.delete({ where: { message_id: id } });

    res.json({ ok: true });
  } catch (err) {
    console.error('[messages/remove]', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
}

module.exports = { list, unreadCount, getById, markRead, markAllRead, remove };
