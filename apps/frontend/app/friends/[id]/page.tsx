import Link from "next/link";

// Placeholder — replace with real data once backend is ready
const viewedUser = { id: "u2", username: "alice" };

const theirFriends = [
  { id: "u1", username: "johndoe" },
  { id: "u3", username: "charlie" },
  { id: "u4", username: "diana" },
  { id: "u5", username: "eve" },
  { id: "u6", username: "frank" },
];

// IDs of the logged-in user's friends (for mutual detection)
const myFriendIds = new Set(["u1", "u3", "u7"]);

export default function UserFriendsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        <Link href={`/profile/${viewedUser.id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← Back to {viewedUser.username}&apos;s profile
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {viewedUser.username}&apos;s friends
          <span className="text-base font-normal text-gray-400 ml-2">({theirFriends.length})</span>
        </h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {theirFriends.length === 0 ? (
            <p className="text-sm text-gray-400">No friends yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {theirFriends.map((f) => {
                const isMutual = myFriendIds.has(f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {f.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-800">{f.username}</span>
                    </div>
                    {isMutual && (
                      <span className="text-xs text-indigo-500 font-medium flex items-center gap-1">
                        <span>★</span> Mutual
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
