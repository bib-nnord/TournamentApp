"use client";

import { useState, type KeyboardEvent } from "react";
import { tournamentFormatInfo, type TournamentFormat } from "@/types";

export interface Participant {
  name: string;
  type: "account" | "guest";
}

export interface QuickTournamentData {
  name: string;
  game: string;
  description: string;
  format: TournamentFormat;
  participants: Participant[];
}

interface Props {
  initial?: QuickTournamentData;
  onSubmit: (data: QuickTournamentData) => void;
}

const formats = Object.entries(tournamentFormatInfo) as [TournamentFormat, { label: string; description: string }][];

export default function QuickTournamentForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [game, setGame] = useState(initial?.game ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [format, setFormat] = useState<TournamentFormat>(initial?.format ?? "single_elimination");

  const [accounts, setAccounts] = useState<string[]>(
    () => initial?.participants.filter((p) => p.type === "account").map((p) => p.name) ?? []
  );
  const [guests, setGuests] = useState<string[]>(
    () => initial?.participants.filter((p) => p.type === "guest").map((p) => p.name) ?? []
  );
  const [accountInput, setAccountInput] = useState("");
  const [guestInput, setGuestInput] = useState("");

  const totalParticipants = accounts.length + guests.length;
  const allNames = [...accounts, ...guests];

  function addTag(value: string, setList: React.Dispatch<React.SetStateAction<string[]>>) {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Allow duplicates — auto-number with (2), (3), etc.
    let finalName = trimmed;
    if (allNames.includes(trimmed)) {
      let n = 2;
      while (allNames.includes(`${trimmed} (${n})`)) n++;
      finalName = `${trimmed} (${n})`;
    }
    setList((prev) => [...prev, finalName]);
  }

  function removeTag(index: number, setList: React.Dispatch<React.SetStateAction<string[]>>) {
    setList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input, setList);
      setInput("");
    }
    if (e.key === "Backspace" && input === "" && list.length > 0) {
      setList((prev) => prev.slice(0, -1));
    }
  }

  function handleBlur(
    input: string,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    if (input.trim()) {
      addTag(input, setList);
      setInput("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (totalParticipants < 2) return;
    const participants: Participant[] = [
      ...accounts.map((n) => ({ name: n, type: "account" as const })),
      ...guests.map((n) => ({ name: n, type: "guest" as const })),
    ];
    onSubmit({ name, game, description, format, participants });
  }

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const labelClass = "block text-xs text-gray-400 uppercase tracking-wide mb-1";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClass}>Tournament name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Friday Night Showdown"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Game / Discipline</label>
        <input
          value={game}
          onChange={(e) => setGame(e.target.value)}
          required
          placeholder="e.g. Chess, Rocket League"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          Description <span className="normal-case text-gray-300">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the format, rules, prizes…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className={labelClass}>Tournament format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as TournamentFormat)}
          className={inputClass}
        >
          {formats.map(([key, { label, description: desc }]) => (
            <option key={key} value={key}>
              {label} — {desc}
            </option>
          ))}
        </select>
      </div>

      {/* Accounts */}
      <div>
        <label className={labelClass}>
          Accounts{" "}
          <span className="normal-case text-gray-300">
            (registered users — by username or email)
          </span>
        </label>
        <TagInput
          id="account-input"
          tags={accounts}
          input={accountInput}
          setInput={setAccountInput}
          onKeyDown={(e) => handleKeyDown(e, accountInput, setAccountInput, accounts, setAccounts)}
          onBlur={() => handleBlur(accountInput, setAccountInput, setAccounts)}
          onRemove={(i) => removeTag(i, setAccounts)}
          placeholder="Type username or email, press Enter…"
          chipColor="bg-indigo-50 text-indigo-700"
          chipClose="text-indigo-400 hover:text-indigo-700"
        />
      </div>

      {/* Guests */}
      <div>
        <label className={labelClass}>
          Guests{" "}
          <span className="normal-case text-gray-300">
            (no account — just a display name)
          </span>
        </label>
        <TagInput
          id="guest-input"
          tags={guests}
          input={guestInput}
          setInput={setGuestInput}
          onKeyDown={(e) => handleKeyDown(e, guestInput, setGuestInput, guests, setGuests)}
          onBlur={() => handleBlur(guestInput, setGuestInput, setGuests)}
          onRemove={(i) => removeTag(i, setGuests)}
          placeholder="Type a display name, press Enter…"
          chipColor="bg-amber-50 text-amber-700"
          chipClose="text-amber-400 hover:text-amber-700"
        />
      </div>

      <div className="text-xs text-gray-400">
        {totalParticipants} participant{totalParticipants !== 1 ? "s" : ""} total — minimum 2 to continue
      </div>

      <button
        type="submit"
        disabled={totalParticipants < 2}
        className="mt-2 w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Generate Bracket →
      </button>
    </form>
  );
}

// ─── Reusable tag input ───────────────────────────────────────────────────────

function TagInput({
  id,
  tags,
  input,
  setInput,
  onKeyDown,
  onBlur,
  onRemove,
  placeholder,
  chipColor,
  chipClose,
}: {
  id: string;
  tags: string[];
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onRemove: (i: number) => void;
  placeholder: string;
  chipColor: string;
  chipClose: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-400 min-h-[42px] cursor-text"
      onClick={() => document.getElementById(id)?.focus()}
    >
      {tags.map((t, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${chipColor}`}
        >
          {t}
          <button type="button" onClick={() => onRemove(i)} className={`leading-none ${chipClose}`}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={input}
        onChange={(e) => setInput(e.target.value.replace(",", ""))}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] text-sm text-gray-800 outline-none bg-transparent py-1"
      />
    </div>
  );
}
