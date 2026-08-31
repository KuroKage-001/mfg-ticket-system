/**
 * CreateTicketPage — standalone full-page ticket creation form.
 *
 * Changes from previous version:
 *  - External Ticket ID is now REQUIRED
 *  - Date is auto-filled (today, read-only) and appended to the description
 *  - Priority is derived from an Impact × Urgency matrix (ITIL standard)
 *    instead of a single free dropdown
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/system-hooks/useAuth';
import { createTicket } from '../../services/client-api-services/ticket.service';
import { listUsers } from '../../services/admin-api-services/user.service';
import type { ApiError } from '../../config/api.config';
import type { SafeUser } from '../../services/system-api-services/auth.service';
import {
  useTicketTimer,
  inferTicketType,
  ticketTypeLabel,
  type TicketType,
} from '../../hooks/system-hooks/useTicketTimer';
import {
  IMPACT_OPTIONS,
  URGENCY_OPTIONS,
  PRIORITY_MATRIX,
  PRIORITY_BADGE_CLASS,
  computePriority,
  priorityResultToApiValue,
  type ImpactLevel,
  type UrgencyLevel,
  type PriorityResult,
} from '../../config/priority.config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Access Request',
  'Account Issue',
  'Other',
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

interface FieldErrors {
  externalTicketId?: string;
  title?: string;
  description?: string;
  category?: string;
  impact?: string;
  urgency?: string;
  assignedToId?: string;
}

const TYPE_BADGE: Record<TicketType, string> = {
  INCIDENT: 'bg-red-100 text-red-700 ring-red-200',
  TASK:     'bg-blue-100 text-blue-700 ring-blue-200',
  REQUEST:  'bg-purple-100 text-purple-700 ring-purple-200',
  GENERAL:  'bg-gray-100 text-gray-600 ring-gray-200',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Timer starter — mounts briefly after creation to kick off the timer.
// ---------------------------------------------------------------------------

interface TimerStarterProps {
  ticketId: number;
  externalId: string;
  onDone: (ticketId: number) => void;
}

function TimerStarter({ ticketId, externalId, onDone }: TimerStarterProps): null {
  const { start } = useTicketTimer(ticketId);
  useEffect(() => {
    start(externalId);
    onDone(ticketId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// Priority Matrix Visual — 3×3 grid showing all combinations
// ---------------------------------------------------------------------------

interface PriorityMatrixProps {
  impact: ImpactLevel | '';
  urgency: UrgencyLevel | '';
}

function PriorityMatrixGrid({ impact, urgency }: PriorityMatrixProps): React.ReactElement {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left font-medium text-gray-500 w-28">
              Impact \ Urgency
            </th>
            {URGENCY_OPTIONS.map((u) => (
              <th
                key={u}
                className={`border border-gray-200 px-2 py-1.5 text-center font-medium ${
                  urgency === u ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'
                }`}
              >
                {u}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {IMPACT_OPTIONS.map((imp) => (
            <tr key={imp}>
              <td
                className={`border border-gray-200 px-2 py-1.5 font-medium ${
                  impact === imp ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'
                }`}
              >
                {imp}
              </td>
              {URGENCY_OPTIONS.map((urg) => {
                const result: PriorityResult = PRIORITY_MATRIX[imp][urg];
                const isActive = impact === imp && urgency === urg;
                const badgeClass = PRIORITY_BADGE_CLASS[result];
                return (
                  <td
                    key={urg}
                    className={`border border-gray-200 px-2 py-1.5 text-center ${
                      isActive ? 'ring-2 ring-inset ring-gray-800' : ''
                    }`}
                  >
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
                      {result}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateTicketPage
// ---------------------------------------------------------------------------

function CreateTicketPage(): React.ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Auto date
  const [ticketDate] = useState<string>(todayISO());

  // Form fields
  const [externalTicketId, setExternalTicketId] = useState<string>('');
  const [detectedType, setDetectedType] = useState<TicketType>('GENERAL');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<Category | ''>('');
  const [impact, setImpact] = useState<ImpactLevel | ''>('');
  const [urgency, setUrgency] = useState<UrgencyLevel | ''>('');
  const [assignedToId, setAssignedToId] = useState<string>('');

  // Computed priority
  const computedPriority = computePriority(impact, urgency);

  // Admin employee list
  const [employees, setEmployees] = useState<SafeUser[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);

  // Submit / timer state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [genericError, setGenericError] = useState<string>('');
  const [pendingTimer, setPendingTimer] = useState<{ ticketId: number; externalId: string } | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setIsLoadingEmployees(true);
    listUsers({ role: 'EMPLOYEE', isActive: true, limit: 100 })
      .then((r) => { if (!cancelled) setEmployees(r.data); })
      .catch(() => { if (!cancelled) setEmployees([]); })
      .finally(() => { if (!cancelled) setIsLoadingEmployees(false); });
    return () => { cancelled = true; };
  }, [isAdmin]);

  const handleExternalIdChange = (value: string): void => {
    setExternalTicketId(value);
    setDetectedType(inferTicketType(value));
  };

  const clearErrors = (): void => { setFieldErrors({}); setGenericError(''); };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    clearErrors();

    const errors: FieldErrors = {};
    if (!externalTicketId.trim()) errors.externalTicketId = 'External Ticket ID is required.';
    if (!title.trim())            errors.title = 'Title is required.';
    if (!category)                errors.category = 'Category is required.';
    if (impact && !urgency)       errors.urgency = 'Urgency is required when Impact is set.';
    if (!impact && urgency)       errors.impact = 'Impact is required when Urgency is set.';

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    const priority = computedPriority ? priorityResultToApiValue(computedPriority) : undefined;
    const extId = externalTicketId.trim();

    setIsSubmitting(true);
    try {
      const resolvedTitle = `[${extId}] ${title.trim()}`;
      const resolvedDescription =
        `${description.trim()}\n\n---\nExternal Reference: ${extId}\nDate: ${formatDisplayDate(ticketDate)}\nImpact: ${impact}  |  Urgency: ${urgency}  |  Priority: ${computedPriority}`;

      const dto = {
        title: resolvedTitle,
        description: resolvedDescription,
        category,
        ...(priority !== undefined ? { priority } : {}),
        ...(isAdmin && assignedToId !== '' ? { assignedToId: Number(assignedToId) } : {}),
      } as Parameters<typeof createTicket>[0] & { assignedToId?: number };

      const ticket = await createTicket(dto);
      setPendingTimer({ ticketId: ticket.id, externalId: extId });
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.field) {
        const knownFields: Array<keyof FieldErrors> = [
          'externalTicketId', 'title', 'description', 'category', 'impact', 'urgency', 'assignedToId',
        ];
        if (knownFields.includes(apiErr.field as keyof FieldErrors)) {
          setFieldErrors({ [apiErr.field]: apiErr.message });
        } else {
          setGenericError(apiErr.message ?? 'An error occurred. Please try again.');
        }
      } else {
        setGenericError(
          typeof apiErr.message === 'string' && apiErr.message.length > 0
            ? apiErr.message : 'An unexpected error occurred. Please try again.',
        );
      }
      setIsSubmitting(false);
    }
  };

  const handleTimerStarted = (ticketId: number): void => {
    setPendingTimer(null);
    navigate(`/tickets/${ticketId}`);
  };

  // ---------------------------------------------------------------------------
  // Style helpers
  // ---------------------------------------------------------------------------

  const inputBase =
    'w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed';
  const inputError  = 'border-red-400 focus:ring-red-400';
  const inputNormal = 'border-gray-300';

  const typeLabel  = ticketTypeLabel(detectedType);
  const badgeClass = TYPE_BADGE[detectedType];

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {pendingTimer !== null && (
        <TimerStarter
          ticketId={pendingTimer.ticketId}
          externalId={pendingTimer.externalId}
          onDone={handleTimerStarted}
        />
      )}

      {/* Page heading */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Create Ticket</h1>
          <p className="mt-1 text-sm text-gray-500">
            A timer starts automatically when the ticket is created.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 pt-1 shrink-0">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${badgeClass}`}>
            {typeLabel}
          </span>
        </div>
      </div>

      {genericError && (
        <div role="alert" className="mb-5 rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
          {genericError}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>

          {/* ── Date (auto, read-only) — hidden ──────────────────────── */}

          {/* ── External Ticket ID (required) ──────────────────────────── */}
          <div className="mb-4">
            <label htmlFor="ext-ticket-id" className="block text-sm font-medium text-gray-700 mb-1">
              External Ticket ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="ext-ticket-id"
                ref={firstInputRef}
                type="text"
                value={externalTicketId}
                onChange={(e) => { handleExternalIdChange(e.target.value); }}
                disabled={isSubmitting}
                maxLength={100}
                placeholder="INC1278513 · SCTASK0807936 · RITM0831744"
                aria-describedby={fieldErrors.externalTicketId ? 'ext-id-error' : 'ext-id-hint'}
                aria-invalid={fieldErrors.externalTicketId ? 'true' : 'false'}
                className={`${inputBase} font-mono pr-28 ${fieldErrors.externalTicketId ? inputError : inputNormal}`}
              />
              {externalTicketId.trim() && (
                <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
                  {typeLabel}
                </span>
              )}
            </div>
            {fieldErrors.externalTicketId ? (
              <p id="ext-id-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.externalTicketId}</p>
            ) : null}
          </div>

          {/* ── Title ──────────────────────────────────────────────────── */}
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); }}
              disabled={isSubmitting}
              maxLength={200}
              placeholder="Brief summary of the issue"
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
              aria-invalid={fieldErrors.title ? 'true' : 'false'}
              className={`${inputBase} ${fieldErrors.title ? inputError : inputNormal}`}
            />
            {fieldErrors.title && (
              <p id="title-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
            )}
          </div>

          {/* ── Description ────────────────────────────────────────────── */}
          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              disabled={isSubmitting}
              maxLength={5000}
              rows={4}
              placeholder="Detailed description of the issue, steps to reproduce, or relevant context"
              aria-describedby={fieldErrors.description ? 'description-error' : undefined}
              aria-invalid={fieldErrors.description ? 'true' : 'false'}
              className={`${inputBase} resize-y ${fieldErrors.description ? inputError : inputNormal}`}
            />
            {fieldErrors.description && (
              <p id="description-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
            )}
          </div>

          {/* ── Category ───────────────────────────────────────────────── */}
          <div className="mb-4">
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => { setCategory(e.target.value as Category | ''); }}
              disabled={isSubmitting}
              aria-describedby={fieldErrors.category ? 'category-error' : undefined}
              aria-invalid={fieldErrors.category ? 'true' : 'false'}
              className={`${inputBase} ${fieldErrors.category ? inputError : inputNormal}`}
            >
              <option value="">Select a category…</option>
              {VALID_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {fieldErrors.category && (
              <p id="category-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.category}</p>
            )}
          </div>

          {/* ── Impact × Urgency → Priority ────────────────────────────── */}
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Priority
              <span className="ml-2 text-xs font-normal text-gray-400">Determined by Impact and Urgency</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              {/* Impact */}
              <div>
                <label htmlFor="impact" className="block text-xs font-medium text-gray-600 mb-1">
                  Impact
                </label>
                <select
                  id="impact"
                  value={impact}
                  onChange={(e) => { setImpact(e.target.value as ImpactLevel | ''); }}
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.impact ? 'impact-error' : undefined}
                  aria-invalid={fieldErrors.impact ? 'true' : 'false'}
                  className={`${inputBase} ${fieldErrors.impact ? inputError : inputNormal}`}
                >
                  <option value="">Select impact…</option>
                  {IMPACT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {fieldErrors.impact && (
                  <p id="impact-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.impact}</p>
                )}
              </div>

              {/* Urgency */}
              <div>
                <label htmlFor="urgency" className="block text-xs font-medium text-gray-600 mb-1">
                  Urgency
                </label>
                <select
                  id="urgency"
                  value={urgency}
                  onChange={(e) => { setUrgency(e.target.value as UrgencyLevel | ''); }}
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.urgency ? 'urgency-error' : undefined}
                  aria-invalid={fieldErrors.urgency ? 'true' : 'false'}
                  className={`${inputBase} ${fieldErrors.urgency ? inputError : inputNormal}`}
                >
                  <option value="">Select urgency…</option>
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {fieldErrors.urgency && (
                  <p id="urgency-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.urgency}</p>
                )}
              </div>
            </div>

            {/* Computed result */}
            <div className="flex items-center gap-2 min-h-8">
              <span className="text-xs font-medium text-gray-500">Computed Priority:</span>
              {computedPriority ? (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${PRIORITY_BADGE_CLASS[computedPriority]}`}>
                  {computedPriority}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">Select both Impact and Urgency above</span>
              )}
            </div>

            {/* Matrix reference grid */}
            <PriorityMatrixGrid impact={impact} urgency={urgency} />
          </div>

          {/* ── Assign To (admin only) ─────────────────────────────────── */}
          {isAdmin && (
            <div className="mb-4">
              <label htmlFor="assignedToId" className="block text-sm font-medium text-gray-700 mb-1">
                Assign To{' '}
                <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <select
                id="assignedToId"
                value={assignedToId}
                onChange={(e) => { setAssignedToId(e.target.value); }}
                disabled={isSubmitting || isLoadingEmployees}
                aria-invalid={fieldErrors.assignedToId ? 'true' : 'false'}
                className={`${inputBase} ${fieldErrors.assignedToId ? inputError : inputNormal}`}
              >
                <option value="">{isLoadingEmployees ? 'Loading employees…' : 'Unassigned'}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.email})</option>
                ))}
              </select>
              {fieldErrors.assignedToId && (
                <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.assignedToId}</p>
              )}
            </div>
          )}

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { navigate('/tickets'); }}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create {typeLabel} &amp; Start Timer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTicketPage;
