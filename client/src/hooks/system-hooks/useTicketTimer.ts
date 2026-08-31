/**
 * useTicketTimer — lightweight localStorage-backed timer hook.
 *
 * Each ticket gets a record keyed by its internal numeric ID:
 *   localStorage["ticket_timer_<id>"] = {
 *     startedAt: ISO,
 *     completedAt: ISO | null,
 *     ticketType: TicketType,
 *   }
 *
 * Ticket types are inferred from the external reference ID prefix:
 *   INC*     → 'INCIDENT'   — completion label: "Resolved"
 *   SCTASK*  → 'TASK'       — completion label: "Closed"
 *   RITM*    → 'REQUEST'    — completion label: "Done"
 *   (other)  → 'GENERAL'    — completion label: "Done"
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Ticket type helpers
// ---------------------------------------------------------------------------

export type TicketType = 'INCIDENT' | 'TASK' | 'REQUEST' | 'GENERAL';

/**
 * Infer the ticket type from an external reference ID string.
 * Case-insensitive prefix matching.
 */
export function inferTicketType(externalId: string): TicketType {
  const upper = externalId.trim().toUpperCase();
  if (upper.startsWith('INC')) return 'INCIDENT';
  if (upper.startsWith('SCTASK')) return 'TASK';
  if (upper.startsWith('RITM')) return 'REQUEST';
  return 'GENERAL';
}

/** Human-readable type label shown in badges / tabs. */
export function ticketTypeLabel(type: TicketType): string {
  switch (type) {
    case 'INCIDENT': return 'Incident';
    case 'TASK':     return 'Task';
    case 'REQUEST':  return 'Request';
    default:         return 'General';
  }
}

/**
 * The label for the "mark as done" action depends on ticket type:
 *  INCIDENT → "Resolve"   (terminal state: Resolved)
 *  TASK     → "Close"     (terminal state: Closed)
 *  others   → "Mark Done"
 */
export function doneActionLabel(type: TicketType): string {
  switch (type) {
    case 'INCIDENT': return 'Resolve';
    case 'TASK':     return 'Close';
    default:         return 'Mark Done';
  }
}

/** Past-tense completion label for display after the ticket is done. */
export function doneStateLabel(type: TicketType): string {
  switch (type) {
    case 'INCIDENT': return 'Resolved';
    case 'TASK':     return 'Closed';
    default:         return 'Done';
  }
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export interface TimerRecord {
  startedAt: string;         // ISO
  completedAt: string | null;
  ticketType: TicketType;
  externalId: string;        // raw reference e.g. "INC1278513"
}

function storageKey(ticketId: number): string {
  return `ticket_timer_${ticketId}`;
}

function readRecord(ticketId: number): TimerRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(ticketId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimerRecord>;
    // Backwards-compat: records created before ticketType was added
    return {
      startedAt: parsed.startedAt ?? new Date().toISOString(),
      completedAt: parsed.completedAt ?? null,
      ticketType: parsed.ticketType ?? 'GENERAL',
      externalId: parsed.externalId ?? '',
    };
  } catch {
    return null;
  }
}

function writeRecord(ticketId: number, record: TimerRecord): void {
  localStorage.setItem(storageKey(ticketId), JSON.stringify(record));
}

function removeRecord(ticketId: number): void {
  localStorage.removeItem(storageKey(ticketId));
}

// ---------------------------------------------------------------------------
// Timer history helpers
// Completed records are archived here on reopen so data is never lost.
// ---------------------------------------------------------------------------

function historyKey(ticketId: number): string {
  return `ticket_timer_history_${ticketId}`;
}

/**
 * Push a completed record into the persistent history array for this ticket,
 * then delete the live record so the timer can restart fresh.
 * If the record is not yet completed, it is archived as-is (captures partial time).
 */
function archiveRecord(ticketId: number): void {
  try {
    const current = readRecord(ticketId);
    if (!current) return; // nothing to archive

    const raw = localStorage.getItem(historyKey(ticketId));
    const history: TimerRecord[] = raw ? (JSON.parse(raw) as TimerRecord[]) : [];
    history.push(current);
    localStorage.setItem(historyKey(ticketId), JSON.stringify(history));
  } catch {
    // ignore storage errors
  }
  removeRecord(ticketId);
}

/**
 * Read the full history array for a ticket.
 * Returns an empty array when no history exists.
 */
export function readTimerHistory(ticketId: number): TimerRecord[] {
  try {
    const raw = localStorage.getItem(historyKey(ticketId));
    if (!raw) return [];
    return JSON.parse(raw) as TimerRecord[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Duration formatter
// ---------------------------------------------------------------------------

/** Format a duration in seconds to "Xh Ym Zs" (omits zero leading parts). */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseTicketTimer {
  elapsed: number;              // seconds
  completedAt: string | null;
  startedAt: string | null;
  ticketType: TicketType;
  externalId: string;
  isRunning: boolean;
  start: (externalId?: string) => void;
  complete: () => void;
  reset: () => void;
  /** Archives the current timer record to history, then clears it so the timer can restart. */
  archiveAndReset: () => void;
  formatElapsed: () => string;
}

export function useTicketTimer(ticketId: number): UseTicketTimer {
  const [record, setRecord] = useState<TimerRecord | null>(() => readRecord(ticketId));
  const [now, setNow] = useState<number>(() => Date.now());

  // Re-read from storage when ticketId changes (e.g. navigating between tickets)
  useEffect(() => {
    setRecord(readRecord(ticketId));
  }, [ticketId]);

  // Tick every second while running
  const isRunning = record !== null && record.completedAt === null;

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  // Derived elapsed seconds
  const elapsed: number = (() => {
    if (!record) return 0;
    const end = record.completedAt ? new Date(record.completedAt).getTime() : now;
    return Math.floor((end - new Date(record.startedAt).getTime()) / 1000);
  })();

  const start = useCallback((externalId = ''): void => {
    if (record !== null) return; // already started
    const type = inferTicketType(externalId);
    const newRecord: TimerRecord = {
      startedAt: new Date().toISOString(),
      completedAt: null,
      ticketType: type,
      externalId,
    };
    writeRecord(ticketId, newRecord);
    setRecord(newRecord);
    setNow(Date.now());
  }, [ticketId, record]);

  const complete = useCallback((): void => {
    if (!record || record.completedAt !== null) return;
    const updated: TimerRecord = { ...record, completedAt: new Date().toISOString() };
    writeRecord(ticketId, updated);
    setRecord(updated);
  }, [ticketId, record]);

  const reset = useCallback((): void => {
    removeRecord(ticketId);
    setRecord(null);
    setNow(Date.now());
  }, [ticketId]);

  /**
   * Saves the current timer record into the history array for this ticket,
   * then clears the live record so the timer can restart from zero.
   * Use this on reopen so previous session data is never lost.
   */
  const archiveAndReset = useCallback((): void => {
    archiveRecord(ticketId);
    setRecord(null);
    setNow(Date.now());
  }, [ticketId]);

  const formatElapsed = useCallback((): string => formatDuration(elapsed), [elapsed]);

  return {
    elapsed,
    completedAt: record?.completedAt ?? null,
    startedAt: record?.startedAt ?? null,
    ticketType: record?.ticketType ?? 'GENERAL',
    externalId: record?.externalId ?? '',
    isRunning,
    start,
    complete,
    reset,
    archiveAndReset,
    formatElapsed,
  };
}
