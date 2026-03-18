export type MessagePrivacy = 'everyone' | 'friends_only';

export interface UserParams {
  id?: number | null;
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
  bio?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  allowMessagesFrom?: MessagePrivacy | null;
  createdAt?: Date | null;
  deleted?: boolean;
}

class User {
  id: number | null;
  username: string | null;
  displayName: string | null;
  email: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  allowMessagesFrom: MessagePrivacy | null;
  createdAt: Date | null;
  deleted: boolean;

  constructor({
    id = null,
    username = null,
    displayName = null,
    email = null,
    bio = null,
    location = null,
    avatarUrl = null,
    allowMessagesFrom = null,
    createdAt = null,
    deleted = false,
  }: UserParams = {}) {
    this.id = id;
    this.username = username;
    this.displayName = displayName;
    this.email = email;
    this.bio = bio;
    this.location = location;
    this.avatarUrl = avatarUrl;
    this.allowMessagesFrom = allowMessagesFrom;
    this.createdAt = createdAt;
    this.deleted = deleted;
  }

  get label(): string | null {
    const base = this.displayName || this.username || null;
    if (!base) return null;
    return this.deleted ? `${base} (deleted)` : base;
  }
}

export default User;
