import type { TournamentStatus, MatchStatus } from "@/types";

export const tournamentStatusColors: Record<TournamentStatus, string> = {
  draft: "bg-gray-100 text-gray-500",
  registration: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

export const matchStatusColors: Record<MatchStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-500",
  tie: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-600",
};

export const teamRoleColors: Record<string, string> = {
  lead: "bg-yellow-100 text-yellow-700",
  moderator: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-600",
};

export const participantTypeColors: Record<string, string> = {
  account: "bg-indigo-100 text-indigo-600",
  guest: "bg-amber-100 text-amber-600",
  team: "bg-purple-100 text-purple-600",
};

export const messageCategoryColors: Record<string, string> = {
  users: "bg-indigo-100 text-indigo-700",
  teams: "bg-yellow-100 text-yellow-700",
  tournaments: "bg-blue-100 text-blue-700",
  website: "bg-gray-100 text-gray-600",
};
