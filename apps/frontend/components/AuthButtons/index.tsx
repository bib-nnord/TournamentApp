"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { LABEL_CREATE_AN_ACCOUNT, LABEL_LOG_IN } from "@/constants/labels";

export default function AuthButtons() {
  const user = useSelector((state: RootState) => state.auth.user);

  if (user) return null;

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
