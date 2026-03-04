export type MessageCategory = "users" | "teams" | "tournaments" | "website";
export type Filter = "all" | MessageCategory;

export interface Message {
  id: string;
  category: MessageCategory;
  from: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  read: boolean;
}
