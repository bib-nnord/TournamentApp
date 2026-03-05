"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useFetch } from "@/hooks/useFetch";
import { tournamentStatusColors } from "@/lib/colors";
import { formatDate } from "@/lib/helpers";
import { LABEL_CREATE_TOURNAMENT, LABEL_BROWSE_TOURNAMENTS } from "@/constants/labels";
import type { TournamentSummary } from "@/components/TournamentList/types";
import DashboardCard from "@/components/DashboardCard";

// Placeholder
const teamNews = [
  { id: "n1", team: "The Knights", message: "New member joined: diana", time: "2h ago" },
  { id: "n2", team: "Storm Squad", message: "Match scheduled vs Iron Bishops", time: "5h ago" },
  { id: "n3", team: "The Knights", message: "Team practice moved to Thursday", time: "1d ago" },
];

// Placeholder
const upcomingMatches = [
  { id: "m1", tournament: "Spring Open 2025", opponent: "Iron Bishops", date: "Mar 15, 2025", time: "14:00" },
  { id: "m2", tournament: "Weekly Blitz #42", opponent: "Rapid Rookies", date: "Feb 28, 2025", time: "18:00" },
  { id: "m3", tournament: "Easter Invitational", opponent: "TBD", date: "Apr 20, 2025", time: "10:00" },
];

export default function DashboardPage() {
  const user = useRequireAuth();
  if (!user) return null;

  const { data: activeData, loading: activeLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?status=active&limit=5");
  const { data: registrationData, loading: registrationLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?status=registration&limit=5");
  const { data: completedData, loading: completedLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?status=completed&limit=5");

  const activeTournaments = activeData?.tournaments ?? [];
  const upcomingTournaments = registrationData?.tournaments ?? [];
  const recentResults = completedData?.tournaments ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.username}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Latest Tournaments:</p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-8">
          <Link
            href="/tournaments/create"
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {LABEL_CREATE_TOURNAMENT}
          </Link>
          <Link
            href="/tournaments"
            className="text-sm px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
          >
            {LABEL_BROWSE_TOURNAMENTS}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <DashboardCard title="Active now" dotColor="bg-green-500" loading={activeLoading} empty={activeTournaments.length === 0} emptyMessage="No active tournaments.">
            <div className="flex flex-col gap-2">
              {activeTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/view/${t.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <span className="text-xs text-gray-400">{t.startDate ? formatDate(t.startDate) : t.game}</span>
                </Link>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="Upcoming" dotColor="bg-blue-500" loading={registrationLoading} empty={upcomingTournaments.length === 0} emptyMessage="No upcoming tournaments.">
            <div className="flex flex-col gap-2">
              {upcomingTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/view/${t.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <span className="text-xs text-gray-400">{t.startDate ? formatDate(t.startDate) : t.game}</span>
                </Link>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="Team news" dotColor="bg-purple-500" empty={teamNews.length === 0} emptyMessage="No news from your teams.">
            <div className="flex flex-col gap-2">
              {teamNews.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <span className="text-xs font-semibold text-indigo-600">{n.team}</span>
                    <p className="text-sm text-gray-800">{n.message}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-3">{n.time}</span>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="Upcoming matches" dotColor="bg-orange-500" empty={upcomingMatches.length === 0} emptyMessage="No upcoming matches.">
            <div className="flex flex-col gap-2">
              {upcomingMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">vs {m.opponent}</p>
                    <span className="text-xs text-gray-400">{m.tournament}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-700">{m.date}</p>
                    <span className="text-xs text-gray-400">{m.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="Recent results" className="md:col-span-2" loading={completedLoading} empty={recentResults.length === 0} emptyMessage="No past tournaments yet.">
            <div className="flex flex-col gap-2">
              {recentResults.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/view/${t.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{t.game}</span>
                    {t.startDate && <span className="text-xs text-gray-400">{formatDate(t.startDate)}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tournamentStatusColors[t.status]}`}>
                      {t.participants}/{t.max}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </DashboardCard>

        </div>
      </div>
    </div>
  );
}
