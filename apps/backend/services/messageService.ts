import prisma from '../lib/prisma';
import User from '../models/User';
import Message from '../models/Message';

function mapUserFromMessage({
  relationUser,
  fallbackName,
  fallbackId,
}: {
  relationUser: any;
  fallbackName: string | null;
  fallbackId: number | null;
}): User | null {
  if (relationUser) {
    return new User({
      id: relationUser.user_id ?? fallbackId ?? null,
      username: relationUser.username ?? null,
      displayName: relationUser.display_name ?? null,
      deleted: false,
    });
  }

  if (!fallbackName) return null;

  return new User({
    id: fallbackId ?? null,
    displayName: fallbackName,
    deleted: true,
  });
}

export function toDomainMessage(messageRow: any): Message {
  const sender = mapUserFromMessage({
    relationUser: messageRow.sender,
    fallbackName: messageRow.sender_name,
    fallbackId: messageRow.sender_id,
  });

  const recipient = mapUserFromMessage({
    relationUser: messageRow.recipient,
    fallbackName: messageRow.recipient_name,
    fallbackId: messageRow.recipient_id,
  });

  return new Message({
    id: messageRow.message_id,
    category: messageRow.category,
    folder: messageRow.folder,
    senderId: messageRow.sender_id,
    recipientId: messageRow.recipient_id,
    sender,
    recipient,
    subject: messageRow.subject,
    body: messageRow.body,
    isRead: messageRow.is_read,
    referenceId: messageRow.reference_id ?? null,
    createdAt: messageRow.created_at,
  });
}

export async function findMessageById(messageId: number): Promise<Message | null> {
  const message = await prisma.message.findUnique({
    where: { message_id: messageId },
    include: {
      sender: { select: { user_id: true, username: true, display_name: true } },
      recipient: { select: { user_id: true, username: true, display_name: true } },
    },
  });

  if (!message) return null;
  return toDomainMessage(message);
}

export async function findMessages({
  where,
  page,
  limit,
}: {
  where: Record<string, unknown>;
  page: number;
  limit: number;
}): Promise<{ messages: Message[]; total: number }> {
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sender: { select: { user_id: true, username: true, display_name: true } },
        recipient: { select: { user_id: true, username: true, display_name: true } },
      },
    }),
    prisma.message.count({ where }),
  ]);

  return {
    messages: messages.map(toDomainMessage),
    total,
  };
}
