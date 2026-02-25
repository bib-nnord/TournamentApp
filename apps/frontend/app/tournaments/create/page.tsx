import Link from "next/link";

export default function CreateTournamentPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← Back to tournaments
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create tournament</h1>
        <p className="text-sm text-gray-500 mb-8">Choose how you want to run your tournament.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quick Tournament */}
          <Link
            href="/tournaments/create/quick"
            className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-3">⚡</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
              Quick Tournament
            </h2>
            <p className="text-sm text-gray-500">
              Start immediately. Add participants manually — no registration needed.
            </p>
          </Link>

          {/* Scheduled Tournament */}
          <div className="relative bg-white rounded-2xl border border-gray-200 p-6 opacity-50 cursor-not-allowed">
            <span className="absolute top-4 right-4 text-[10px] uppercase tracking-wide font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Coming soon
            </span>
            <div className="text-2xl mb-3">📅</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Scheduled Tournament
            </h2>
            <p className="text-sm text-gray-500">
              Set a future date and open registration. Participants sign up on their own.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
