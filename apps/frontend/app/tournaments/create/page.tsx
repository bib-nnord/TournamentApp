"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  LABEL_BACK_TO_TOURNAMENTS,
  LABEL_QUICK_TOURNAMENT,
  LABEL_SCHEDULED_TOURNAMENT,
  LABEL_CREATE_AN_ACCOUNT,
  LABEL_LOG_IN,
} from "@/constants/labels";
import type { RootState } from "@/store/store";
import Link from "next/link";

export default function CreateTournamentPage() {
  const [mounted, setMounted] = useState(false);
  const checked = useSelector((state: RootState) => state.auth.checked);
  const user = useSelector((state: RootState) => state.user.current);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Show nothing until the Redux store has hydrated and auth is resolved
  if (!mounted || !checked) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center shadow-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in to create a tournament</h1>
          <p className="text-sm text-gray-500 mb-6">
            You need an account to host tournaments. It only takes a moment to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="px-8 py-3 text-lg bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
            >
              {LABEL_CREATE_AN_ACCOUNT}
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 text-lg border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60"
            >
              {LABEL_LOG_IN}
            </Link>
          </div>
          <Link href="/tournaments" className="mt-6 inline-block text-sm text-gray-400 hover:text-gray-600">
            {LABEL_BACK_TO_TOURNAMENTS}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          {LABEL_BACK_TO_TOURNAMENTS}
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
              {LABEL_QUICK_TOURNAMENT}
            </h2>
            <p className="text-sm text-gray-500">
              Start immediately. Add participants manually — no registration needed.
            </p>
          </Link>

          {/* Scheduled Tournament */}
          <Link
            href="/tournaments/create/scheduled"
            className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-3">📅</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
              {LABEL_SCHEDULED_TOURNAMENT}
            </h2>
            <p className="text-sm text-gray-500">
              Set a future date and open registration. Participants sign up on their own.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
