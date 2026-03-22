"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import type { UserResult, UserSearchInputProps } from "./types";

export default function UserSearchInput({
  onSelect,
  onSelectAsGuest,
  placeholder = "Search users…",
  className = "",
  size = "md",
}: UserSearchInputProps) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!input.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/users/search?q=${encodeURIComponent(input.trim())}&limit=6`);
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [input]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectUser(username: string) {
    onSelect(username);
    setInput("");
    setShowDropdown(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < results.length) {
        selectUser(results[highlightIndex].username);
      } else if (input.trim()) {
        // No matching user — only allow free text when the caller explicitly supports guest entries.
        if (onSelectAsGuest) {
          onSelectAsGuest(input.trim());
          setInput("");
          setShowDropdown(false);
          setHighlightIndex(-1);
        }
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  const sizeClasses = size === "sm"
    ? "text-xs px-2 py-1"
    : "text-sm px-3 py-2";

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value.replace(",", ""));
          setShowDropdown(true);
          setHighlightIndex(-1);
        }}
        onFocus={() => { if (input.trim()) setShowDropdown(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full border border-gray-200 rounded-lg ${sizeClasses} text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400`}
      />
      {showDropdown && input.trim() && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {searching ? (
            <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">
              {onSelectAsGuest
                ? <>No users found — press Enter to add &ldquo;{input.trim()}&rdquo; as guest</>
                : <>No users found</>}
            </div>
          ) : (
            results.map((u, idx) => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectUser(u.username)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0 ${
                  idx === highlightIndex ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {u.username[0]?.toUpperCase()}
                  </span>
                )}
                <span className="text-sm text-gray-800 font-medium">{u.username}</span>
                {u.displayName && u.displayName !== u.username && (
                  <span className="text-xs text-gray-400">{u.displayName}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
