"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionHook {
  /** Whether the browser supports the Web Speech API */
  isSupported: boolean;
  /** Whether the recognizer is actively listening */
  isListening: boolean;
  /** The latest finalized transcript segment */
  transcript: string;
  /** Interim (not yet finalized) text while the user is still speaking */
  interimTranscript: string;
  /** Start listening */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Toggle listening on/off */
  toggle: () => void;
}

// Vendor-prefixed types
type SpeechRecognitionCtor = typeof window.SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.SpeechRecognition ??
    (window as unknown as Record<string, SpeechRecognitionCtor>)
      .webkitSpeechRecognition
  );
}

export function useSpeechRecognition(
  lang: string = navigator?.language ?? "en-US",
): SpeechRecognitionHook {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stoppedManually = useRef(false);

  // Check support on mount
  useEffect(() => {
    setIsSupported(!!getRecognitionCtor());
  }, []);

  // Create / tear down the recognition instance
  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) setTranscript(final);
      setInterimTranscript(interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      // Auto-restart if not manually stopped (browser sometimes stops early)
      if (!stoppedManually.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          // Already started or other error — ignore
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" fires when we call stop() — not a real error
      if (event.error === "aborted" || event.error === "no-speech") return;
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    return () => {
      stoppedManually.current = true;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    stoppedManually.current = false;
    try {
      r.start();
      setIsListening(true);
    } catch {
      // Already started
    }
  }, []);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    stoppedManually.current = true;
    r.stop();
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    start,
    stop,
    toggle,
  };
}
