export interface UserResult {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface UserSearchInputProps {
  /** Called when a user is selected from the dropdown or entered manually */
  onSelect: (username: string) => void;
  /** Called when free-text is entered (no matching user) — adds as guest */
  onSelectAsGuest?: (name: string) => void;
  placeholder?: string;
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
}
