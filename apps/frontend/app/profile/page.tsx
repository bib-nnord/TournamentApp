import Link from "next/link";

// Placeholder data — replace with real user data once auth is set up
const friends = [
  { id: "u1", username: "alice", online: true },
  { id: "u2", username: "bob", online: false },
  { id: "u3", username: "charlie", online: true },
];

const user = {
  username: "johndoe",
  email: "johndoe@example.com",
  joinedAt: "January 2025",
  stats: {
    tournamentsJoined: 8,
    tournamentsCreated: 3,
    wins: 2,
  },
};

const myTournaments = [
  { id: "1", name: "Spring Open 2025", status: "upcoming", role: "participant" },
  { id: "2", name: "City Chess Cup", status: "past", role: "organizer" },
  { id: "3", name: "Weekly Blitz", status: "active", role: "participant" },
];

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  past: "bg-gray-100 text-gray-500",
};

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Profile header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex items-center gap-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{user.username}</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
            <p className="text-xs text-gray-400 mt-1">Member since {user.joinedAt}</p>
          </div>
          <button className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Edit profile
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">{user.stats.tournamentsJoined}</p>
            <p className="text-xs text-gray-500 mt-1">Joined</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">{user.stats.tournamentsCreated}</p>
            <p className="text-xs text-gray-500 mt-1">Created</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">{user.stats.wins}</p>
            <p className="text-xs text-gray-500 mt-1">Wins</p>
          </div>
        </div>

        {/* Friends */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Friends <span className="text-gray-400 font-normal">({friends.length})</span>
            </h2>
            <Link href="/friends" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                    {f.username[0].toUpperCase()}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${f.online ? "bg-green-500" : "bg-gray-300"}`} />
                </div>
                <span className="text-sm text-gray-800">{f.username}</span>
                {f.online && <span className="text-xs text-gray-400">Online</span>}
              </div>
            ))}
          </div>
        </div>

        {/* My tournaments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">My tournaments</h2>
          <div className="flex flex-col gap-3">
            {myTournaments.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-800">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 capitalize">{t.role}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status]}`}>
                    {t.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
