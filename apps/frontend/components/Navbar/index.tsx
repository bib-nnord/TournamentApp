"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { logoutAsync } from "@/store/authSlice";
import type { RootState, AppDispatch } from "@/store/store";
import { getUserInitial } from "@/lib/helpers";
import { apiFetch } from "@/lib/api";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
        active
          ? "bg-indigo-50 text-indigo-700 font-medium"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.auth.user);
  const isLoggedIn = !!user;

  useEffect(() => setMounted(true), []);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await apiFetch("/messages/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setUnreadCount(0); return; }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    const handleUpdate = () => fetchUnread();
    window.addEventListener("unread-count-changed", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("unread-count-changed", handleUpdate);
    };
  }, [isLoggedIn, fetchUnread]);

  function handleLogout() {
    dispatch(logoutAsync());
    router.push("/");
  }

  if (collapsed) {
    return (
      <div className="fixed top-2 right-2 z-50">
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs px-2 py-1 rounded bg-white border border-gray-200 shadow-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          title="Show navbar"
        >
          ▼ Show navbar
        </button>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="text-base font-bold text-gray-900 shrink-0 tracking-tight">
          Tournament App
        </Link>

        {/* Main nav */}
        {mounted && (
          <nav className="flex items-center gap-1">
            <NavLink href="/tournaments">Tournaments</NavLink>
            {isLoggedIn && (
              <>
                <NavLink href="/dashboard">Dashboard</NavLink>
                <NavLink href="/friends">Friends</NavLink>
              </>
            )}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {mounted && isLoggedIn && (
            <Link
              href="/messages"
              className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
                pathname === "/messages" || pathname.startsWith("/messages/")
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              Messages
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          {mounted && (isLoggedIn ? (
            <>
              <Link
                href={`/profile/${user.username}`}
                className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="Your profile"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                  {getUserInitial(user.username)}
                </div>
                <span className="text-gray-700 font-medium hidden sm:inline">{user.username}</span>
              </Link>
              <Link
                href="/settings"
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
                Login
              </Link>
              <Link href="/register" className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                Register
              </Link>
            </>
          ))}
          <button
            onClick={() => setCollapsed(true)}
            className="text-gray-300 hover:text-gray-500 text-xs p-1 rounded hover:bg-gray-100 transition-colors"
            title="Collapse navbar"
          >
            ▲
          </button>
        </div>

      </div>
    </header>
  );
}
