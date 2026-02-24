import Link from "next/link";

// Placeholder — replace with real user/tournament data once auth + backend are ready
const user = { username: "johndoe" };

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

export default function DashboardPage() {
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
