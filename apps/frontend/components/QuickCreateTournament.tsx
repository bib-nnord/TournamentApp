"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import CreateTournamentForm from "@/components/CreateTournamentForm";

export default function QuickCreateTournament({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"}
      >
        + Create
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create tournament">
        <CreateTournamentForm onSuccess={() => setOpen(false)} showAdvancedLink />
      </Modal>
    </>
  );
}
