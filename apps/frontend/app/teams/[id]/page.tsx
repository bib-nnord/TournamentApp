"use client";

import { useState } from "react";
import Link from "next/link";
import type { TeamRelation as TeamRole } from "@/types";
import Modal from "@/components/Modal";
import TeamSettingsForm from "@/components/TeamSettingsForm";

// Placeholder — replace with real data + role derived from auth once backend is ready
const team = {
  id: "t1",
  name: "The Knights",
  description: "A competitive team focused on chess tournaments.",
  open: true,
  members: [
    { id: "u1", username: "johndoe", role: "lead" as TeamRole },
    { id: "u2", username: "alice", role: "moderator" as TeamRole },
    { id: "u3", username: "bob", role: "member" as TeamRole },
    { id: "u4", username: "charlie", role: "member" as TeamRole },
  ],
};

// Change this to test different views: "lead" | "moderator" | "member" | "none"
const currentUserRole: TeamRole = "lead";

const roleBadge: Record<TeamRole, string> = {
  lead: "bg-yellow-100 text-yellow-700",
  moderator: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-600",
  none: "",
};

const roleLabel: Record<TeamRole, string> = {
  lead: "Lead",
  moderator: "Moderator",
  member: "Member",
  none: "",
};

export default function TeamPage() {
  const [showSettings, setShowSettings] = useState(false);
  const isLead = currentUserRole === "lead";
  const isModerator = currentUserRole === "moderator";
  const isMember = currentUserRole === "member";
  const isUnrelated = currentUserRole === "none";
  const canManage = isLead || isModerator;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        <Link href="/teams" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← Back to teams
        </Link>

        {/* Team header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{team.description}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Role badge for members */}
              {!isUnrelated && (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleBadge[currentUserRole]}`}>
                  {roleLabel[currentUserRole]}
                </span>
              )}
              {/* Settings — lead and moderator only */}
              {canManage && (
                <button onClick={() => setShowSettings(true)} className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500" title="Team settings">
                  ⚙
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {/* Unrelated: join or request */}
            {isUnrelated && (
              <button className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                {team.open ? "Join team" : "Request to join"}
              </button>
            )}

            {/* Member: leave */}
            {isMember && (
              <button className="text-sm px-4 py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50">
                Leave team
              </button>
            )}

            {/* Moderator: invite */}
            {isModerator && (
              <button className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Invite member
              </button>
            )}

            {/* Lead: edit, invite, disband */}
            {isLead && (
              <>
                <button className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Edit team
                </button>
                <button className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Invite member
                </button>
                <button className="text-sm px-4 py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50">
                  Disband team
                </button>
              </>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Members ({team.members.length})
          </h2>
          <div className="flex flex-col gap-2">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                    {m.username[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-800">{m.username}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[m.role]}`}>
                    {roleLabel[m.role]}
                  </span>
                </div>

                {/* Management actions */}
                {canManage && m.role !== "lead" && (
                  <div className="flex gap-2">
                    {/* Lead can promote/demote */}
                    {isLead && (
                      <button className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-600">
                        {m.role === "moderator" ? "Demote" : "Promote"}
                      </button>
                    )}
                    {/* Lead and moderator can kick members (moderator can't kick other mods) */}
                    {(isLead || (isModerator && m.role === "member")) && (
                      <button className="text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 text-red-500">
                        Kick
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Team settings">
        <TeamSettingsForm team={team} isLead={isLead} onSuccess={() => setShowSettings(false)} />
      </Modal>
    </div>
  );
}
