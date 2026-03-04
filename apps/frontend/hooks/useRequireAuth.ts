"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import type { RootState } from "@/store/store";

/**
 * Redirects to /login if the user is not authenticated.
 * Returns the authenticated user (or null while redirecting).
 */
export function useRequireAuth() {
  const user = useSelector((state: RootState) => state.auth.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  return user;
}
