export interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  bio?: string | null;
  country?: string | null;
  age?: number | null;
  gamesSports?: string[];
  dateOfBirth?: string | null;
}