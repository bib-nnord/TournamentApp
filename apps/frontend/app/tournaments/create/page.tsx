"use client";

import Link from "next/link";
import CreateTournamentForm from "@/components/CreateTournamentForm";

export default function CreateTournamentPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          ← Back to tournaments
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create tournament</h1>
          <CreateTournamentForm />
        </div>
      </div>
    </div>
  );
}
