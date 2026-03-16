"use client";

import Link from "next/link";
import TeamSettingsForm from "@/components/TeamSettingsForm";
import { LABEL_BACK_TO_TEAM } from "@/constants/labels";

// Placeholder — replace with real data once backend is ready
const team = {
  id: "t1",
  name: "The Knights",
  description: "A competitive team focused on chess tournaments.",
  open: true,
};

const currentUserRole: "lead" | "moderator" = "lead";

export default function TeamSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href={`/teams/${team.id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          {LABEL_BACK_TO_TEAM}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Team settings</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <TeamSettingsForm teamId={Number(team.id.replace("t", ""))} team={team} isLead={currentUserRole === "lead"} />
        </div>
      </div>
    </div>
  );
}
