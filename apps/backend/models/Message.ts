import type User from './User';

export type MessageCategory = 'users' | 'teams' | 'tournaments' | 'website';
export type MessageFolder = 'inbox' | 'sent';

export interface MessageParams {
  id: number;
  category: MessageCategory;
  folder: MessageFolder;
  senderId: number | null;
  recipientId: number | null;
  sender: User | null;
  recipient: User | null;
  subject: string;
  body: string;
  isRead: boolean;
  referenceId: number | null;
  createdAt: Date;
}

class Message {
  id: number;
  category: MessageCategory;
  folder: MessageFolder;
  senderId: number | null;
  recipientId: number | null;
  sender: User | null;
  recipient: User | null;
  subject: string;
  body: string;
  isRead: boolean;
  referenceId: number | null;
  createdAt: Date;

  constructor({
    id,
    category,
    folder,
    senderId,
    recipientId,
    sender,
    recipient,
    subject,
    body,
    isRead,
    referenceId,
    createdAt,
  }: MessageParams) {
    this.id = id;
    this.category = category;
    this.folder = folder;
    this.senderId = senderId;
    this.recipientId = recipientId;
    this.sender = sender;
    this.recipient = recipient;
    this.subject = subject;
    this.body = body;
    this.isRead = isRead;
    this.referenceId = referenceId;
    this.createdAt = createdAt;
  }
}

export default Message;
