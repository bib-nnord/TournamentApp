import TournamentList from "@/components/TournamentList";

import { LABEL_CREATE } from "@/constants/labels";
import Link from "next/link";


export default async function TournamentsPage({

}) {

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          </div>
          <Link
            href="/tournaments/create"
            className="text-l px-8 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {LABEL_CREATE}
          </Link>
        </div>

        <div className="space-y-12 rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <section>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Registration</h2>
            <TournamentList
              defaultFilter={["registration"]}
              hideFilters
              sortBy="participants"
              layout="carousel"
            />
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Active</h2>
            <TournamentList
              defaultFilter={["active"]}
              hideFilters
              sortBy="participants"
              layout="carousel"
            />
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Completed</h2>
            <TournamentList
              defaultFilter={["completed"]}
              hideFilters
              sortBy="participants"
              layout="carousel"
            />
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Cancelled</h2>
            <TournamentList
              defaultFilter={["cancelled"]}
              hideFilters
              sortBy="participants"
              layout="carousel"
            />
          </section>
        </div>

                  
      </div>
    </div>
  );
}
