import type { Request, Response } from 'express';

import prisma from '../lib/prisma';
import * as messageService from '../services/messageService';
import { publishTeamNews } from '../lib/teamNews';
import type Message from '../models/Message';
import type { MessageCategory } from '../models/Message';

const VALID_CATEGORIES: MessageCategory[] = ['users', 'teams', 'tournaments', 'website'];

function mapMessage(message: Message) {
  const fromName = message.sender?.label ?? 'Tournament App';
  const toName = message.recipient?.label ?? null;

  return {
    id: message.id,
    category: message.category,
    folder: message.folder,
    from: fromName,
    senderUsername: message.sender?.username ?? null,
    senderId: message.senderId,
    to: toName,
    recipientUsername: message.recipient?.username ?? null,
    recipientId: message.recipientId,
    subject: message.subject,
    preview: message.body.length > 100 ? message.body.slice(0, 100) + '…' : message.body,
    body: message.body,
    read: message.isRead,
    referenceId: message.referenceId,
    time: message.createdAt.toISOString(),
  };
}

export async function list(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 20, 1), 100);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const folder = req.query.folder === 'sent' ? 'sent' : 'inbox';

    const where: Record<string, unknown> =
      folder === 'sent'
        ? { sender_id: userId, folder: 'sent' }
        : { recipient_id: userId, folder: 'inbox' };

    if (category && VALID_CATEGORIES.includes(category as MessageCategory)) {
      where.category = category;
    }

    const { messages, total } = await messageService.findMessages({ where, page, limit });

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

export async function unreadCount(req: Request, res: Response) {
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

export async function getById(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await messageService.findMessageById(id);

    if (!message) return res.status(404).json({ error: 'Message not found' });
    const isOwner = message.folder === 'sent' ? message.senderId === req.user.id : message.recipientId === req.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(mapMessage(message));
  } catch (err) {
    console.error('[messages/getById]', err);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
}

export async function markRead(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
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

export async function markAllRead(req: Request, res: Response) {
  try {
    const where: Record<string, unknown> = { recipient_id: req.user.id, is_read: false };
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

export async function remove(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await prisma.message.findUnique({ where: { message_id: id } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const isOwner = message.folder === 'sent' ? message.sender_id === req.user.id : message.recipient_id === req.user.id;
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

export async function send(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const { recipientUsername, subject, body } = req.body as {
      recipientUsername?: string;
      subject?: string;
      body?: string;
    };

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

    const sender = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { username: true, display_name: true },
    });

    const senderLabel = sender?.display_name || sender?.username || null;
    const recipientLabel = recipient.display_name || recipient.username;

    const shared = {
      sender_id: userId,
      recipient_id: recipient.user_id,
      sender_name: senderLabel,
      recipient_name: recipientLabel,
      category: 'users' as const,
      subject: subject.trim(),
      body: body.trim(),
    };

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

    const domainMessage = messageService.toDomainMessage(inboxCopy);
    return res.status(201).json(mapMessage(domainMessage));
  } catch (err) {
    console.error('[messages/send]', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

export async function respondTeamInvite(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id) return res.status(400).json({ error: 'Invalid message ID' });

    const { accept } = req.body as { accept?: boolean };
    if (typeof accept !== 'boolean') {
      return res.status(400).json({ error: '"accept" must be a boolean' });
    }

    const message = await prisma.message.findUnique({ where: { message_id: id } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.recipient_id !== req.user.id || message.folder !== 'inbox') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isTeamInvite = message.category === 'teams' && message.subject === 'Team invitation' && !!message.reference_id;
    if (!isTeamInvite) {
      return res.status(400).json({ error: 'This message is not a team invite' });
    }

    const teamId = Number(message.reference_id);
    const team = await prisma.team.findUnique({ where: { team_id: teamId }, select: { team_id: true, name: true } });
    if (!team) {
      await prisma.message.update({ where: { message_id: id }, data: { is_read: true } });
      return res.status(404).json({ error: 'Team no longer exists' });
    }

    if (accept) {
      const existingMembership = await prisma.teamMember.findUnique({
        where: { team_id_user_id: { team_id: teamId, user_id: req.user.id } },
      });

      if (!existingMembership) {
        await prisma.teamMember.create({
          data: { team_id: teamId, user_id: req.user.id, role: 'member' },
        });

        try {
          const user = await prisma.user.findUnique({
            where: { user_id: req.user.id },
            select: { username: true, display_name: true },
          });
          const memberName = user?.display_name || user?.username || 'A member';
          await publishTeamNews(teamId, `${memberName} joined ${team.name}`, `${memberName} accepted an invite and joined the team.`);
        } catch (newsErr) {
          console.error('[messages/respondTeamInvite.news]', newsErr);
        }
      }
    }

    await prisma.message.delete({ where: { message_id: id } });

    return res.json({ ok: true, joined: accept, removed: true });
  } catch (err) {
    console.error('[messages/respondTeamInvite]', err);
    return res.status(500).json({ error: 'Failed to respond to team invite' });
  }
}
