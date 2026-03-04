"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export function useDebouncedSearch<T>(
  query: string,
  buildUrl: (q: string) => string,
  delay = 300
) {
  const [results, setResults] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(buildUrl(query.trim()));
        if (res.ok) setResults(await res.json());
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [query, delay]); // buildUrl excluded — callers should pass a stable reference

  return { results, searching, setResults };
}
