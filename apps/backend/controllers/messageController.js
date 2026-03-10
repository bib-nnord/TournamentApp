const prisma = require('../lib/prisma');

const VALID_CATEGORIES = ['users', 'teams', 'tournaments', 'website'];

function mapMessage(m) {
  // Prefer live user data; fall back to stored name + (deleted) tag
  const fromLive = m.sender ? (m.sender.display_name || m.sender.username) : null;
  const fromStored = m.sender_name ? `${m.sender_name} (deleted)` : null;
  const fromName = fromLive ?? fromStored ?? 'Tournament App';

  const toLive = m.recipient ? (m.recipient.display_name || m.recipient.username) : null;
  const toStored = m.recipient_name ? `${m.recipient_name} (deleted)` : null;
  const toName = toLive ?? toStored ?? null;

  return {
    id: m.message_id,
    category: m.category,
    folder: m.folder,
    from: fromName,
    senderId: m.sender_id,
    to: toName,
    recipientId: m.recipient_id,
    subject: m.subject,
    preview: m.body.length > 100 ? m.body.slice(0, 100) + '…' : m.body,
    body: m.body,
    read: m.is_read,
    referenceId: m.reference_id ?? null,
    time: m.created_at.toISOString(),
  };
}

// GET /messages
// Headers: Authorization: Bearer <token>
// Body: none (query params: category?, page?, limit?)
// Response: { messages: [{ id, category, from, senderId, subject, preview, body, read, referenceId, time }], page, totalPages, total }
async function list(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const category = req.query.category;
    const folder = req.query.folder === 'sent' ? 'sent' : 'inbox';

    const where = folder === 'sent'
      ? { sender_id: userId, folder: 'sent' }
      : { recipient_id: userId, folder: 'inbox' };

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
          recipient: { select: { username: true, display_name: true } },
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

// GET /messages/unread-count
// Headers: Authorization: Bearer <token>
// Body: none
// Response: { count }
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

// GET /messages/:id
// Headers: Authorization: Bearer <token>
// Body: none (id from URL params)
// Response: { id, category, from, senderId, subject, preview, body, read, referenceId, time }
async function getById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await prisma.message.findUnique({
      where: { message_id: id },
      include: {
        sender: { select: { username: true, display_name: true } },
        recipient: { select: { username: true, display_name: true } },
      },
    });

    if (!message) return res.status(404).json({ error: 'Message not found' });
    const isOwner = message.folder === 'sent'
      ? message.sender_id === req.user.id
      : message.recipient_id === req.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(mapMessage(message));
  } catch (err) {
    console.error('[messages/getById]', err);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
}

// PATCH /messages/:id/read
// Headers: Authorization: Bearer <token>
// Body: { read: boolean }
// Response: { ok: true }
async function markRead(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await prisma.message.findUnique({ where: { message_id: id } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.recipient_id !== req.user.id || message.folder !== 'inbox') {
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

// PATCH /messages/read-all
// Headers: Authorization: Bearer <token>
// Body: { category?: "users" | "teams" | "tournaments" | "website" }
// Response: { ok: true }
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

// DELETE /messages/:id
// Headers: Authorization: Bearer <token>
// Body: none (id from URL params)
// Response: { ok: true }
async function remove(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await prisma.message.findUnique({ where: { message_id: id } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const isOwner = message.folder === 'sent'
      ? message.sender_id === req.user.id
      : message.recipient_id === req.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.message.delete({ where: { message_id: id } });

    res.json({ ok: true });
  } catch (err) {
    console.error('[messages/remove]', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
}

// POST /messages
// Headers: Authorization: Bearer <token>
// Body: { recipientUsername, subject, body }
// Response 201: { id, category, from, senderId, subject, preview, body, read, referenceId, time }
async function send(req, res) {
  try {
    const userId = req.user.id;
    const { recipientUsername, subject, body } = req.body;

    if (!recipientUsername || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'recipientUsername, subject, and body are required' });
    }

    const recipient = await prisma.user.findUnique({
      where: { username: recipientUsername.trim() },
      select: { user_id: true, username: true, display_name: true, allow_messages_from: true },
    });

    if (!recipient) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy setting
    if (recipient.allow_messages_from === 'friends_only') {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { requester_id: userId, recipient_id: recipient.user_id },
            { requester_id: recipient.user_id, recipient_id: userId },
          ],
        },
      });
      if (!friendship) {
        return res.status(403).json({ error: 'This user only accepts messages from friends' });
      }
    }

    // Fetch sender display name for storage
    const sender = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { username: true, display_name: true },
    });

    const senderLabel = sender.display_name || sender.username;
    const recipientLabel = recipient.display_name || recipient.username;

    const shared = {
      sender_id: userId,
      recipient_id: recipient.user_id,
      sender_name: senderLabel,
      recipient_name: recipientLabel,
      category: 'users',
      subject: subject.trim(),
      body: body.trim(),
    };

    // Create inbox copy for recipient and sent copy for sender
    const [inboxCopy] = await prisma.$transaction([
      prisma.message.create({
        data: { ...shared, folder: 'inbox' },
        include: {
          sender: { select: { username: true, display_name: true } },
          recipient: { select: { username: true, display_name: true } },
        },
      }),
      prisma.message.create({
        data: { ...shared, folder: 'sent', is_read: true },
      }),
    ]);

    return res.status(201).json(mapMessage(inboxCopy));
  } catch (err) {
    console.error('[messages/send]', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

module.exports = { list, unreadCount, getById, markRead, markAllRead, remove, send };
