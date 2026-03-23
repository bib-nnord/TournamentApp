export type MessagePrivacy = 'everyone' | 'friends_only';

export interface UserParams {
  id?: number | null;
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
  dateOfBirth?: Date | null;
  bio?: string | null;
  location?: string | null;
  gamesSports?: string[] | null;
  avatarUrl?: string | null;
  allowMessagesFrom?: MessagePrivacy | null;
  bioPublic?: boolean;
  locationPublic?: boolean;
  agePublic?: boolean;
  gamesSportsPublic?: boolean;
  createdAt?: Date | null;
  deleted?: boolean;
}

class User {
  id: number | null;
  username: string | null;
  displayName: string | null;
  email: string | null;
  dateOfBirth: Date | null;
  bio: string | null;
  location: string | null;
  gamesSports: string[];
  avatarUrl: string | null;
  allowMessagesFrom: MessagePrivacy | null;
  bioPublic: boolean;
  locationPublic: boolean;
  agePublic: boolean;
  gamesSportsPublic: boolean;
  createdAt: Date | null;
  deleted: boolean;

  constructor({
    id = null,
    username = null,
    displayName = null,
    email = null,
    dateOfBirth = null,
    bio = null,
    location = null,
    gamesSports = null,
    avatarUrl = null,
    allowMessagesFrom = null,
    bioPublic = true,
    locationPublic = true,
    agePublic = true,
    gamesSportsPublic = true,
    createdAt = null,
    deleted = false,
  }: UserParams = {}) {
    this.id = id;
    this.username = username;
    this.displayName = displayName;
    this.email = email;
    this.dateOfBirth = dateOfBirth;
    this.bio = bio;
    this.location = location;
    this.gamesSports = gamesSports ?? [];
    this.avatarUrl = avatarUrl;
    this.allowMessagesFrom = allowMessagesFrom;
    this.bioPublic = bioPublic;
    this.locationPublic = locationPublic;
    this.agePublic = agePublic;
    this.gamesSportsPublic = gamesSportsPublic;
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
