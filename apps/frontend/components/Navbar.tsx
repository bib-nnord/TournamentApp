"use client";

import Link from "next/link";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { logout } from "@/store/authSlice";
import type { RootState, AppDispatch } from "@/store/store";

export default function Navbar() {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isLoggedIn = !!user;

  function handleLogout() {
    dispatch(logout());
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b shadow-sm">
      {!collapsed ? (
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-800">
            Tournament App
          </Link>
          <div className="flex items-center space-x-2">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="text-sm px-3 py-1 rounded hover:bg-gray-100 text-gray-700">
                  Dashboard
                </Link>
                <Link href="/messages" className="text-sm px-3 py-1 rounded hover:bg-gray-100 text-gray-700">
                  Messages
                </Link>
                <Link href="/profile" className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100">
                  {user.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm px-3 py-1 rounded text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
                  Login
                </Link>
                <Link href="/register" className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100">
                  Register
                </Link>
              </>
            )}
            <Link href="/settings" className="text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded hover:bg-gray-100" title="Settings">
              ⚙
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="text-gray-400 hover:text-gray-600 text-xs px-1.5 py-1 rounded hover:bg-gray-100"
              title="Collapse navbar"
            >
              ▲
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end px-4 py-1">
          <button
            onClick={() => setCollapsed(false)}
            className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100"
            title="Expand navbar"
          >
            ▼ Show navbar
          </button>
        </div>
      )}
    </header>
  );
}
