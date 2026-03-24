"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { LABEL_CREATE_AN_ACCOUNT, LABEL_LOG_IN } from "@/constants/labels";
import type { RootState } from "@/store/store";
import Link from "next/link";

export default function AuthButtons() {
  const [mounted, setMounted] = useState(false);
  const user = useSelector((state: RootState) => state.user.current);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (user) {
    return (
      <div className="flex gap-3 mt-2">
        <Link
          href="/tournaments/create"
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
        >
          Create Tournament
        </Link>
        <Link
          href="/tournaments?filter=active"
          className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
        >
          See more
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mt-2">
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
  );
}
