"use client";

import type { TournamentFormat } from "@/types";

interface Props {
  format: TournamentFormat;
}

function SingleEliminationGraphic() {
  return (
    <svg viewBox="0 0 160 56" className="w-full h-14" aria-hidden="true">
      <rect x="6" y="6" width="26" height="6" rx="2" fill="#c7d2fe" />
      <rect x="6" y="20" width="26" height="6" rx="2" fill="#c7d2fe" />
      <rect x="6" y="34" width="26" height="6" rx="2" fill="#c7d2fe" />
      <rect x="6" y="48" width="26" height="6" rx="2" fill="#c7d2fe" />

      <rect x="62" y="13" width="26" height="6" rx="2" fill="#a5b4fc" />
      <rect x="62" y="41" width="26" height="6" rx="2" fill="#a5b4fc" />
      <rect x="118" y="27" width="28" height="6" rx="2" fill="#818cf8" />

      <path d="M32 9 H48 V16 H62" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M32 23 H48 V16" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M32 37 H48 V44 H62" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M32 51 H48 V44" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M88 16 H104 V30 H118" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M88 44 H104 V30" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function DoubleEliminationGraphic() {
  return (
    <svg viewBox="0 0 160 56" className="w-full h-14" aria-hidden="true">
      <rect x="8" y="8" width="20" height="5" rx="2" fill="#c7d2fe" />
      <rect x="8" y="18" width="20" height="5" rx="2" fill="#c7d2fe" />
      <rect x="8" y="34" width="20" height="5" rx="2" fill="#ddd6fe" />
      <rect x="8" y="44" width="20" height="5" rx="2" fill="#ddd6fe" />

      <rect x="52" y="13" width="20" height="5" rx="2" fill="#a5b4fc" />
      <rect x="52" y="39" width="20" height="5" rx="2" fill="#c4b5fd" />

      <rect x="94" y="26" width="20" height="5" rx="2" fill="#818cf8" />
      <rect x="132" y="26" width="20" height="5" rx="2" fill="#6366f1" />

      <path d="M28 10 H40 V15 H52" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M28 20 H40 V15" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M28 36 H40 V41 H52" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M28 46 H40 V41" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M72 15 H84 V28 H94" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M72 41 H84 V28" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M114 28 H132" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function RoundRobinGraphic({ doubleRound = false }: { doubleRound?: boolean }) {
  return (
    <svg viewBox="0 0 160 56" className="w-full h-14" aria-hidden="true">
      <rect x="12" y="8" width="136" height="40" rx="6" fill="#eef2ff" stroke="#c7d2fe" />
      {[1, 2, 3].map((i) => (
        <line key={`v-${i}`} x1={12 + i * 34} y1="8" x2={12 + i * 34} y2="48" stroke="#c7d2fe" />
      ))}
      {[1, 2].map((i) => (
        <line
          key={`h-${i}`}
          x1="12"
          y1={8 + i * 13.3}
          x2="148"
          y2={8 + i * 13.3}
          stroke="#c7d2fe"
        />
      ))}
      <path
        d="M20 16 L44 28 L68 16 L92 28 L116 16"
        stroke="#818cf8"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M20 40 L44 28 L68 40 L92 28 L116 40"
        stroke="#6366f1"
        strokeWidth="1.5"
        fill="none"
      />
      {doubleRound && (
        <path d="M28 28 H132" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="3 2" />
      )}
    </svg>
  );
}

function CombinationGraphic() {
  return (
    <svg viewBox="0 0 160 56" className="w-full h-14" aria-hidden="true">
      <rect x="8" y="8" width="36" height="16" rx="4" fill="#ecfeff" stroke="#a5f3fc" />
      <rect x="8" y="32" width="36" height="16" rx="4" fill="#ecfeff" stroke="#a5f3fc" />
      <text x="26" y="18" textAnchor="middle" fontSize="6" fill="#0f766e">Group A</text>
      <text x="26" y="42" textAnchor="middle" fontSize="6" fill="#0f766e">Group B</text>

      <rect x="72" y="13" width="24" height="6" rx="2" fill="#a5b4fc" />
      <rect x="72" y="37" width="24" height="6" rx="2" fill="#a5b4fc" />
      <rect x="122" y="25" width="28" height="6" rx="2" fill="#6366f1" />

      <path d="M44 16 H58 V16 H72" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M44 40 H58 V40 H72" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M96 16 H110 V28 H122" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M96 40 H110 V28" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function SwissGraphic() {
  return (
    <svg viewBox="0 0 160 56" className="w-full h-14" aria-hidden="true">
      {[18, 54, 90, 126].map((x) => (
        <rect key={`p-${x}`} x={x} y="8" width="14" height="4" rx="2" fill="#c7d2fe" />
      ))}
      {[18, 54, 90, 126].map((x) => (
        <rect key={`b-${x}`} x={x} y="44" width="14" height="4" rx="2" fill="#c7d2fe" />
      ))}
      <path d="M25 12 V24 H61 V12" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M97 12 V24 H133 V12" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M25 44 V32 H61 V44" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M97 44 V32 H133 V44" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <path d="M61 24 H97" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
      <path d="M61 32 H97" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
    </svg>
  );
}

export default function TournamentFormatMiniPreview({ format }: Props) {
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
      {format === "single_elimination" && <SingleEliminationGraphic />}
      {format === "double_elimination" && <DoubleEliminationGraphic />}
      {format === "round_robin" && <RoundRobinGraphic />}
      {format === "double_round_robin" && <RoundRobinGraphic doubleRound={true} />}
      {format === "combination" && <CombinationGraphic />}
      {format === "swiss" && <SwissGraphic />}
      <p className="mt-1 text-[10px] text-gray-500">Example bracket layout</p>
    </div>
  );
}
