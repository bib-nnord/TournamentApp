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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center shadow-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in to create a tournament</h1>
          <p className="text-sm text-gray-500 mb-6">
            You need an account to host tournaments. It only takes a moment to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
            >
              {LABEL_CREATE_AN_ACCOUNT}
            </Link>
            <Link
              href="/login"
              className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
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
    <div className="min-h-screen bg-gray-50">
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
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2">
              <svg viewBox="0 0 160 44" className="w-full h-10" aria-hidden="true">
                <rect x="6" y="6" width="24" height="5" rx="2" fill="#c7d2fe" />
                <rect x="6" y="18" width="24" height="5" rx="2" fill="#c7d2fe" />
                <rect x="6" y="30" width="24" height="5" rx="2" fill="#c7d2fe" />
                <rect x="58" y="12" width="24" height="5" rx="2" fill="#a5b4fc" />
                <rect x="58" y="26" width="24" height="5" rx="2" fill="#a5b4fc" />
                <rect x="112" y="19" width="30" height="6" rx="2" fill="#6366f1" />
                <path d="M30 8 H44 V14 H58" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                <path d="M30 20 H44 V14" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                <path d="M30 32 H44 V28 H58" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                <path d="M82 14 H98 V22 H112" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                <path d="M82 28 H98 V22" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
              </svg>
              <p className="mt-1 text-[10px] text-gray-500">Quick bracket example</p>
            </div>
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
            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2">
              <svg viewBox="0 0 160 44" className="w-full h-10" aria-hidden="true">
                <rect x="6" y="8" width="34" height="12" rx="4" fill="#d1fae5" stroke="#6ee7b7" />
                <rect x="6" y="24" width="34" height="12" rx="4" fill="#d1fae5" stroke="#6ee7b7" />
                <rect x="66" y="13" width="24" height="5" rx="2" fill="#a5b4fc" />
                <rect x="66" y="25" width="24" height="5" rx="2" fill="#a5b4fc" />
                <rect x="118" y="19" width="30" height="6" rx="2" fill="#6366f1" />
                <path d="M40 14 H54 H66" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                <path d="M40 30 H54 H66" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                <path d="M90 15 H104 V22 H118" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                <path d="M90 27 H104 V22" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
              </svg>
              <p className="mt-1 text-[10px] text-gray-500">Scheduled bracket example</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
