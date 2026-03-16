"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useFetch } from "@/hooks/useFetch";
import { tournamentStatusColors } from "@/lib/colors";
import { formatDate } from "@/lib/helpers";
import { LABEL_CREATE_TOURNAMENT, LABEL_BROWSE_TOURNAMENTS } from "@/constants/labels";
import type { TournamentSummary } from "@/components/TournamentList/types";
import DashboardCard from "@/components/DashboardCard";

interface TeamNewsItem {
  id: number;
  teamId: number | null;
  subject: string;
  body: string;
  read: boolean;
  time: string;
}

type MyMatch = {
  id: string;
  tournamentId: number;
  tournamentName: string;
  opponent: string;
  completed: boolean;
  myResult: "won" | "lost" | "tie" | null;
  tournamentStatus: string;
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const user = useRequireAuth();

  const { data: activeData, loading: activeLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?status=active&limit=5");
  const { data: registrationData, loading: registrationLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?status=registration&limit=5");
  const { data: completedData, loading: completedLoading } = useFetch<{ tournaments: TournamentSummary[] }>("/tournaments?status=completed&limit=5");
  const { data: myMatchesData, loading: myMatchesLoading } = useFetch<{ matches: MyMatch[] }>("/tournaments/my-matches");
  const { data: teamNewsData, loading: teamNewsLoading } = useFetch<{ news: TeamNewsItem[] }>("/teams/news?limit=8");

  useEffect(() => setMounted(true), []);

  if (!mounted || !user) return null;

  const activeTournaments = activeData?.tournaments ?? [];
  const upcomingTournaments = registrationData?.tournaments ?? [];
  const recentResults = completedData?.tournaments ?? [];
  const myMatches = myMatchesData?.matches ?? [];
  const teamNews = teamNewsData?.news ?? [];

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
          <Link
            href="/teams"
            className="text-sm px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
          >
            My Teams
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

          <DashboardCard title="Team news" dotColor="bg-purple-500" loading={teamNewsLoading} empty={teamNews.length === 0} emptyMessage="No news from your teams.">
            <div className="flex flex-col gap-2">
              {teamNews.map((item) => (
                <div key={item.id} className={`px-3 py-2 rounded-lg ${item.read ? "" : "bg-indigo-50"}`}>
                  <p className="text-sm font-medium text-gray-800">{item.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.body}</p>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="My matches" dotColor="bg-orange-500" loading={myMatchesLoading} empty={myMatches.length === 0} emptyMessage="No matches found.">
            <div className="flex flex-col gap-2">
              {myMatches.map((m) => (
                <Link
                  key={m.id}
                  href={`/tournaments/view/${m.tournamentId}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">vs {m.opponent}</p>
                    <span className="text-xs text-gray-400">{m.tournamentName}</span>
                  </div>
                  <div className="text-right">
                    {!m.completed && <span className="text-xs font-medium text-orange-500">Upcoming</span>}
                    {m.myResult === "won" && <span className="text-xs font-medium text-green-600">Won</span>}
                    {m.myResult === "lost" && <span className="text-xs text-gray-400">Lost</span>}
                    {m.myResult === "tie" && <span className="text-xs text-blue-500">Tie</span>}
                  </div>
                </Link>
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
