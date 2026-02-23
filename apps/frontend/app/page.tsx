import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 flex items-center justify-center">
        <section className="max-w-4xl w-full px-6 py-12">
          <div className="bg-white rounded-2xl shadow-lg p-12 flex flex-col md:flex-row items-center md:items-stretch gap-8">
            <div className="flex-1">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Find and join tournaments</h2>
              <p className="text-gray-600 mb-8">Browse public tournaments, see details, and join the ones you like.</p>
              <Link href="/tournaments" className="inline-block px-8 py-3 bg-indigo-600 text-white rounded-lg text-lg hover:bg-indigo-700">
                View Public Tournaments
              </Link>
            </div>
            <aside className="w-full md:w-80 bg-gray-50 border border-gray-100 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Quick actions</h3>
              <div className="flex flex-col gap-3">
                <Link href="/create" className="block w-full text-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  Create Tournament
                </Link>
                <Link href="/explore" className="block w-full text-center px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                  Explore
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}