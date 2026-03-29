"use client";

import { useState, useEffect, useRef } from "react";
import QuickTournamentForm from "@/components/QuickTournamentForm";
import type { QuickTournamentData } from "@/components/QuickTournamentForm";
import TournamentPreview from "@/components/TournamentPreview";
import {
  LABEL_BACK_TO_TOURNAMENT_TYPE,
  LABEL_DISCARD_DRAFT,
  LABEL_SAVE_AS_FILE,
  LABEL_LOAD_FROM_FILE,
  LABEL_EXPORT_PDF,
} from "@/constants/labels";
import { useNotify } from "@/hooks/useNotify";
import { apiFetch } from "@/lib/api";
import type { Bracket } from "@/lib/generateBracket";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Save } from "lucide-react";
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
    const migratedData = {
      ...parsed.data,
      discipline: parsed.data?.discipline ?? (parsed.data as any)?.game ?? "",
    };
    return { ...parsed, data: migratedData };
  } catch {
    return null;
  }
}

function saveDraft( data: QuickTournamentData) {
  try {
    const draft: SavedDraft = { data, savedAt: Date.now() };
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
  const notify = useNotify();
  const [ready, setReady] = useState(false);
  const [formData, setFormData] = useState<QuickTournamentData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setFormData(draft.data);
      setShowDraftBanner(true);
    }
    setReady(true);
  }, []);

  // Auto-save whenever formData changes (after initial load)
  useEffect(() => {
    if (!ready) return;
    if (
      formData &&
      (formData.name?.trim() || (Array.isArray(formData.participants) && formData.participants.length > 0))
    ) {
      saveDraft(formData);
    } else {
      clearDraft();
    }
  }, [formData, ready]);



  function handleDiscard() {
    clearDraft();
    setFormData(null);
    setShowDraftBanner(false);
    setPreviewKey((k) => k + 1);
  }

  // ─── JSON save / load ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSaveJSON() {
    const data = formData;
    if (!data) return;
    const json = JSON.stringify({ version: 1, data, savedAt: Date.now() }, null, 2);
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

  const [submittedData, setSubmittedData] = useState<QuickTournamentData | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  function handleFormSubmit(data: QuickTournamentData) {
    setSubmittedData(data);
    setFormData(data);
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function handleBackToForm() {
    setSubmittedData(null);
  }

  async function handleConfirm(data: QuickTournamentData, bracket: Bracket) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiFetch("/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          discipline: data.discipline,
          game: data.discipline,
          description: data.description || undefined,
          format: data.format,
          isPrivate: data.isPrivate,
          teamMode: data.teamMode,
          status: data.status || "active",
          participants: data.participants,
          bracketData: bracket,
          maxParticipants: data.participants.length,
          startDate: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body.error ?? "Failed to create tournament";
        setSubmitError(message);
        notify.error(message);
        return;
      }

      clearDraft();
      const created = await res.json();
      notify.success("Tournament created successfully.");
      router.push(`/tournaments/view/${created.id}`);
    } catch {
      const message = "Network error — please try again";
      setSubmitError(message);
      notify.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Don't render until we've checked localStorage to avoid flash
  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Back link */}
        <Link
          href="/tournaments/create"
          className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block no-print"
        >
          {LABEL_BACK_TO_TOURNAMENT_TYPE}
        </Link>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadJSON}
          className="hidden"
        />

        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Create Tournament</h1>
              <p className="text-sm text-muted-foreground">
                Set up your tournament details, add participants, and preview before creating
              </p>
            </div>
          </div>
        </div>

        {/* Draft banner */}
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

        {/* Save / Load / Export toolbar */}
        <div className="flex items-center gap-2 mb-6 no-print">
          <button
            type="button"
            onClick={handleSaveJSON}
            disabled={!formData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            {LABEL_SAVE_AS_FILE}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted"
          >
            {LABEL_LOAD_FROM_FILE}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted"
          >
            {LABEL_EXPORT_PDF}
          </button>
        </div>

        {/* Tournament form with live preview */}
        <QuickTournamentForm
          key={previewKey}
          initial={formData ?? undefined}
          onSubmit={handleFormSubmit}
          onChange={setFormData}
          hideSubmit={!!submittedData}
        />

        {/* Full bracket preview */}
        {submittedData && (
          <div ref={previewRef} className="mt-10 pt-8 border-t border-border">
            <h2 className="text-2xl font-bold text-foreground mb-1">Preview</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Review the bracket before starting the tournament.
            </p>
            <TournamentPreview
              data={submittedData}
              onBack={handleBackToForm}
              onConfirm={handleConfirm}
              submitting={submitting}
              submitError={submitError}
              onChange={saveDraft}
            />
          </div>
        )}
      </div>
    </div>
  );
}
