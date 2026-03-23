"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { useRouter } from "next/navigation";

/**
 * Redirects to /login if the user is not authenticated.
 * Returns the authenticated user (or null while redirecting).
 */
export function useRequireAuth() {
  const checked = useSelector((state: RootState) => state.auth.checked);
  const user = useSelector((state: RootState) => state.user.current);
  const router = useRouter();

  useEffect(() => {
    if (checked && !user) router.replace('/login');
  }, [checked, user, router]);

  return checked ? user : null;
}
