"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import TeamSettingsForm from "@/components/TeamSettingsForm";
import { useFetch } from "@/hooks/useFetch";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getTeamPermissions } from "@/lib/helpers";
import type { TeamRelation as TeamRole } from "@/types";
import { LABEL_BACK_TO_TEAM } from "@/constants/labels";

interface TeamDetailDto {
  id: number;
  name: string;
  description: string | null;
  open: boolean;
  disciplines: string[];
  myRole: TeamRole;
}

export default function TeamSettingsPage() {
  const user = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error } = useFetch<{ team: TeamDetailDto }>(id ? `/teams/${id}` : null);
  const team = data?.team;

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <p className="text-sm text-gray-400">Loading team settings…</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <Link href="/teams" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
            {LABEL_BACK_TO_TEAM}
          </Link>
          <p className="text-sm text-red-500">{error || "Team not found"}</p>
        </div>
      </div>
    );
  }

  const { canManage, isLead } = getTeamPermissions(team.myRole);

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <Link href={`/teams/${team.id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
            {LABEL_BACK_TO_TEAM}
          </Link>
          <p className="text-sm text-red-500">You are not allowed to edit this team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href={`/teams/${team.id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          {LABEL_BACK_TO_TEAM}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Team settings</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <TeamSettingsForm
            teamId={team.id}
            team={{ name: team.name, description: team.description || "", open: team.open, disciplines: team.disciplines }}
            isLead={isLead}
            onSuccess={() => router.push(`/teams/${team.id}`)}
            onDisband={() => router.push("/teams")}
          />
        </div>
      </div>
    </div>
  );
}
