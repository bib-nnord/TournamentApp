"use client";

import { useEffect, useRef, useState, createContext, useContext } from "react";
import {
  LABEL_CANCEL,
  LABEL_CONFIRM,
  LABEL_CONFIRM_WINNER,
  LABEL_TIE,
  LABEL_UNDO,
} from "@/constants/labels";
import type { Bracket, BracketRound, BracketMatch, TiebreakerMatch } from "@/lib/generateBracket";
import Link from "next/link";

const TournamentIdContext = createContext<number | null>(null);
const HighlightContext = createContext<Set<string> | null>(null);
const NameAnnotationContext = createContext<Record<string, string> | null>(null);

function normalizeHighlightValue(value: string): string {
  return value.trim().toLowerCase();
}

function buildHighlightSet(values: Array<string | null | undefined>): Set<string> {
  return new Set(
    values
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => normalizeHighlightValue(value))
  );
}

function isHighlightedName(highlightNames: Set<string> | null, value: string | null | undefined): boolean {
  if (!highlightNames || !value) return false;
  return highlightNames.has(normalizeHighlightValue(value));
}

function resolveAnnotatedName(name: string, annotations: Record<string, string> | null): string {
  if (!annotations) return name;
  const realName = annotations[name];
  if (!realName) return name;

  const trimmed = name.trim();
  const looksDeduped = /\(\d+\)$/.test(trimmed);
  if (!looksDeduped) return name;

  if (trimmed.toLowerCase() === realName.trim().toLowerCase()) return name;
  return `${name} (${realName})`;
}

type Size = {
  width: number;
  height: number;
};

const DEFAULT_PRINT_PAGE = {
  width: 1040,
  height: 690,
};

const PREVIEW_PRINT_PAGE = {
  width: 810,
  height: 670,
};

function readElementSize(element: HTMLElement | null): Size {
  if (!element) {
    return { width: 0, height: 0 };
  }

  return {
    width: Math.ceil(element.scrollWidth),
    height: Math.ceil(element.scrollHeight),
  };
}

function getFitScale(content: Size, viewport: Size): number {
  if (!content.width || !content.height || !viewport.width || !viewport.height) {
    return 1;
  }

  return Math.min(1, viewport.width / content.width, viewport.height / content.height);
}

