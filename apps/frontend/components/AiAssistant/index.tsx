"use client";

import { Bot, Minus, Send, Trash2, X } from "lucide-react";
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

const SUGGESTIONS = [
  "How do I create a tournament?",
  "What formats are available?",
  "Quick vs Scheduled tournament?",
  "How does team mode work?",
];

const SESSION_KEY = "ai-chat-history";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialized = useRef(false);

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
                  I can help you understand features and create tournaments.
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
              <MessageContent
                markdown={m.role === "assistant"}
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground max-w-[85%] text-sm"
                    : "bg-secondary max-w-[85%] text-sm"
                }
              >
                {m.content}
              </MessageContent>
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
