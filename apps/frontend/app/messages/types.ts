export type MessageCategory = "users" | "teams" | "tournaments" | "website";
export type Filter = "all" | "sent" | MessageCategory;

export interface Message {
  id: number;
  category: MessageCategory;
  folder: "inbox" | "sent";
  from: string;
  senderUsername: string | null;
  senderId: number | null;
  to: string | null;
  recipientUsername: string | null;
  recipientId: number;
  subject: string;
  preview: string;
  body: string;
  referenceId: number | null;
  time: string;
  read: boolean;
}
