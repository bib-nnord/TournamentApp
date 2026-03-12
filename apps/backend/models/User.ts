export interface UserParams {
  id?: number | null;
  username?: string | null;
  displayName?: string | null;
  deleted?: boolean;
}

class User {
  id: number | null;
  username: string | null;
  displayName: string | null;
  deleted: boolean;

  constructor({ id = null, username = null, displayName = null, deleted = false }: UserParams = {}) {
    this.id = id;
    this.username = username;
    this.displayName = displayName;
    this.deleted = deleted;
  }

  get label(): string | null {
    const base = this.displayName || this.username || null;
    if (!base) return null;
    return this.deleted ? `${base} (deleted)` : base;
  }
}

export default User;
