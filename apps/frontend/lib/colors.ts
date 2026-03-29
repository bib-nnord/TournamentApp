import type { TournamentStatus, MatchStatus } from "@/types";

export const tournamentStatusColors: Record<TournamentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  registration: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-600",
};

export const matchStatusColors: Record<MatchStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-muted text-muted-foreground",
  tie: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-600",
};

export const teamRoleColors: Record<string, string> = {
  lead: "bg-yellow-100 text-yellow-700",
  moderator: "bg-blue-100 text-blue-700",
  member: "bg-muted text-muted-foreground",
};

export const participantTypeColors: Record<string, string> = {
  account: "bg-primary/14 text-primary",
  guest: "bg-amber-100 text-amber-600",
  team: "bg-purple-100 text-purple-600",
};

export const messageCategoryColors: Record<string, string> = {
  users: "bg-primary/14 text-primary",
  teams: "bg-yellow-100 text-yellow-700",
  tournaments: "bg-blue-100 text-blue-700",
  website: "bg-muted text-muted-foreground",
};
