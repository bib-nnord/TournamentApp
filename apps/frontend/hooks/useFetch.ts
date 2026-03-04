"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useFetch<T>(url: string | null): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(url!);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Failed to load");
          return;
        }
        setData(await res.json());
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error, setData };
}
