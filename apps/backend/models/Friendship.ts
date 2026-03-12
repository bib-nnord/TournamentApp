import type User from './User';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface FriendshipParams {
  id: number;
  requesterId: number;
  recipientId: number;
  status: FriendshipStatus;
  requester?: User | null;
  recipient?: User | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

class Friendship {
  id: number;
  requesterId: number;
  recipientId: number;
  status: FriendshipStatus;
  requester: User | null;
  recipient: User | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor({
    id,
    requesterId,
    recipientId,
    status,
    requester = null,
    recipient = null,
    createdAt = null,
    updatedAt = null,
  }: FriendshipParams) {
    this.id = id;
    this.requesterId = requesterId;
    this.recipientId = recipientId;
    this.status = status;
    this.requester = requester;
    this.recipient = recipient;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  otherUserFor(currentUserId: number): User | null {
    if (this.requesterId === currentUserId) return this.recipient;
    return this.requester;
  }

  directionFor(currentUserId: number): FriendshipStatus | 'pending_sent' | 'pending_received' {
    if (this.status !== 'pending') return this.status;
    return this.requesterId === currentUserId ? 'pending_sent' : 'pending_received';
  }
}

export default Friendship;
