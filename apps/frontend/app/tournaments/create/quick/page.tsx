"use client";

import { useState } from "react";
import Link from "next/link";
import QuickTournamentForm, { type QuickTournamentData } from "@/components/QuickTournamentForm";
import TournamentPreview from "@/components/TournamentPreview";
import type { Bracket } from "@/lib/generateBracket";

export default function QuickTournamentPage() {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [formData, setFormData] = useState<QuickTournamentData | null>(null);

  function handleFormSubmit(data: QuickTournamentData) {
    setFormData(data);
    setStep("preview");
  }

  function handleBack() {
    setStep("form");
  }

  function handleConfirm(data: QuickTournamentData, bracket: Bracket) {
    // TODO: POST to backend
    console.log("Confirmed tournament:", data);
    console.log("Bracket:", bracket);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link
          href="/tournaments/create"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
        >
          ← Back to tournament type
        </Link>

        {step === "form" && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Quick Tournament</h1>
              <p className="text-sm text-gray-500 mb-6">
                Starts immediately — add participants manually and generate the bracket.
              </p>
              <QuickTournamentForm initial={formData ?? undefined} onSubmit={handleFormSubmit} />
            </div>
          </div>
        )}

        {step === "preview" && formData && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Review & Confirm</h1>
            <p className="text-sm text-gray-500 mb-6">
              Review the bracket and edit details before starting the tournament.
            </p>
            <TournamentPreview data={formData} onBack={handleBack} onConfirm={handleConfirm} />
          </div>
        )}
      </div>
    </div>
  );
}
