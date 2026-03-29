"use client";

import type { ReactNode } from "react";

// ─── Shared CSS classes ─────────────────────────────────────────────────────

export const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-[var(--input-background)] focus:outline-none focus:ring-2 focus:ring-ring";

export const labelClass = "block text-xs text-muted-foreground uppercase tracking-wide mb-1";

// ─── Toggle switch ──────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  /** Tailwind bg class when checked. Defaults to "bg-primary". */
  activeColor?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
  activeColor = "bg-primary",
}: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? activeColor : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm text-foreground">
        {label}
        {hint && <span className="text-muted-foreground"> — {hint}</span>}
      </span>
    </div>
  );
}

// ─── Form section ───────────────────────────────────────────────────────────

interface FormSectionProps {
  label: string;
  optional?: boolean;
  children: ReactNode;
}

export function FormSection({ label, optional, children }: FormSectionProps) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {optional && <span className="normal-case text-muted-foreground/60"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}
