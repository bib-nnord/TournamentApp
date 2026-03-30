"use client";

import { useState } from "react";
import ScheduledTournamentForm, { type ScheduledTournamentData } from "@/components/ScheduledTournamentForm";
import { LABEL_BACK_TO_TOURNAMENT_TYPE } from "@/constants/labels";
import { useNotify } from "@/hooks/useNotify";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";

export default function ScheduledTournamentPage() {
  const router = useRouter();
  const notify = useNotify();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(data: ScheduledTournamentData) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiFetch("/tournaments/scheduled", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          discipline: data.discipline,
          description: data.description || undefined,
          format: data.format,
          isPrivate: data.isPrivate,
          teamMode: data.teamMode,
          registrationMode: data.registrationMode,
          maxParticipants: data.maxParticipants ?? undefined,
          startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
          registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt).toISOString() : undefined,
          invites: data.invites,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body.error ?? "Failed to create tournament";
        setSubmitError(message);
        notify.error(message);
        return;
      }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Link
          href="/tournaments/create"
          className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block"
        >
          {LABEL_BACK_TO_TOURNAMENT_TYPE}
        </Link>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <CalendarClock className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scheduled Tournament</h1>
            <p className="text-sm text-muted-foreground">
              Set a future date and open registration. Participants sign up on their own.
            </p>
          </div>
        </div>

        <ScheduledTournamentForm
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
        />
      </div>
    </div>
  );
}
