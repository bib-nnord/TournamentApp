"use client";

import { Bot, Check, AlertCircle, Loader2, Minus, Send, Trash2, Trophy, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Loader } from "@/components/ui/loader";
import { Message, MessageContent } from "@/components/ui/message";
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import { ScrollButton } from "@/components/ui/scroll-button";
import { apiFetch } from "@/lib/api";
import { generateBracket } from "@/lib/generateBracket";
import type { TournamentFormat } from "@/types";

const SUGGESTIONS = [
  "Help me create an account",
  "Create a tournament for me",
  "Help me create a team",
  "What formats are available?",
];

const SESSION_KEY = "ai-chat-history";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface TournamentConfig {
  type: "quick" | "scheduled";
  name: string;
  discipline: string;
  format: string;
  description?: string;
  isPrivate?: boolean;
  teamMode?: boolean;
  participants?: string[];
  startDate?: string;
  registrationMode?: string;
  maxParticipants?: number;
}

interface TeamConfig {
  name: string;
  description?: string;
  disciplines?: string[];
  open?: boolean;
}

const VALID_FORMATS = new Set([
  "single_elimination", "double_elimination", "round_robin",
  "double_round_robin", "combination", "swiss",
]);

function parseTournamentAction(content: string): {
  before: string;
  config: TournamentConfig | null;
  after: string;
} {
  const startTag = "[TOURNAMENT_ACTION]";
  const endTag = "[/TOURNAMENT_ACTION]";

  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) return { before: content, config: null, after: "" };

  const jsonStart = startIdx + startTag.length;
  const endIdx = content.indexOf(endTag, jsonStart);
  if (endIdx === -1) return { before: content, config: null, after: "" };

  const jsonStr = content.slice(jsonStart, endIdx).trim();
  const before = content.slice(0, startIdx).trim();
  const after = content.slice(endIdx + endTag.length).trim();

  try {
    const config = JSON.parse(jsonStr) as TournamentConfig;
    if (!config.name || !config.discipline || !config.format) return { before: content, config: null, after: "" };
    if (!VALID_FORMATS.has(config.format)) return { before: content, config: null, after: "" };
    return { before, config, after };
  } catch {
    return { before: content, config: null, after: "" };
  }
}

function parseTeamAction(content: string): {
  before: string;
  config: TeamConfig | null;
  after: string;
} {
  const startTag = "[TEAM_ACTION]";
  const endTag = "[/TEAM_ACTION]";

  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) return { before: content, config: null, after: "" };

  const jsonStart = startIdx + startTag.length;
  const endIdx = content.indexOf(endTag, jsonStart);
  if (endIdx === -1) return { before: content, config: null, after: "" };

  const jsonStr = content.slice(jsonStart, endIdx).trim();
  const before = content.slice(0, startIdx).trim();
  const after = content.slice(endIdx + endTag.length).trim();

  try {
    const config = JSON.parse(jsonStr) as TeamConfig;
    if (!config.name) return { before: content, config: null, after: "" };
    return { before, config, after };
  } catch {
    return { before: content, config: null, after: "" };
  }
}

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  double_round_robin: "Double Round Robin",
  combination: "Combination",
  swiss: "Swiss System",
};

function loadSessionMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch { /* quota exceeded — ignore */ }
}

let idCounter = 0;
function genId() {
  return `msg-${Date.now()}-${++idCounter}`;
}

