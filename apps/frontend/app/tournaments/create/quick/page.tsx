"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickTournamentForm, { type QuickTournamentData } from "@/components/QuickTournamentForm";
import TournamentPreview from "@/components/TournamentPreview";
import type { Bracket } from "@/lib/generateBracket";
import { apiFetch } from "@/lib/api";

export default function QuickTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "preview">("form");
  const [formData, setFormData] = useState<QuickTournamentData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleFormSubmit(data: QuickTournamentData) {
    setFormData(data);
    setStep("preview");
  }

  function handleBack() {
    setStep("form");
  }

  async function handleConfirm(data: QuickTournamentData, bracket: Bracket) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiFetch("/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          game: data.game,
          description: data.description || undefined,
          format: data.format,
          isPrivate: data.isPrivate,
          participants: data.participants,
          bracketData: bracket,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? "Failed to create tournament");
        return;
      }

      const created = await res.json();
      router.push(`/tournaments/view/${created.id}`);
    } catch {
      setSubmitError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
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
            <TournamentPreview data={formData} onBack={handleBack} onConfirm={handleConfirm} submitting={submitting} submitError={submitError} />
          </div>
        )}
      </div>
    </div>
  );
}
