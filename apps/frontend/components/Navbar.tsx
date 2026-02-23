"use client";

import Link from "next/link";
import { useState } from "react";

// Replace `isLoggedIn` with your auth state once auth is set up
const isLoggedIn = false;

export default function Navbar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b shadow-sm">
      {!collapsed ? (
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-800">
            Tournament App
          </Link>
          <div className="flex items-center space-x-2">
            {/* TODO: remove once real auth is wired up */}
            <Link href="/profile" className="text-xs px-2 py-1 rounded border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50">
              Debug: profile
            </Link>
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="text-sm px-3 py-1 rounded hover:bg-gray-100 text-gray-700">
                  Dashboard
                </Link>
                <Link href="/profile" className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100">
                  Profile
                </Link>
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
            <button
              onClick={() => setCollapsed(true)}
              className="ml-2 text-gray-400 hover:text-gray-600 text-xs px-1.5 py-1 rounded hover:bg-gray-100"
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