function TournamentActionCard({
  config,
  status,
  errorMsg,
  tournamentId,
  onCreate,
}: {
  config: TournamentConfig;
  status: "idle" | "creating" | "success" | "error";
  errorMsg?: string;
  tournamentId?: number;
  onCreate: () => void;
}) {
  return (
    <div className="my-2 max-w-[85%] rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {config.type === "quick" ? "Quick" : "Scheduled"} Tournament
          </span>
        </div>
        {status === "success" && tournamentId && (
          <a
            href={`/tournaments/view/${tournamentId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit Details &rarr;
          </a>
        )}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Name:</span> {config.name}</p>
        <p><span className="font-medium text-foreground">Discipline:</span> {config.discipline}</p>
        <p><span className="font-medium text-foreground">Format:</span> {FORMAT_LABELS[config.format] || config.format}</p>
        {config.participants && (
          <p><span className="font-medium text-foreground">Participants ({config.participants.length}):</span> {config.participants.join(", ")}</p>
        )}
        {config.startDate && (
          <p><span className="font-medium text-foreground">Start:</span> {new Date(config.startDate).toLocaleDateString()}</p>
        )}
        {config.registrationMode && (
          <p><span className="font-medium text-foreground">Registration:</span> {config.registrationMode.replace("_", " ")}</p>
        )}
        {config.maxParticipants && (
          <p><span className="font-medium text-foreground">Max participants:</span> {config.maxParticipants}</p>
        )}
      </div>
      <div className="mt-3">
        {status === "idle" && (
          <Button size="sm" className="w-full text-xs" onClick={onCreate}>
            <Trophy className="mr-1 h-3 w-3" />
            Create Tournament
          </Button>
        )}
        {status === "creating" && (
          <Button size="sm" className="w-full text-xs" disabled>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Creating...
          </Button>
        )}
        {status === "success" && (
          <Button size="sm" variant="outline" className="w-full text-xs text-green-600" disabled>
            <Check className="mr-1 h-3 w-3" />
            Created!
          </Button>
        )}
        {status === "error" && (
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errorMsg || "Failed to create. Are you logged in?"}
            </div>
            <Button size="sm" className="w-full text-xs" onClick={onCreate}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamActionCard({
  config,
  status,
  errorMsg,
  teamId,
  onCreate,
}: {
  config: TeamConfig;
  status: "idle" | "creating" | "success" | "error";
  errorMsg?: string;
  teamId?: number;
  onCreate: () => void;
}) {
  return (
    <div className="my-2 max-w-[85%] rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Create Team</span>
        </div>
        {status === "success" && teamId && (
          <a
            href={`/teams/${teamId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View Team &rarr;
          </a>
        )}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Name:</span> {config.name}</p>
        {config.description && (
          <p><span className="font-medium text-foreground">Description:</span> {config.description}</p>
        )}
        {config.disciplines && config.disciplines.length > 0 && (
          <p><span className="font-medium text-foreground">Disciplines:</span> {config.disciplines.join(", ")}</p>
        )}
        <p><span className="font-medium text-foreground">Open to join:</span> {config.open !== false ? "Yes" : "No"}</p>
      </div>
      <div className="mt-3">
        {status === "idle" && (
          <Button size="sm" className="w-full text-xs" onClick={onCreate}>
            <Users className="mr-1 h-3 w-3" />
            Create Team
          </Button>
        )}
        {status === "creating" && (
          <Button size="sm" className="w-full text-xs" disabled>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Creating...
          </Button>
        )}
        {status === "success" && (
          <Button size="sm" variant="outline" className="w-full text-xs text-green-600" disabled>
            <Check className="mr-1 h-3 w-3" />
            Team Created!
          </Button>
        )}
        {status === "error" && (
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errorMsg || "Failed to create team. Are you logged in?"}
            </div>
            <Button size="sm" className="w-full text-xs" onClick={onCreate}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialized = useRef(false);
  const [creationStatus, setCreationStatus] = useState<
    Record<string, { status: "idle" | "creating" | "success" | "error"; tournamentId?: number; teamId?: number; error?: string }>
  >({});

  // Load session messages on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setMessages(loadSessionMessages());
    }
  }, []);

  // Persist messages
  useEffect(() => {
    if (initialized.current && messages.length > 0) {
      saveSessionMessages(messages);
    }
  }, [messages]);

  const sendMessage = useCallback(async (allMessages: ChatMessage[]) => {
    setIsLoading(true);
    setError(null);

    const assistantId = genId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + text } : m
          )
        );
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Failed to get response. Is Ollama running on localhost:11434?");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, []);

  const createTournament = useCallback(async (messageId: string, config: TournamentConfig) => {
    setCreationStatus((prev) => ({ ...prev, [messageId]: { status: "creating" } }));

    try {
      let res: Response;

      if (config.type === "quick") {
        if (!config.participants || config.participants.length < 2) {
          throw new Error("Need at least 2 participants");
        }

        const participants = config.participants.map((name) => ({
          name,
          type: "guest" as const,
        }));

        const bracket = generateBracket(
          config.participants,
          config.format as TournamentFormat,
        );

        res = await apiFetch("/tournaments", {
          method: "POST",
          body: JSON.stringify({
            name: config.name,
            discipline: config.discipline,
            game: config.discipline,
            format: config.format,
            description: config.description || undefined,
            isPrivate: config.isPrivate || false,
            teamMode: config.teamMode || false,
            status: "draft",
            participants,
            bracketData: bracket,
            maxParticipants: config.participants.length,
            startDate: new Date().toISOString(),
          }),
        });
      } else {
        res = await apiFetch("/tournaments/scheduled", {
          method: "POST",
          body: JSON.stringify({
            name: config.name,
            discipline: config.discipline,
            format: config.format,
            description: config.description || undefined,
            isPrivate: config.isPrivate || false,
            teamMode: config.teamMode || false,
            startDate: config.startDate,
            registrationMode: config.registrationMode || "open",
            maxParticipants: config.maxParticipants,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      setCreationStatus((prev) => ({
        ...prev,
        [messageId]: { status: "success", tournamentId: data.id },
      }));
    } catch (err) {
      setCreationStatus((prev) => ({
        ...prev,
        [messageId]: { status: "error", error: (err as Error).message },
      }));
    }
  }, []);

  const createTeam = useCallback(async (messageId: string, config: TeamConfig) => {
    setCreationStatus((prev) => ({ ...prev, [messageId]: { status: "creating" } }));

    try {
      const res = await apiFetch("/teams", {
        method: "POST",
        body: JSON.stringify({
          name: config.name,
          description: config.description || "",
          disciplines: config.disciplines || [],
          open: config.open !== false,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create team (${res.status})`);
      }

      const data = await res.json();
      setCreationStatus((prev) => ({
        ...prev,
        [messageId]: { status: "success", teamId: data.team?.id },
      }));
    } catch (err) {
      setCreationStatus((prev) => ({
        ...prev,
        [messageId]: { status: "error", error: (err as Error).message },
      }));
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { id: genId(), role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    sendMessage(newMessages);
  }, [input, isLoading, messages, sendMessage]);

  const handleSuggestion = useCallback((text: string) => {
    if (isLoading) return;
    const userMsg: ChatMessage = { id: genId(), role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    sendMessage(newMessages);
  }, [isLoading, messages, sendMessage]);

  const handleClear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
    setError(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  // Floating trigger button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Open AI assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  // Minimized bar
  if (minimized) {
    return (
      <div className="fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-lg">
        <Bot className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">TourneyBot</span>
        <button
          onClick={() => setMinimized(false)}
          className="ml-2 rounded-md p-1 hover:bg-accent"
          aria-label="Expand chat"
        >
          <Bot className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setOpen(false); setMinimized(false); }}
          className="rounded-md p-1 hover:bg-accent"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Full chat panel
  return (
    <div className="fixed right-5 bottom-5 z-50 flex h-[min(600px,80vh)] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">TourneyBot</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Clear chat"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setMinimized(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent className="space-y-3 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 pt-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Hi! I&apos;m TourneyBot</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  I can help you create accounts, teams, and tournaments.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <PromptSuggestion
                    key={s}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSuggestion(s)}
                  >
                    {s}
                  </PromptSuggestion>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} className={m.role === "user" ? "justify-end" : ""}>
              {m.role === "user" ? (
                <MessageContent
                  className="bg-primary text-primary-foreground max-w-[85%] text-sm"
                >
                  {m.content}
                </MessageContent>
              ) : (() => {
                const { before: tBefore, config: tConfig, after: tAfter } = parseTournamentAction(m.content);
                if (tConfig) {
                  const cs = creationStatus[m.id] || { status: "idle" as const };
                  return (
                    <div className="max-w-[85%] space-y-2">
                      {tBefore && (
                        <MessageContent markdown className="bg-secondary text-sm">
                          {tBefore}
                        </MessageContent>
                      )}
                      <TournamentActionCard
                        config={tConfig}
                        status={cs.status}
                        errorMsg={cs.error}
                        tournamentId={cs.tournamentId}
                        onCreate={() => createTournament(m.id, tConfig)}
                      />
                      {tAfter && (
                        <MessageContent markdown className="bg-secondary text-sm">
                          {tAfter}
                        </MessageContent>
                      )}
                    </div>
                  );
                }

                const { before: tmBefore, config: tmConfig, after: tmAfter } = parseTeamAction(m.content);
                if (tmConfig) {
                  const cs = creationStatus[m.id] || { status: "idle" as const };
                  return (
                    <div className="max-w-[85%] space-y-2">
                      {tmBefore && (
                        <MessageContent markdown className="bg-secondary text-sm">
                          {tmBefore}
                        </MessageContent>
                      )}
                      <TeamActionCard
                        config={tmConfig}
                        status={cs.status}
                        errorMsg={cs.error}
                        teamId={cs.teamId}
                        onCreate={() => createTeam(m.id, tmConfig)}
                      />
                      {tmAfter && (
                        <MessageContent markdown className="bg-secondary text-sm">
                          {tmAfter}
                        </MessageContent>
                      )}
                    </div>
                  );
                }

                return (
                  <MessageContent
                    markdown
                    className="bg-secondary max-w-[85%] text-sm"
                  >
                    {m.content}
                  </MessageContent>
                );
              })()}
            </Message>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <Message>
              <div className="rounded-lg bg-secondary p-2 text-sm w-fit">
                <Loader variant="typing" size="sm" />
              </div>
            </Message>
          )}

          {error && (
            <div className="mx-auto max-w-[85%] rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Failed to get response. Is Ollama running on localhost:11434?
            </div>
          )}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex justify-center pb-2">
          <ScrollButton className="pointer-events-auto" />
        </div>
      </ChatContainerRoot>

      {/* Input */}
      <div className="border-t p-3">
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          maxHeight={120}
          className="rounded-2xl"
        >
          <PromptInputTextarea
            placeholder="Ask about tournaments..."
            className="min-h-[36px] text-sm"
          />
          <PromptInputActions className="justify-end">
            <Button
              size="sm"
              className="h-8 w-8 rounded-full"
              disabled={!input.trim() || isLoading}
              onClick={handleSubmit}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
