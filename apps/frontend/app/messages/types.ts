export type MessageCategory = "users" | "teams" | "tournaments" | "website";
export type Filter = "all" | MessageCategory;

export interface Message {
  id: number;
  category: MessageCategory;
  from: string;
  senderId: number | null;
  subject: string;
  preview: string;
  body: string;
  referenceId: number | null;
  time: string;
  read: boolean;
}
