"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LABEL_BACK_TO_TOURNAMENT_TYPE,
  LABEL_DISCARD_DRAFT,
  LABEL_SAVE_AS_FILE,
  LABEL_LOAD_FROM_FILE,
  LABEL_EXPORT_PDF,
} from "@/constants/labels";
import QuickTournamentForm, { type QuickTournamentData } from "@/components/QuickTournamentForm";
import TournamentPreview from "@/components/TournamentPreview";
import type { Bracket } from "@/lib/generateBracket";
import { apiFetch } from "@/lib/api";
import type { SavedDraft } from "./types";

const STORAGE_KEY = "quick-tournament-draft";

function loadDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedDraft;
    // Discard drafts older than 7 days
    if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(step: "form" | "preview", data: QuickTournamentData) {
  try {
    const draft: SavedDraft = { step, data, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage full or unavailable */
  }
}

function clearDraft() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export default function QuickTournamentPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [formData, setFormData] = useState<QuickTournamentData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setFormData(draft.data);
      setStep(draft.step);
      setShowDraftBanner(true);
    }
    setReady(true);
  }, []);

  // Auto-save whenever formData or step changes (after initial load)
  useEffect(() => {
    if (!ready) return;
    if (formData) {
      saveDraft(step, formData);
    }
  }, [formData, step, ready]);

  function handleFormSubmit(data: QuickTournamentData) {
    setFormData(data);
    setStep("preview");
    setShowDraftBanner(false);
  }

  // Called by the form whenever its internal state changes
  const handleFormChange = useCallback((data: QuickTournamentData) => {
    setFormData(data);
    saveDraft("form", data);
  }, []);

  function handleBack() {
    setStep("form");
  }

  function handleDiscard() {
    clearDraft();
    setFormData(null);
    setStep("form");
    setShowDraftBanner(false);
  }

  // ─── JSON save / load ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSaveJSON() {
    const data = formData;
    if (!data) return;
    const json = JSON.stringify({ version: 1, step, data, savedAt: Date.now() }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.name || "tournament").replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "tournament"}-draft.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed?.data && parsed.data.name !== undefined) {
          setFormData(parsed.data);
          setStep(parsed.step === "preview" ? "preview" : "form");
          setShowDraftBanner(false);
        }
      } catch {
        alert("Invalid file — could not load tournament draft.");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  // ─── PDF export ────────────────────────────────────────────────────────────
  function handleExportPDF() {
    window.print();
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
          status: data.status || "active",
          participants: data.participants,
          bracketData: bracket,
          maxParticipants: data.participants.length,
          startDate: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? "Failed to create tournament");
        return;
      }

      clearDraft();
      const created = await res.json();
      router.push(`/tournaments/view/${created.id}`);
    } catch {
      setSubmitError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // Don't render until we've checked localStorage to avoid flash
  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Link
          href="/tournaments/create"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block no-print"
        >
          {LABEL_BACK_TO_TOURNAMENT_TYPE}
        </Link>

        {showDraftBanner && (
          <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm no-print">
            <span className="text-amber-700">Restored from saved draft</span>
            <button
              type="button"
              onClick={handleDiscard}
              className="text-amber-600 hover:text-amber-800 font-medium underline underline-offset-2"
            >
              {LABEL_DISCARD_DRAFT}
            </button>
            <button
              type="button"
              onClick={() => setShowDraftBanner(false)}
              className="ml-auto text-amber-400 hover:text-amber-600"
            >
              ×
            </button>
          </div>
        )}

        {/* Hidden file input for JSON loading */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadJSON}
          className="hidden"
        />

        {/* Save / Load / Export toolbar */}
        <div className="flex items-center gap-2 mb-4 no-print">
          <button
            type="button"
            onClick={handleSaveJSON}
            disabled={!formData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
            {LABEL_SAVE_AS_FILE}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14V8m0 0l-3 3m3-3l3 3M3 7v-3a2 2 0 012-2h14a2 2 0 012 2v3" /></svg>
            {LABEL_LOAD_FROM_FILE}
          </button>
          {step === "preview" && (
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
              {LABEL_EXPORT_PDF}
            </button>
          )}
        </div>

        {step === "form" && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Quick Tournament</h1>
              <p className="text-sm text-gray-500 mb-6">
                Starts immediately — add participants manually and generate the bracket.
              </p>
              <QuickTournamentForm initial={formData ?? undefined} onSubmit={handleFormSubmit} onChange={handleFormChange} />
            </div>
          </div>
        )}

        {step === "preview" && formData && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1 no-print">Review &amp; Confirm</h1>
            <p className="text-sm text-gray-500 mb-6 no-print">
              Review the bracket and edit details before starting the tournament.
            </p>
            <TournamentPreview data={formData} onBack={handleBack} onConfirm={handleConfirm} submitting={submitting} submitError={submitError} />
          </div>
        )}
      </div>
    </div>
  );
}
