"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { RootState } from "@/store/store";

// Placeholder — replace with real tournament data from API
const upcomingTournaments = [
  { id: "1", name: "Spring Open 2025", date: "Mar 15, 2025", role: "participant" },
  { id: "5", name: "Easter Invitational", date: "Apr 20, 2025", role: "participant" },
];

const activeTournaments = [
  { id: "2", name: "Weekly Blitz #42", date: "Feb 23, 2025", role: "participant" },
];

const recentResults = [
  { id: "3", name: "City Chess Cup", date: "Jan 10, 2025", placement: "1st" },
  { id: "4", name: "Winter Championship", date: "Dec 5, 2024", placement: "3rd" },
];

// Placeholder — replace with real data from API
const teamNews = [
  { id: "n1", team: "The Knights", message: "New member joined: diana", time: "2h ago" },
  { id: "n2", team: "Storm Squad", message: "Match scheduled vs Iron Bishops", time: "5h ago" },
  { id: "n3", team: "The Knights", message: "Team practice moved to Thursday", time: "1d ago" },
];

const upcomingMatches = [
  { id: "m1", tournament: "Spring Open 2025", opponent: "Iron Bishops", date: "Mar 15, 2025", time: "14:00" },
  { id: "m2", tournament: "Weekly Blitz #42", opponent: "Rapid Rookies", date: "Feb 28, 2025", time: "18:00" },
  { id: "m3", tournament: "Easter Invitational", opponent: "TBD", date: "Apr 20, 2025", time: "10:00" },
];

export default function DashboardPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.username}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here&apos;s what&apos;s going on with your tournaments.</p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-8">
          <Link
            href="/tournaments/create"
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Create tournament
          </Link>
          <Link
            href="/tournaments"
            className="text-sm px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
          >
            Browse tournaments
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Active */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Active now
            </h2>
            {activeTournaments.length === 0 ? (
              <p className="text-sm text-gray-400">No active tournaments.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activeTournaments.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tournaments/view/${t.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <span className="text-xs text-gray-400">{t.date}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              Upcoming
            </h2>
            {upcomingTournaments.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming tournaments.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingTournaments.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tournaments/view/${t.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <span className="text-xs text-gray-400">{t.date}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Team news */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Team news
            </h2>
            {teamNews.length === 0 ? (
              <p className="text-sm text-gray-400">No news from your teams.</p>
            ) : (
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
            )}
          </div>

          {/* Upcoming matches */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              Upcoming matches
            </h2>
            {upcomingMatches.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming matches.</p>
            ) : (
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
            )}
          </div>

          {/* Recent results */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Recent results</h2>
            {recentResults.length === 0 ? (
              <p className="text-sm text-gray-400">No past tournaments yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentResults.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tournaments/view/${t.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{t.date}</span>
                      <span className="text-xs font-semibold text-gray-700">{t.placement}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