function BracketChrome({
  children,
  isExpanded,
  onToggleExpanded,
}: {
  children: React.ReactNode;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex justify-end mb-3 no-print">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        >
          {isExpanded ? "Close expanded view" : "Expand bracket"}
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export default function BracketView({ bracket, tournamentId, highlightName, highlightNames, nameAnnotations, onSwapParticipants, advancersPerGroup, onAdvancersChange, autoAdvanceGroups, onAutoAdvanceGroupsChange, onMoveParticipant, onReportResult, onReportTiebreaker, onUndoTiebreaker }: {
  bracket: Bracket;
  tournamentId?: number;
  highlightName?: string;
  highlightNames?: string[];
  nameAnnotations?: Record<string, string>;
  onSwapParticipants?: (a: string, b: string) => void;
  advancersPerGroup?: number;
  onAdvancersChange?: (n: number) => void;
  autoAdvanceGroups?: string[][];
  onAutoAdvanceGroupsChange?: (groups: string[][]) => void;
  onMoveParticipant?: (name: string, fromGroupIndex: number, toGroupIndex: number) => void;
  onReportResult?: (matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) => Promise<void>;
  onReportTiebreaker?: (matchId: string, winnerName: string) => Promise<void>;
  onUndoTiebreaker?: () => Promise<void>;
}) {
  const resolvedHighlightNames = buildHighlightSet([highlightName, ...(highlightNames ?? [])]);
  const allowTies = bracket.allowTies !== false;
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitToScreen, setFitToScreen] = useState(false);
  const [printMetrics, setPrintMetrics] = useState({ scale: 1, height: 0 });
  const [expandedContentSize, setExpandedContentSize] = useState<Size>({ width: 0, height: 0 });
  const [expandedViewportSize, setExpandedViewportSize] = useState<Size>({ width: 0, height: 0 });
  const inlineShellRef = useRef<HTMLDivElement | null>(null);
  const inlineContentRef = useRef<HTMLDivElement | null>(null);
  const expandedViewportRef = useRef<HTMLDivElement | null>(null);
  const expandedContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  useEffect(() => {
    function updatePrintMetrics() {
      const shell = inlineShellRef.current;
      const contentElement = inlineContentRef.current;
      if (!shell || !contentElement) return;

      const contentSize = readElementSize(contentElement);
      const maxPage = shell.closest(".print-bracket") ? PREVIEW_PRINT_PAGE : DEFAULT_PRINT_PAGE;
      const scale = getFitScale(contentSize, maxPage);

      setPrintMetrics({
        scale,
        height: Math.ceil(contentSize.height * scale),
      });
    }

    updatePrintMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updatePrintMetrics();
    });

    if (inlineShellRef.current) {
      resizeObserver.observe(inlineShellRef.current);
    }
    if (inlineContentRef.current) {
      resizeObserver.observe(inlineContentRef.current);
    }

    window.addEventListener("resize", updatePrintMetrics);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePrintMetrics);
    };
  }, [bracket]);

  useEffect(() => {
    if (!isExpanded) return;

    function updateExpandedMetrics() {
      const viewport = expandedViewportRef.current;
      const contentElement = expandedContentRef.current;
      if (!viewport || !contentElement) return;

      setExpandedViewportSize({
        width: Math.max(viewport.clientWidth - 24, 0),
        height: Math.max(viewport.clientHeight - 24, 0),
      });
      setExpandedContentSize(readElementSize(contentElement));
    }

    updateExpandedMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updateExpandedMetrics();
    });

    if (expandedViewportRef.current) {
      resizeObserver.observe(expandedViewportRef.current);
    }
    if (expandedContentRef.current) {
      resizeObserver.observe(expandedContentRef.current);
    }

    window.addEventListener("resize", updateExpandedMetrics);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateExpandedMetrics);
    };
  }, [isExpanded, bracket]);

  useEffect(() => {
    if (!isExpanded) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoom(1);
    setFitToScreen(false);
  }, [isExpanded, bracket]);

  const mainContent = (() => {
    switch (bracket.format) {
      case "single_elimination":
        return <EliminationBracket rounds={bracket.rounds} onSwapParticipants={onSwapParticipants} onReportResult={onReportResult} allowTies={allowTies} />;
      case "double_elimination": {
        const allLosers = bracket.losersRounds ?? [];
        const grandFinalRound = allLosers.length > 0 && allLosers[allLosers.length - 1].name === "Grand Final"
          ? allLosers[allLosers.length - 1]
          : null;
        const losersOnly = grandFinalRound ? allLosers.slice(0, -1) : allLosers;

        return (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Winners Bracket</h3>
              <EliminationBracket
                rounds={bracket.rounds}
                onSwapParticipants={onSwapParticipants}
                grandFinal={grandFinalRound?.matches[0]}
                onReportResult={onReportResult}
                allowTies={allowTies}
              />
            </div>
            {losersOnly.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Losers Bracket</h3>
                <EliminationBracket
                  rounds={losersOnly}
                  onSwapParticipants={onSwapParticipants}
                  showOutputConnector={!!grandFinalRound}
                  onReportResult={onReportResult}
                  allowTies={allowTies}
                />
              </div>
            )}
          </div>
        );
      }
      case "round_robin":
      case "double_round_robin":
        return <RoundRobinView rounds={bracket.rounds} isDouble={bracket.format === "double_round_robin"} onReportResult={onReportResult} allowTies={allowTies} />;
      case "swiss":
        return <SwissView rounds={bracket.rounds} onReportResult={onReportResult} allowTies={allowTies} />;
      case "combination":
        return (
          <CombinationView
            bracket={bracket}
            onSwapParticipants={onSwapParticipants}
            advancersPerGroup={advancersPerGroup}
            onAdvancersChange={onAdvancersChange}
            autoAdvanceGroups={autoAdvanceGroups}
            onAutoAdvanceGroupsChange={onAutoAdvanceGroupsChange}
            onMoveParticipant={onMoveParticipant}
            onReportResult={onReportResult}
            allowTies={allowTies}
          />
        );
    }
  })();

  const content = (
    <HighlightContext.Provider value={resolvedHighlightNames.size > 0 ? resolvedHighlightNames : null}>
      <NameAnnotationContext.Provider value={nameAnnotations ?? null}>
        <TournamentIdContext.Provider value={tournamentId ?? null}>
          {mainContent}
          {bracket.tiebreaker && (
            <TiebreakerPanel tiebreaker={bracket.tiebreaker} onReport={onReportTiebreaker} onUndo={onUndoTiebreaker} />
          )}
        </TournamentIdContext.Provider>
      </NameAnnotationContext.Provider>
    </HighlightContext.Provider>
  );

  const fitScale = getFitScale(expandedContentSize, expandedViewportSize);
  const expandedScale = fitToScreen ? fitScale : zoom;
  const expandedScaledWidth = expandedContentSize.width > 0 ? Math.ceil(expandedContentSize.width * expandedScale) : undefined;
  const expandedScaledHeight = expandedContentSize.height > 0 ? Math.ceil(expandedContentSize.height * expandedScale) : undefined;

  return (
    <>
      <BracketChrome isExpanded={false} onToggleExpanded={() => setIsExpanded(true)}>
        <div
          ref={inlineShellRef}
          className="bracket-print-shell"
          style={{
            ["--bracket-print-scale" as string]: String(printMetrics.scale),
            ["--bracket-print-height" as string]: printMetrics.height ? `${printMetrics.height}px` : "auto",
          }}
        >
          <div ref={inlineContentRef} className="bracket-print-content">
            {content}
          </div>
        </div>
      </BracketChrome>
      {isExpanded && (
        <div className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-sm no-print">
          <div className="h-full w-full p-3 sm:p-5 lg:p-8">
            <div className="flex h-full flex-col rounded-[28px] border border-white/15 bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Expanded bracket</p>
                  <p className="text-xs text-gray-500">Use fit mode or zoom controls to inspect the full bracket. Press Escape to close.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFitToScreen((value) => !value)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      fitToScreen
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    }`}
                  >
                    {fitToScreen ? "Fitted" : "Fit to screen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFitToScreen(false);
                      setZoom((value) => Math.max(0.4, Number((value - 0.1).toFixed(2))));
                    }}
                    className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    Zoom out
                  </button>
                  <span className="min-w-14 text-center text-xs font-medium text-gray-500">
                    {Math.round(expandedScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFitToScreen(false);
                      setZoom((value) => Math.min(2.5, Number((value + 0.1).toFixed(2))));
                    }}
                    className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    Zoom in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFitToScreen(false);
                      setZoom(1);
                    }}
                    className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div ref={expandedViewportRef} className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-5">
                <div
                  className="inline-block min-w-full align-top"
                  style={{
                    width: expandedScaledWidth ? `${expandedScaledWidth}px` : undefined,
                    height: expandedScaledHeight ? `${expandedScaledHeight}px` : undefined,
                  }}
                >
                  <div
                    ref={expandedContentRef}
                    style={{
                      width: expandedContentSize.width ? `${expandedContentSize.width}px` : undefined,
                      transform: `scale(${expandedScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    {content}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tiebreaker panel ─────────────────────────────────────────────────────────

function TiebreakerPanel({
  tiebreaker,
  onReport,
  onUndo,
}: {
  tiebreaker: TiebreakerMatch;
  onReport?: (matchId: string, winnerName: string) => Promise<void>;
  onUndo?: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selected || !onReport) return;
    setSubmitting(true);
    setError(null);
    try {
      await onReport(tiebreaker.id, selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUndo() {
    if (!onUndo) return;
    setUndoing(true);
    setError(null);
    try {
      await onUndo();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to undo");
    } finally {
      setUndoing(false);
    }
  }

  if (tiebreaker.completed) {
    return (
      <div className="mt-6 border border-amber-200 rounded-xl bg-amber-50 p-4 flex items-center gap-3">
        <span className="text-xl">👑</span>
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Tiebreaker Winner</p>
          <p className="text-sm font-bold text-amber-900">{tiebreaker.winner}</p>
        </div>
        {onUndo && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            className="text-xs px-3 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {undoing ? "Undoing…" : LABEL_UNDO}
          </button>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 border-2 border-amber-300 rounded-xl bg-amber-50 p-4">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Tiebreaker</p>
      <p className="text-sm text-amber-800 mb-3">
        {tiebreaker.participants.length} participants are tied. Select the tiebreaker winner:
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {tiebreaker.participants.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setSelected(name)}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              selected === name
                ? "bg-amber-600 text-white"
                : "bg-white text-amber-800 border border-amber-300 hover:bg-amber-100"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {onReport && (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected || submitting}
          className="px-4 py-2 rounded text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
        >
          {submitting ? "Saving…" : LABEL_CONFIRM_WINNER}
        </button>
      )}
    </div>
  );
}

// ─── Elimination bracket (tree with connector lines) ──────────────────────────

const MATCH_W = 176;
const MATCH_H = 72; // slightly taller to accommodate result info
const ROUND_GAP = 48;
const CONNECTOR_W = 32;
const COL_W = MATCH_W + ROUND_GAP;

function EliminationBracket({
  rounds,
  onSwapParticipants,
  grandFinal,
  showOutputConnector,
  onReportResult,
  allowTies = true,
}: {
  rounds: BracketRound[];
  onSwapParticipants?: (a: string, b: string) => void;
  grandFinal?: BracketMatch;
  showOutputConnector?: boolean;
  onReportResult?: (matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) => Promise<void>;
  allowTies?: boolean;
}) {
  if (rounds.length === 0) return null;

  const firstRoundSlots = rounds[0].totalPositions ?? rounds[0].matches.length;
  const matchGap = 12;
  const totalHeight = firstRoundSlots * MATCH_H + (firstRoundSlots - 1) * matchGap;

  function getMatchYByPosition(totalSlots: number, position: number): number {
    const blockH = totalHeight / totalSlots;
    return blockH * position + blockH / 2;
  }

  function getRoundSlots(ri: number): number {
    return rounds[ri].totalPositions ?? rounds[ri].matches.length;
  }

  const baseSvgWidth = rounds.length * COL_W - ROUND_GAP;
  const hasExtra = !!grandFinal || !!showOutputConnector;
  const svgWidth = hasExtra ? baseSvgWidth + COL_W : baseSvgWidth;
  const svgHeight = totalHeight;

  const lastRi = rounds.length - 1;
  const lastSlots = getRoundSlots(lastRi);
  const lastMatch = rounds[lastRi].matches[0];
  const finalX = lastRi * COL_W + MATCH_W;
  const finalY = lastMatch ? getMatchYByPosition(lastSlots, lastMatch.position) : svgHeight / 2;

  const extraX = rounds.length * COL_W;
  const extraY = svgHeight / 2;

  return (
    <div className="overflow-x-auto pb-4 pt-8">
      <div className="relative" style={{ width: svgWidth, minHeight: svgHeight }}>
        {/* SVG connector lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgWidth}
          height={svgHeight}
          style={{ overflow: "visible" }}
        >
          {rounds.map((round, ri) => {
            if (ri === 0) return null;
            const prevRi = ri - 1;
            const prevMatches = rounds[prevRi].matches;
            const prevSlots = getRoundSlots(prevRi);
            const currSlots = getRoundSlots(ri);

            const is1to1 = prevSlots === currSlots;

            return round.matches.map((match) => {
              const currX = ri * COL_W;
              const currY = getMatchYByPosition(currSlots, match.position);
              const prevX = prevRi * COL_W + MATCH_W;

              const lines: React.ReactNode[] = [];

              if (is1to1) {
                const feedMatch = prevMatches.find(m => m.position === match.position);
                if (feedMatch) {
                  const prevY = getMatchYByPosition(prevSlots, feedMatch.position);
                  lines.push(
                    <path
                      key={`${ri}-${match.position}-s`}
                      d={`M ${prevX} ${prevY} H ${currX}`}
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                    />
                  );
                }
              } else {
                const feedPosA = match.position * 2;
                const feedPosB = match.position * 2 + 1;

                const feedMatchA = prevMatches.find(m => m.position === feedPosA);
                const feedMatchB = prevMatches.find(m => m.position === feedPosB);

                if (feedMatchA) {
                  const prevYA = getMatchYByPosition(prevSlots, feedMatchA.position);
                  lines.push(
                    <path
                      key={`${ri}-${match.position}-a`}
                      d={`M ${prevX} ${prevYA} H ${prevX + CONNECTOR_W / 2} V ${currY} H ${currX}`}
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                    />
                  );
                }
                if (feedMatchB) {
                  const prevYB = getMatchYByPosition(prevSlots, feedMatchB.position);
                  lines.push(
                    <path
                      key={`${ri}-${match.position}-b`}
                      d={`M ${prevX} ${prevYB} H ${prevX + CONNECTOR_W / 2} V ${currY} H ${currX}`}
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth={1.5}
                    />
                  );
                }
              }

              return lines;
            });
          })}

          {/* Connector from final match to grand final */}
          {grandFinal && (
            <path
              d={`M ${finalX} ${finalY} H ${finalX + CONNECTOR_W / 2} V ${extraY} H ${extraX}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={1.5}
            />
          )}

          {/* Output connector from final match going right (losers → grand final) */}
          {showOutputConnector && !grandFinal && (
            <path
              d={`M ${finalX} ${finalY} H ${extraX + MATCH_W / 2}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          )}
        </svg>

        {/* Round labels */}
        {rounds.map((round, ri) => (
          <div
            key={`label-${ri}`}
            className="absolute text-xs font-semibold text-gray-500 uppercase tracking-wide text-center"
            style={{ left: ri * COL_W, width: MATCH_W, top: -24 }}
          >
            {round.name}
          </div>
        ))}

        {/* Grand final label */}
        {grandFinal && (
          <div
            className="absolute text-xs font-bold text-indigo-600 uppercase tracking-wide text-center"
            style={{ left: extraX, width: MATCH_W, top: -24 }}
          >
            Grand Final
          </div>
        )}

        {/* Output connector label */}
        {showOutputConnector && !grandFinal && (
          <div
            className="absolute text-[10px] text-indigo-400 italic text-center"
            style={{ left: extraX, width: MATCH_W, top: extraY - MATCH_H / 2 - 14 }}
          >
            → to Grand Final
          </div>
        )}

        {/* Match cards */}
        {rounds.map((round, ri) => {
          const slots = getRoundSlots(ri);
          const isFinalRound = ri === rounds.length - 1 && !grandFinal;
          return round.matches.map((match) => {
            const y = getMatchYByPosition(slots, match.position) - MATCH_H / 2;
            return (
              <div
                key={match.id}
                className="absolute"
                style={{ left: ri * COL_W, top: y, width: MATCH_W }}
              >
                <MatchCard match={match} onSwapParticipants={onSwapParticipants} onReportResult={onReportResult} isFinal={isFinalRound} allowTies={allowTies} />
              </div>
            );
          });
        })}

        {/* Grand final match card */}
        {grandFinal && (
          <div
            className="absolute"
            style={{ left: extraX, top: extraY - MATCH_H / 2, width: MATCH_W }}
          >
            <MatchCard match={grandFinal} onReportResult={onReportResult} isFinal={true} allowTies={allowTies} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  onSwapParticipants,
  onReportResult,
  isFinal = false,
  allowTies = true,
}: {
  match: BracketMatch;
  onSwapParticipants?: (a: string, b: string) => void;
  onReportResult?: (matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) => Promise<void>;
  isFinal?: boolean;
  allowTies?: boolean;
}) {
  const tournamentId = useContext(TournamentIdContext);
  const highlightNames = useContext(HighlightContext);
  const nameAnnotations = useContext(NameAnnotationContext);
  const [dropTarget, setDropTarget] = useState<"a" | "b" | null>(null);
  const [reporting, setReporting] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<"a" | "b" | "tie" | null>(null);
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, name: string) {
    e.dataTransfer.setData("text/participant", name);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, slot: "a" | "b") {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(slot);
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  function handleDrop(e: React.DragEvent, targetName: string | null) {
    e.preventDefault();
    setDropTarget(null);
    const sourceName = e.dataTransfer.getData("text/participant");
    if (sourceName && targetName && sourceName !== targetName && onSwapParticipants) {
      onSwapParticipants(sourceName, targetName);
    }
  }

  async function handleSubmit() {
    if (!selectedWinner || !onReportResult) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sA = scoreA !== "" ? Number(scoreA) : undefined;
      const sB = scoreB !== "" ? Number(scoreB) : undefined;
      await onReportResult(match.id, selectedWinner, sA, sB);
      setReporting(false);
      setSelectedWinner(null);
      setScoreA("0");
      setScoreB("0");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setReporting(false);
    setSelectedWinner(null);
    setScoreA("0");
    setScoreB("0");
    setSubmitError(null);
  }

  function renderName(name: string | null | undefined) {
    if (!name || name === "TBD") return <span className="print-hide-tbd text-gray-300 italic">TBD</span>;
    return <>{resolveAnnotatedName(name, nameAnnotations)}</>;
  }

  const canDrag = !!onSwapParticipants;
  const canReport = !!onReportResult
    && !!match.participantA && match.participantA !== "TBD"
    && !!match.participantB && match.participantB !== "TBD";
  const wbA = match.wbDropDown === "a" || match.wbDropDown === "both";
  const wbB = match.wbDropDown === "b" || match.wbDropDown === "both";

  const isWinnerA = match.completed && !match.tie && match.winner === match.participantA;
  const isWinnerB = match.completed && !match.tie && match.winner === match.participantB;
  const isTie = match.completed && match.tie;
  const isMyA = isHighlightedName(highlightNames, match.participantA);
  const isMyB = isHighlightedName(highlightNames, match.participantB);

  function openReporting() {
    if (match.completed) {
      if (match.tie) {
        setSelectedWinner("tie");
      } else if (match.winner) {
        setSelectedWinner(match.winner === match.participantA ? "a" : "b");
      }
      setScoreA(match.scoreA != null ? String(match.scoreA) : "0");
      setScoreB(match.scoreB != null ? String(match.scoreB) : "0");
    }
    setReporting(true);
  }

  return (
    <>
      {/* ── Normal card ──────────────────────────────────────────────── */}
      <div
        className={`border rounded-lg overflow-hidden text-sm bg-white ${
          canReport
            ? "border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors"
            : "border-gray-200"
        }`}
        onClick={canReport ? openReporting : undefined}
        title={canReport ? (match.completed ? "Click to update result" : "Click to report result") : undefined}
      >
        {/* Side A */}
        <div
          draggable={!!match.participantA && canDrag}
          onDragStart={(e) => match.participantA && handleDragStart(e, match.participantA)}
          onDragOver={(e) => match.participantA && handleDragOver(e, "a")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, match.participantA)}
          className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 transition-colors ${
            isWinnerA
              ? "bg-emerald-50"
              : isMyA
                ? "bg-violet-50"
                : dropTarget === "a"
                  ? "bg-indigo-50"
                  : wbA
                    ? "bg-amber-50/60"
                    : "bg-gray-50"
          } ${match.participantA && canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${!match.participantA || match.participantA === "TBD" ? "print-tbd-row" : ""}`}
        >
          {wbA && <span className="text-[9px] text-amber-500 font-semibold shrink-0" title="From Winners Bracket">WB</span>}
          {isWinnerA && !isFinal && <span className="text-[9px] text-emerald-600 font-bold shrink-0">W</span>}
          {isWinnerA && isFinal && <span className="text-sm shrink-0">👑</span>}
          {isTie && <span className="text-[9px] text-gray-400 font-bold shrink-0">TIE</span>}
          {isMyA && <span className="text-[9px] text-violet-500 font-bold shrink-0">★</span>}
          <span className={`flex-1 truncate ${isWinnerA ? "text-emerald-700 font-semibold" : isTie ? "text-gray-500" : isMyA ? "text-violet-700 font-semibold" : match.participantA && match.participantA !== "TBD" ? "text-gray-800" : "text-gray-300 italic"}`}>
            {renderName(match.participantA)}
          </span>
          {match.completed && match.scoreA != null && (
            <span className={`text-xs font-mono shrink-0 ${isWinnerA ? "text-emerald-700 font-bold" : "text-gray-400"}`}>
              {match.scoreA}
            </span>
          )}
        </div>

        {/* Side B */}
        <div
          draggable={!!match.participantB && canDrag}
          onDragStart={(e) => match.participantB && handleDragStart(e, match.participantB)}
          onDragOver={(e) => match.participantB && handleDragOver(e, "b")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, match.participantB)}
          className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
            isWinnerB
              ? "bg-emerald-50"
              : isMyB
                ? "bg-violet-50"
                : dropTarget === "b"
                  ? "bg-indigo-50"
                  : wbB
                    ? "bg-amber-50/60"
                    : ""
          } ${match.participantB && canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${!match.participantB || match.participantB === "TBD" ? "print-tbd-row" : ""}`}
        >
          {wbB && <span className="text-[9px] text-amber-500 font-semibold shrink-0" title="From Winners Bracket">WB</span>}
          {isWinnerB && !isFinal && <span className="text-[9px] text-emerald-600 font-bold shrink-0">W</span>}
          {isWinnerB && isFinal && <span className="text-sm shrink-0">👑</span>}
          {isTie && <span className="text-[9px] text-gray-400 font-bold shrink-0">TIE</span>}
          {isMyB && <span className="text-[9px] text-violet-500 font-bold shrink-0">★</span>}
          <span className={`flex-1 truncate ${isWinnerB ? "text-emerald-700 font-semibold" : isTie ? "text-gray-500" : isMyB ? "text-violet-700 font-semibold" : match.participantB && match.participantB !== "TBD" ? "text-gray-800" : "text-gray-300 italic"}`}>
            {renderName(match.participantB)}
          </span>
          {match.completed && match.scoreB != null && (
            <span className={`text-xs font-mono shrink-0 ${isWinnerB ? "text-emerald-700 font-bold" : "text-gray-400"}`}>
              {match.scoreB}
            </span>
          )}
        </div>
      </div>

      {/* ── Tied non-final hint ──────────────────────────────────────── */}
      {isTie && !isFinal && canReport && (
        <p className="text-[10px] text-center text-amber-600 mt-0.5">Tap to select who advances</p>
      )}

      {/* ── Reporting modal (fixed, above all overflow containers) ──── */}
      {reporting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleCancel}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-indigo-200 p-4 w-64"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-indigo-700 mb-3">
              {match.completed ? "Update result" : "Who won?"}
            </p>
            <div className="flex gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setSelectedWinner("a")}
                className={`flex-1 py-2.5 rounded text-sm font-medium transition-colors truncate ${
                  selectedWinner === "a"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-400"
                }`}
              >
                {match.participantA}
              </button>
              <button
                type="button"
                onClick={() => setSelectedWinner("b")}
                className={`flex-1 py-2.5 rounded text-sm font-medium transition-colors truncate ${
                  selectedWinner === "b"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-400"
                }`}
              >
                {match.participantB}
              </button>
            </div>
            {allowTies && (
              <button
                type="button"
                onClick={() => setSelectedWinner("tie")}
                className={`w-full py-1.5 rounded text-sm font-medium transition-colors mb-3 ${
                  selectedWinner === "tie"
                    ? "bg-gray-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200"
                }`}
              >
                {LABEL_TIE}
              </button>
            )}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={0}
                placeholder="—"
                value={scoreA}
                onChange={e => setScoreA(e.target.value)}
                className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <span className="flex-1 text-center text-[10px] text-gray-400">score (optional)</span>
              <input
                type="number"
                min={0}
                placeholder="—"
                value={scoreB}
                onChange={e => setScoreB(e.target.value)}
                className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            {submitError && <p className="text-[10px] text-red-500 mb-2">{submitError}</p>}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedWinner || submitting}
                className="flex-1 py-2 rounded text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {submitting ? "Saving…" : LABEL_CONFIRM}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="px-4 py-2 rounded text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors"
              >
                {LABEL_CANCEL}
              </button>
            </div>
            {tournamentId && (
              <Link
                href={`/matches/${match.id}?t=${tournamentId}`}
                className="block text-center text-[11px] text-indigo-500 hover:text-indigo-700 mt-3"
                onClick={handleCancel}
              >
                Open advanced view →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Round Robin (grid + matchup list) ────────────────────────────────────────

function RoundRobinView({
  rounds,
  isDouble,
  onReportResult,
  allowTies = true,
}: {
  rounds: BracketRound[];
  isDouble: boolean;
  onReportResult?: (matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) => Promise<void>;
  allowTies?: boolean;
}) {
  const highlightNames = useContext(HighlightContext);
  const participantSet = new Set<string>();
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.participantA) participantSet.add(match.participantA);
      if (match.participantB) participantSet.add(match.participantB);
    }
  }
  const participants = Array.from(participantSet);

  // Build points for standings (win=1, tie=0.5)
  const wins = new Map<string, number>();
  for (const p of participants) wins.set(p, 0);
  for (const round of rounds) {
    for (const match of round.matches) {
      if (!match.completed) continue;
      if (match.winner) {
        wins.set(match.winner, (wins.get(match.winner) ?? 0) + 1);
      } else if (match.tie) {
        if (match.participantA) wins.set(match.participantA, (wins.get(match.participantA) ?? 0) + 0.5);
        if (match.participantB) wins.set(match.participantB, (wins.get(match.participantB) ?? 0) + 0.5);
      }
    }
  }

  const allComplete = rounds.every(r => r.matches.every(m => m.completed));
  const anyComplete = rounds.some(r => r.matches.some(m => m.completed));

  // Build sorted standings with tied-rank detection
  const sortedByPoints = [...participants].sort((a, b) => (wins.get(b) ?? 0) - (wins.get(a) ?? 0));
  const standingRows: { name: string; pts: number; rank: number; isTied: boolean }[] = [];
  for (let i = 0; i < sortedByPoints.length; ) {
    const pts = wins.get(sortedByPoints[i]) ?? 0;
    let j = i;
    while (j < sortedByPoints.length && (wins.get(sortedByPoints[j]) ?? 0) === pts) j++;
    const isTied = j - i > 1;
    for (let k = i; k < j; k++) {
      standingRows.push({ name: sortedByPoints[k], pts, rank: i + 1, isTied });
    }
    i = j;
  }

  const matchups = new Map<string, number[]>();
  let totalGames = 0;
  for (const round of rounds) {
    for (const match of round.matches) {
      totalGames++;
      if (match.participantA && match.participantB) {
        const key = `${match.participantA}|${match.participantB}`;
        if (!matchups.has(key)) matchups.set(key, []);
        matchups.get(key)!.push(match.round);
      }
    }
  }

  function getRound(a: string, b: string): string {
    const key1 = `${a}|${b}`;
    const key2 = `${b}|${a}`;
    const r = matchups.get(key1) || matchups.get(key2);
    return r ? r.map((n) => `R${n}`).join(", ") : "";
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* Standings */}
      {anyComplete && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {allComplete ? "Final Standings" : "Current Standings"}
          </div>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden text-sm">
            {standingRows.map((row) => (
              <div
                key={row.name}
                className={`flex items-center gap-3 px-3 py-2 ${isHighlightedName(highlightNames, row.name) ? "bg-violet-50" : row.isTied ? "bg-amber-50" : "bg-white"}`}
              >
                <span className="text-xs font-mono text-gray-400 w-5 shrink-0">{row.rank}.</span>
                <span className={`flex-1 flex items-center gap-1 ${isHighlightedName(highlightNames, row.name) ? "font-semibold text-violet-700" : row.rank === 1 && !row.isTied ? "font-semibold text-gray-900" : row.isTied && row.rank === 1 ? "font-semibold text-amber-900" : "text-gray-700"}`}>
                  {isHighlightedName(highlightNames, row.name) && <span className="text-[9px] text-violet-500 font-bold">★</span>}
                  {row.name}
                </span>
                {row.isTied && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">tied</span>
                )}
                <span className={`text-xs font-bold tabular-nums ${row.isTied ? "text-amber-700" : "text-gray-600"}`}>
                  {row.pts} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-auto max-h-[400px] min-w-0">
        <div className="text-xs text-gray-500 mb-2 sticky top-0 bg-white z-10">
          {totalGames} total game{totalGames !== 1 ? "s" : ""}
          {isDouble ? " (home & away)" : ""}
        </div>
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-500 font-medium sticky left-0 top-5 z-20 bg-white">vs</th>
              {participants.map((p) => (
                <th key={p} className="p-2 text-center text-gray-700 font-medium min-w-[80px] sticky top-5 bg-white z-10">
                  {p}
                </th>
              ))}
              {wins.size > 0 && <th className="p-2 text-center text-gray-500 font-medium sticky top-5 bg-white z-10">Pts</th>}
            </tr>
          </thead>
          <tbody>
            {participants.map((rowP) => (
              <tr key={rowP}>
                <td className="p-2 text-gray-700 font-medium sticky left-0 bg-white z-10">{rowP}</td>
                {participants.map((colP) => (
                  <td
                    key={colP}
                    className={`p-2 text-center border border-gray-100 ${
                      rowP === colP ? "bg-gray-50 text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {rowP === colP ? "—" : getRound(rowP, colP)}
                  </td>
                ))}
                {wins.size > 0 && (
                  <td className="p-2 text-center border border-gray-100 font-semibold text-gray-700">
                    {wins.get(rowP) ?? 0}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Matchup list */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Matchups</div>
        <div className="max-h-80 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
            {rounds.map((round) => (
              <div key={round.name} className="mb-2">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-2 mb-1">{round.name}</div>
                <div className="space-y-1">
                  {round.matches.map((match) => (
                    <MatchRow key={match.id} match={match} onReportResult={onReportResult} allowTies={allowTies} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Swiss (round-by-round list) ──────────────────────────────────────────────

function SwissView({
  rounds,
  onReportResult,
  allowTies = true,
}: {
  rounds: BracketRound[];
  onReportResult?: (matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) => Promise<void>;
  allowTies?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((round, ri) => (
        <div key={ri}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{round.name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {round.matches.map((match) => (
              <MatchRow key={match.id} match={match} onReportResult={onReportResult} allowTies={allowTies} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared flat match row (round robin / swiss) ───────────────────────────────

function MatchRow({
  match,
  onReportResult,
  allowTies = true,
}: {
  match: BracketMatch;
  onReportResult?: (matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) => Promise<void>;
  allowTies?: boolean;
}) {
  const tournamentId = useContext(TournamentIdContext);
  const highlightNames = useContext(HighlightContext);
  const nameAnnotations = useContext(NameAnnotationContext);
  const [reporting, setReporting] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<"a" | "b" | "tie" | null>(null);
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canReport = !!onReportResult
    && !!match.participantA && match.participantA !== "TBD"
    && !!match.participantB && match.participantB !== "TBD";
  const isWinnerA = match.completed && !match.tie && match.winner === match.participantA;
  const isWinnerB = match.completed && !match.tie && match.winner === match.participantB;
  const isTie = match.completed && match.tie;
  const isMyA = isHighlightedName(highlightNames, match.participantA);
  const isMyB = isHighlightedName(highlightNames, match.participantB);

  function renderName(name: string | null | undefined) {
    if (!name || name === "TBD") return <span className="text-gray-300 italic print-hide-tbd">TBD</span>;
    return <>{resolveAnnotatedName(name, nameAnnotations)}</>;
  }

  async function handleSubmit() {
    if (!selectedWinner || !onReportResult) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sA = scoreA !== "" ? Number(scoreA) : undefined;
      const sB = scoreB !== "" ? Number(scoreB) : undefined;
      await onReportResult(match.id, selectedWinner, sA, sB);
      setReporting(false);
      setSelectedWinner(null);
      setScoreA("0");
      setScoreB("0");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  function openReporting() {
    if (match.completed) {
      if (match.tie) {
        setSelectedWinner("tie");
      } else if (match.winner) {
        setSelectedWinner(match.winner === match.participantA ? "a" : "b");
      }
      setScoreA(match.scoreA != null ? String(match.scoreA) : "0");
      setScoreB(match.scoreB != null ? String(match.scoreB) : "0");
    }
    setReporting(true);
  }

  function handleCancel() {
    setReporting(false);
    setSelectedWinner(null);
    setScoreA("0");
    setScoreB("0");
    setSubmitError(null);
  }

  return (
    <>
      <div
        onClick={canReport ? openReporting : undefined}
        className={`flex items-center border rounded-lg text-xs overflow-hidden ${
          canReport ? "border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors" : "border-gray-200"
        }`}
      >
        <span className={`flex-1 px-2.5 py-1.5 truncate ${isWinnerA || isTie ? "bg-emerald-50 text-emerald-700 font-semibold" : isMyA ? "bg-violet-50 text-violet-700 font-semibold" : "bg-gray-50 text-gray-800"} ${!match.participantA || match.participantA === "TBD" ? "print-tbd-row" : ""}`}>
          {isWinnerA && <span className="text-[9px] font-bold mr-1">W</span>}
          {isTie && <span className="text-[9px] font-bold mr-1 text-emerald-600">T</span>}
          {isMyA && !isWinnerA && !isTie && <span className="text-[9px] font-bold mr-1">★</span>}
          {renderName(match.participantA)}
          {match.completed && match.scoreA != null && <span className="ml-1 text-emerald-600">{match.scoreA}</span>}
        </span>
        <span className="px-2 text-gray-400">vs</span>
        <span className={`flex-1 px-2.5 py-1.5 truncate text-right ${isWinnerB || isTie ? "bg-emerald-50 text-emerald-700 font-semibold" : isMyB ? "bg-violet-50 text-violet-700 font-semibold" : "text-gray-800"} ${!match.participantB || match.participantB === "TBD" ? "print-tbd-row" : ""}`}>
          {isTie && <span className="text-[9px] font-bold ml-1 text-emerald-600">T</span>}
          {isMyB && !isWinnerB && !isTie && <span className="text-[9px] font-bold ml-1">★</span>}
          {renderName(match.participantB)}
          {match.completed && match.scoreB != null && <span className="ml-1 text-emerald-600">{match.scoreB}</span>}
          {isWinnerB && <span className="text-[9px] font-bold ml-1">W</span>}
        </span>
      </div>

      {isTie && canReport && (
        <p className="text-[10px] text-center text-amber-600 mt-0.5">Tap to select who advances</p>
      )}

      {reporting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleCancel}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-indigo-200 p-4 w-64"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-indigo-700 mb-3">
              {match.completed ? "Update result" : "Who won?"}
            </p>
            <div className="flex gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setSelectedWinner("a")}
                className={`flex-1 py-2.5 rounded text-sm font-medium truncate transition-colors ${selectedWinner === "a" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-400"}`}
              >
                {match.participantA}
              </button>
              <button
                type="button"
                onClick={() => setSelectedWinner("b")}
                className={`flex-1 py-2.5 rounded text-sm font-medium truncate transition-colors ${selectedWinner === "b" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-400"}`}
              >
                {match.participantB}
              </button>
            </div>
            {allowTies && (
              <button
                type="button"
                onClick={() => setSelectedWinner("tie")}
                className={`w-full py-1.5 rounded text-sm font-medium transition-colors mb-3 ${selectedWinner === "tie" ? "bg-gray-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200"}`}
              >
                {LABEL_TIE}
              </button>
            )}
            <div className="flex items-center gap-2 mb-3">
              <input type="number" min={0} placeholder="—" value={scoreA} onChange={e => setScoreA(e.target.value)} className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <span className="flex-1 text-center text-[10px] text-gray-400">score (optional)</span>
              <input type="number" min={0} placeholder="—" value={scoreB} onChange={e => setScoreB(e.target.value)} className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>
            {submitError && <p className="text-[10px] text-red-500 mb-2">{submitError}</p>}
            <div className="flex gap-1.5">
              <button type="button" onClick={handleSubmit} disabled={!selectedWinner || submitting} className="flex-1 py-1.5 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                {submitting ? "Saving…" : LABEL_CONFIRM}
              </button>
              <button type="button" onClick={handleCancel} disabled={submitting} className="px-3 py-1.5 rounded text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors">
                {LABEL_CANCEL}
              </button>
            </div>
            {tournamentId && (
              <Link
                href={`/matches/${match.id}?t=${tournamentId}`}
                className="block text-center text-[11px] text-indigo-500 hover:text-indigo-700 mt-3"
                onClick={handleCancel}
              >
                Open advanced view →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Combination (groups + knockout) ──────────────────────────────────────────

function CombinationView({
  bracket,
  onSwapParticipants,
  advancersPerGroup = 2,
  onAdvancersChange,
  autoAdvanceGroups = [],
  onAutoAdvanceGroupsChange,
  onMoveParticipant,
  onReportResult,
  allowTies = true,
}: {
  bracket: Bracket;
  onSwapParticipants?: (a: string, b: string) => void;
  advancersPerGroup?: number;
  onAdvancersChange?: (n: number) => void;
  autoAdvanceGroups?: string[][];
  onAutoAdvanceGroupsChange?: (groups: string[][]) => void;
  onMoveParticipant?: (name: string, fromGroupIndex: number, toGroupIndex: number) => void;
  onReportResult?: (matchId: string, winner: "a" | "b" | "tie", scoreA?: number, scoreB?: number) => Promise<void>;
  allowTies?: boolean;
}) {
  const [dragName, setDragName] = useState<string | null>(null);
  const [dragFromGroup, setDragFromGroup] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropGroupTarget, setDropGroupTarget] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, name: string, groupIndex: number) {
    setDragName(name);
    setDragFromGroup(groupIndex);
    e.dataTransfer.setData("text/group-participant", name);
    e.dataTransfer.setData("text/group-index", String(groupIndex));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOverParticipant(e: React.DragEvent, name: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (name !== dragName) {
      setDropTarget(name);
      setDropGroupTarget(null);
    }
  }

  function handleDragOverGroup(e: React.DragEvent, groupIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (groupIndex !== dragFromGroup) {
      setDropGroupTarget(groupIndex);
    }
  }

  function handleDragLeave() {
    setDropTarget(null);
    setDropGroupTarget(null);
  }

  function handleDropOnParticipant(e: React.DragEvent, targetName: string, targetGroupIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setDropGroupTarget(null);
    const sourceName = e.dataTransfer.getData("text/group-participant");
    const fromGroup = parseInt(e.dataTransfer.getData("text/group-index"), 10);
    if (!sourceName || isNaN(fromGroup) || sourceName === targetName) return;

    const isFromAuto = fromGroup >= regularGroups.length;
    const isToAuto = targetGroupIndex >= regularGroups.length;

    if (isFromAuto || isToAuto) {
      if (onMoveParticipant) {
        onMoveParticipant(sourceName, fromGroup, targetGroupIndex);
      }
    } else {
      if (onSwapParticipants) {
        onSwapParticipants(sourceName, targetName);
      }
    }
  }

  function handleDropOnGroup(e: React.DragEvent, targetGroupIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setDropGroupTarget(null);
    const sourceName = e.dataTransfer.getData("text/group-participant");
    const fromGroup = parseInt(e.dataTransfer.getData("text/group-index"), 10);
    if (sourceName && !isNaN(fromGroup) && fromGroup !== targetGroupIndex && onMoveParticipant) {
      onMoveParticipant(sourceName, fromGroup, targetGroupIndex);
    }
  }

  function handleDragEnd() {
    setDragName(null);
    setDragFromGroup(null);
    setDropTarget(null);
    setDropGroupTarget(null);
  }

  const regularGroups = bracket.groups?.filter(g => !g.autoAdvance) ?? [];
  const minGroupSize = regularGroups.reduce((min, g) => Math.min(min, g.participants.length), Infinity);
  const maxAdvancers = isFinite(minGroupSize) ? Math.max(1, minGroupSize - 1) : 1;

  return (
    <div className="flex flex-col gap-8">
      {bracket.groups && (
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-600">Group Stage</h3>
            {onAdvancersChange && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Advance per group:</label>
                <input
                  type="number"
                  min={1}
                  max={maxAdvancers}
                  value={advancersPerGroup}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(maxAdvancers, parseInt(e.target.value, 10) || 1));
                    onAdvancersChange(v);
                  }}
                  className="w-14 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            )}
            {onAutoAdvanceGroupsChange && (
              <button
                type="button"
                onClick={() => onAutoAdvanceGroupsChange([...autoAdvanceGroups, []])}
                className="text-xs px-2.5 py-1 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
              >
                + Auto-advance group
              </button>
            )}
            {onSwapParticipants && (
              <span className="text-[10px] text-gray-400 italic">Drag participants between groups</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bracket.groups.map((group, gi) => {
              const isAutoAdvance = !!group.autoAdvance;
              const isDropHere = dropGroupTarget === gi;
              return (
                <div
                  key={gi}
                  onDragOver={(e) => handleDragOverGroup(e, gi)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnGroup(e, gi)}
                  className={`rounded-lg p-4 transition-colors ${
                    isAutoAdvance
                      ? `border-2 border-dashed ${isDropHere ? "border-indigo-400 bg-indigo-50/50" : "border-gray-300 bg-gray-50/50"}`
                      : `border ${isDropHere ? "border-indigo-400 bg-indigo-50/30" : "border-gray-200"}`
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{group.name}</span>
                      {isAutoAdvance && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">
                          Auto-advance
                        </span>
                      )}
                    </div>
                    {isAutoAdvance && onAutoAdvanceGroupsChange && (
                      <button
                        type="button"
                        onClick={() => {
                          const autoIdx = gi - regularGroups.length;
                          onAutoAdvanceGroupsChange(autoAdvanceGroups.filter((_, i) => i !== autoIdx));
                        }}
                        className="text-gray-300 hover:text-red-500 text-sm leading-none"
                        title="Remove auto-advance group"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
                    {group.participants.length === 0 && (
                      <span className="text-xs text-gray-300 italic">Drop participants here</span>
                    )}
                    {group.participants.map((p, pi) => (
                      <span
                        key={pi}
                        draggable={!!onSwapParticipants || !!onMoveParticipant}
                        onDragStart={(e) => handleDragStart(e, p, gi)}
                        onDragOver={(e) => handleDragOverParticipant(e, p)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnParticipant(e, p, gi)}
                        onDragEnd={handleDragEnd}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                          dropTarget === p
                            ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400"
                            : dragName === p
                              ? "bg-indigo-50 text-indigo-600 opacity-60"
                              : isAutoAdvance
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-700"
                        } ${onSwapParticipants || onMoveParticipant ? "cursor-grab active:cursor-grabbing select-none" : ""}`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {!isAutoAdvance && group.rounds.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-gray-500">
                        {group.rounds.length} round{group.rounds.length !== 1 ? "s" : ""},{" "}
                        {group.rounds.reduce((sum, r) => sum + r.matches.length, 0)} matches
                        {` · top ${advancersPerGroup} advance`}
                      </div>
                      {onReportResult && (
                        <div className="mt-2 space-y-1">
                          {group.rounds.map((round) =>
                            round.matches.map((match) => (
                              <MatchRow key={match.id} match={match} onReportResult={onReportResult} allowTies={allowTies} />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {isAutoAdvance && group.participants.length > 0 && (
                    <div className="text-xs text-emerald-500">
                      All {group.participants.length} advance directly to knockout
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {bracket.knockoutRounds && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Knockout Stage</h3>
          <EliminationBracket rounds={bracket.knockoutRounds} onReportResult={onReportResult} allowTies={allowTies} />
        </div>
      )}
    </div>
  );
}
