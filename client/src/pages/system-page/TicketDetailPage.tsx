/**
 * TicketDetailPage — full detail view for a single ticket.
 *
 * Fetches GET /api/tickets/:id on mount and renders:
 *  - Ticket header (number, title, status badge, priority badge, category)
 *  - Metadata (creator, assignee, dates)
 *  - Description block
 *  - Role-based action panel (ADMIN or EMPLOYEE)
 *  - Activity feed
 *  - Comments section (list + form)
 *
 * After any mutating action (assign, status change, priority change, comment),
 * the page re-fetches the full ticket detail so the activity feed and comment
 * list reflect the latest server state without a full page reload.
 *
 * Requirements: 4.3, 5.1, 6.1, 7.1, 9.1, 10.2
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/system-hooks/useAuth';
import { getTicketById, getTicketAttachments } from '../../services/system-api-services/ticket.service';
import type { TicketDetail, TicketAttachment } from '../../services/system-api-services/ticket.service';
import { BASE_URL } from '../../config/api.config';
import { transitionStatus, uploadAttachments } from '../../services/client-api-services/ticket.service';
import { listKBArticles } from '../../services/admin-api-services/kb.service';
import type { KBArticle } from '../../services/admin-api-services/kb.service';
import { useTicketTimer } from '../../hooks/system-hooks/useTicketTimer';
import TicketStatusBadge from '../../components/system-components/TicketStatusBadge';
import TicketPriorityBadge from '../../components/system-components/TicketPriorityBadge';
import ActivityFeed from '../../components/system-components/ActivityFeed';
import type { TicketActivityWithActor } from '../../components/system-components/ActivityFeed';
import CommentList from '../../components/system-components/CommentList';
import type { TicketCommentWithAuthor } from '../../components/system-components/CommentList';
import CommentForm from '../../components/system-components/CommentForm';
import StatusTransitionButtons from '../../components/admin-components/StatusTransitionButtons';
import AssignTicketModal from '../../components/admin-components/AssignTicketModal';
import PrioritySelector from '../../components/admin-components/PrioritySelector';
import TicketTimer from '../../components/system-components/TicketTimer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ContactMethod = 'EMAIL' | 'PHONE' | 'TEAMS';

const CONTACT_METHOD_CONFIG: Record<
  ContactMethod,
  { label: string; icon: React.ReactElement; className: string }
> = {
  EMAIL: {
    label: 'Email',
    className: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  PHONE: {
    label: 'Phone',
    className: 'bg-green-50 text-green-700 ring-green-200',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  TEAMS: {
    label: 'Teams',
    className: 'bg-purple-50 text-purple-700 ring-purple-200',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
  },
};

function ContactMethodBadge({ method }: { method: string }): React.ReactElement {
  const config = CONTACT_METHOD_CONFIG[method as ContactMethod];
  if (!config) {
    return <span className="text-sm text-gray-700">{method}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

/**
 * Format an ISO date string into a human-readable local date-time.
 * Returns null if the input is null.
 */
function formatDate(iso: string | null): string | null {
  if (iso === null) return null;
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Back link skeleton */}
      <div className="mb-6 h-4 w-28 rounded bg-gray-200" />

      {/* Header skeleton */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 h-4 w-24 rounded bg-gray-200" />
        <div className="mb-4 h-7 w-3/4 rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded-full bg-gray-200" />
          <div className="h-5 w-16 rounded-full bg-gray-200" />
          <div className="h-5 w-24 rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Metadata skeleton */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-1/2 rounded bg-gray-200" />
        ))}
      </div>

      {/* Description skeleton */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-2">
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-4 w-4/6 rounded bg-gray-200" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TicketDetailPage
// ---------------------------------------------------------------------------

/**
 * TicketDetailPage component — mounts at `/tickets/:id`.
 */
function TicketDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [comments, setComments] = useState<TicketCommentWithAuthor[]>([]);
  const [activities, setActivities] = useState<TicketActivityWithActor[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isReopening, setIsReopening] = useState<boolean>(false);
  const [reopenError, setReopenError] = useState<string>('');
  const [timerError, setTimerError] = useState<string>('');
  const [kbArticle, setKbArticle] = useState<KBArticle | null>(null);

  // ------------------------------------------------------------------
  // Attachment upload state
  // ------------------------------------------------------------------
  const MAX_UPLOAD_FILES = 5;
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer hook — archives the timer on reopen so previous session data is preserved,
  // trigger an API status transition when the user clicks Resolve/Close
  const ticketIdNum = id ? Number(id) : 0;
  const { completedAt: timerCompletedAt, ticketType: timerTicketType, archiveAndReset: archiveAndResetTimer } = useTicketTimer(ticketIdNum);

  // ------------------------------------------------------------------
  // Upload handlers
  // ------------------------------------------------------------------

  const addUploadFiles = useCallback((incoming: FileList | File[]): void => {
    const filtered = Array.from(incoming).filter((f) => f.type.startsWith('image/'));
    setUploadFiles((prev) => {
      const remaining = MAX_UPLOAD_FILES - prev.length;
      const toAdd = filtered.slice(0, remaining).filter((f) => f.size <= MAX_UPLOAD_BYTES);
      if (toAdd.length === 0) return prev;
      toAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadPreviews((p) => [...p, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
      return [...prev, ...toAdd];
    });
  }, []);

  const removeUploadFile = (index: number): void => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDropZoneDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    addUploadFiles(e.dataTransfer.files);
  };

  const handleDropZoneDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDropZoneDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleUploadPaste = (e: React.ClipboardEvent): void => {
    const imageFiles: File[] = [];
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item !== undefined && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addUploadFiles(imageFiles);
    }
  };

  // ------------------------------------------------------------------
  // refetch — re-fetches the full ticket detail (including activities
  // and comments) without a full page reload.  Called after every
  // mutating action so the UI stays in sync with server state.
  // ------------------------------------------------------------------
  const refetch = useCallback(async (): Promise<void> => {
    if (!id) return;
    try {
      const [data, files] = await Promise.all([
        getTicketById(Number(id)),
        getTicketAttachments(Number(id)),
      ]);
      setTicket(data);
      setComments(data.comments as unknown as TicketCommentWithAuthor[]);
      setActivities(data.activities as unknown as TicketActivityWithActor[]);
      setAttachments(files);
    } catch {
      // Silently ignore refetch errors — the ticket is already displayed;
      // the mutation itself already succeeded.
    }
  }, [id]);

  const handleUploadSubmit = useCallback(async (): Promise<void> => {
    if (!ticket || uploadFiles.length === 0) return;
    setIsUploading(true);
    setUploadError('');
    setUploadSuccess(false);
    try {
      await uploadAttachments(ticket.id, uploadFiles);
      setUploadFiles([]);
      setUploadPreviews([]);
      setUploadSuccess(true);
      setTimeout(() => { setUploadSuccess(false); }, 3000);
      void refetch();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setUploadError(e.message ?? 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [ticket, uploadFiles, refetch]);

  /**
   * Called when the user clicks the Resolve / Close button on the TicketTimer.
   * Persists the status change to the API so the DB stays in sync with the
   * timer's local completion state.
   *
   * ADMINs:     TASK/RITM → CLOSED, everything else → RESOLVED
   * EMPLOYEEs:  always sends RESOLVED; server auto-upgrades SCTASK/RITM to CLOSED
   */
  const handleTimerComplete = useCallback(async (): Promise<void> => {
    if (!ticket) return;
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') return;
    setTimerError('');
    try {
      // Always send RESOLVED — server auto-upgrades SCTASK/RITM to CLOSED.
      await transitionStatus(ticket.id, 'RESOLVED');
      void refetch();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setTimerError(apiErr.message ?? 'Failed to update ticket status. Please use the Admin Actions panel.');
    }
  }, [ticket, user, timerTicketType, refetch]);

  /**
   * Called when the user clicks "Start Timer" on an OPEN ticket.
   * Transitions OPEN → IN_PROGRESS so the server status stays in sync with
   * the local timer starting.
   */
  const handleTimerStart = useCallback(async (): Promise<void> => {
    if (!ticket || ticket.status !== 'OPEN') return;
    setTimerError('');
    try {
      await transitionStatus(ticket.id, 'IN_PROGRESS');
      void refetch();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setTimerError(apiErr.message ?? 'Failed to update ticket status.');
    }
  }, [ticket, refetch]);

  // Fetch ticket on mount; clean up on unmount to prevent state updates after unmount
  useEffect(() => {
    let cancelled = false;

    const fetchTicket = async (): Promise<void> => {
      setIsLoading(true);
      setError('');
      try {
        const [data, files] = await Promise.all([
          getTicketById(Number(id)),
          getTicketAttachments(Number(id)),
        ]);
        if (!cancelled) {
          setTicket(data);
          setComments(data.comments as unknown as TicketCommentWithAuthor[]);
          setActivities(data.activities as unknown as TicketActivityWithActor[]);
          setAttachments(files);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const apiErr = err as { message?: string };
          setError(
            typeof apiErr.message === 'string' && apiErr.message.length > 0
              ? apiErr.message
              : 'Failed to load ticket.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchTicket();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fetch KB articles to find the one used, when ticket has usedKnowledgeBase=true
  useEffect(() => {
    if (!ticket?.usedKnowledgeBase) { setKbArticle(null); return; }
    // Extract KB article title from the description footer appended by CreateTicketModal:
    // "KB Article Used: <title>"
    const match = /KB Article Used:\s*(.+)/i.exec(ticket.description);
    const kbTitle = match?.[1]?.trim() ?? null;
    if (!kbTitle) { setKbArticle(null); return; }

    let cancelled = false;
    listKBArticles()
      .then((articles) => {
        if (cancelled) return;
        // Match by title (case-insensitive exact match)
        const found = articles.find(
          (a) => a.title.toLowerCase() === kbTitle.toLowerCase(),
        ) ?? articles.find(
          // Fallback: title is contained in the stored string (handles trailing whitespace)
          (a) => kbTitle.toLowerCase().includes(a.title.toLowerCase()),
        ) ?? null;
        setKbArticle(found);
      })
      .catch(() => { if (!cancelled) setKbArticle(null); });
    return () => { cancelled = true; };
  }, [ticket?.id, ticket?.usedKnowledgeBase, ticket?.description]);

  // ------------------------------------------------------------------
  // Handlers passed to action components
  // ------------------------------------------------------------------

  /**
   * Called by StatusTransitionButtons, AssignTicketModal, PrioritySelector,
   * and EmployeeStatusActions after a successful mutation.
   *
   * Re-fetches the full ticket so the activity feed, assignee, status, and
   * priority badges all reflect the latest server state.
   */
  const handleActionComplete = useCallback(
    (_updatedTicket: TicketDetail): void => {
      void refetch();
    },
    [refetch],
  );

  /**
   * Called by CommentForm after a new comment is successfully posted.
   *
   * Re-fetches the full ticket so both the CommentList and the ActivityFeed
   * (which records a COMMENT_ADDED activity) update simultaneously.
   */
  const handleCommentAdded = useCallback(
    (_comment: TicketCommentWithAuthor): void => {
      void refetch();
    },
    [refetch],
  );

  /**
   * Reopen — transitions ticket back to IN_PROGRESS, archives the current
   * localStorage timer record (so the first-session data is preserved for
   * reference) then clears it so the timer can restart fresh.
   */
  const handleReopen = useCallback(async (): Promise<void> => {
    if (!ticket) return;
    setIsReopening(true);
    setReopenError('');
    try {
      // Archive previous timer data before clearing — keeps history intact.
      // Do this BEFORE the API call so if the call fails the archive is still safe.
      archiveAndResetTimer();
      await transitionStatus(ticket.id, 'IN_PROGRESS', 'Ticket Reopened — new timer session started');
      void refetch();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setReopenError(apiErr.message ?? 'Failed to reopen ticket.');
    } finally {
      setIsReopening(false);
    }
  }, [ticket, archiveAndResetTimer, refetch]);

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700"
        >
          <p className="mb-1 font-semibold">Unable to load ticket</p>
          <p>{error}</p>
          <Link
            to="/tickets"
            className="mt-3 inline-block text-xs text-red-600 underline hover:text-red-800"
          >
            ← Back to Tickets
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Guard — should never be null here, but keeps TS happy
  // ------------------------------------------------------------------
  if (!ticket) {
    return <></>;
  }

  const isAdmin = user?.role === 'ADMIN';

  // Derive server origin from BASE_URL (e.g. "http://localhost:3000/api" → "http://localhost:3000")
  const serverOrigin = BASE_URL.replace(/\/api$/, '');

  const createdAtFormatted  = formatDate(ticket.createdAt);
  const closedAtFormatted   = formatDate(ticket.closedAt);

  // Timer data — used for resolved-date fallback and reopen visibility
  const timerIsCompleted = timerCompletedAt !== null;

  // Use DB resolvedAt first; fall back to timer's completedAt for tickets
  // that were resolved via the timer button before the API integration.
  const resolvedAtFormatted =
    ticket.resolvedAt !== null
      ? formatDate(ticket.resolvedAt)
      : timerIsCompleted
        ? formatDate(timerCompletedAt)
        : null;

  // Show Reopen when the DB status is terminal OR when the timer has been
  // marked complete (covers tickets resolved via the old timer-only path).
  const showReopen =
    ticket.status === 'RESOLVED' ||
    ticket.status === 'CLOSED'   ||
    ticket.status === 'CANCELLED' ||
    timerIsCompleted;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          to="/tickets"
          className="text-sm text-gray-500 hover:text-gray-800 hover:underline transition-colors"
        >
          ← Back to Tickets
        </Link>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Ticket header                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Ticket number */}
        <p className="mb-1 font-mono text-sm font-medium text-gray-500">
          {ticket.ticketNumber}
        </p>

        {/* Title */}
        <h1 className="mb-4 text-2xl font-bold text-gray-900 leading-snug">
          {ticket.title}
        </h1>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-300">
            {ticket.category}
          </span>
          {ticket.usedKnowledgeBase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              KB Used
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Metadata                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Details
        </h2>
        <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
          <div>
            <dt className="text-xs font-medium text-gray-500">Created by</dt>
            <dd className="mt-0.5 text-sm text-gray-800">{ticket.createdBy.fullName}</dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-gray-500">Assigned to</dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {ticket.assignedTo !== null ? ticket.assignedTo.fullName : 'Unassigned'}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-gray-500">Created</dt>
            <dd className="mt-0.5 text-sm text-gray-800">{createdAtFormatted}</dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-gray-500">Resolved</dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {resolvedAtFormatted !== null
                ? resolvedAtFormatted
                : <span className="text-gray-400">—</span>}
            </dd>
          </div>

          {closedAtFormatted !== null && (
            <div>
              <dt className="text-xs font-medium text-gray-500">Closed</dt>
              <dd className="mt-0.5 text-sm text-gray-800">{closedAtFormatted}</dd>
            </div>
          )}

          <div>
            <dt className="text-xs font-medium text-gray-500">Contact Method</dt>
            <dd className="mt-0.5">
              {ticket.contactMethod !== null && ticket.contactMethod !== undefined ? (
                <ContactMethodBadge method={ticket.contactMethod} />
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </dd>
          </div>

          {ticket.usedKnowledgeBase && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-gray-500">KB Article Used</dt>
              <dd className="mt-0.5">
                {kbArticle !== null ? (
                  <a
                    href={kbArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {kbArticle.title}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    KB Used
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {/* Local timer for this ticket */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Time Tracker</p>
          <TicketTimer
            ticketId={ticket.id}
            onComplete={() => { void handleTimerComplete(); }}
            {...(ticket.status === 'OPEN' ? {
              onStart: (_extId) => { void handleTimerStart(); },
              externalTicketId: ticket.title.match(/^\[([A-Z0-9]+)\]/i)?.[1] ?? '',
            } : {})}
          />
          {timerError && (
            <p className="mt-2 text-xs text-red-600" role="alert">{timerError}</p>
          )}
        </div>

        {/* Reopen — shown to ALL employees (not just assignee) when ticket is resolved/closed */}
        {!isAdmin && showReopen && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {reopenError && (
              <p className="mb-2 text-sm text-red-600" role="alert">{reopenError}</p>
            )}
            <button
              type="button"
              onClick={() => { void handleReopen(); }}
              disabled={isReopening}
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
            >
              {isReopening ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Reopening…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reopen Ticket
                </>
              )}
            </button>
            <p className="mt-1.5 text-xs text-gray-400">Reopening archives the current timer session and transitions the ticket back to In Progress.</p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Description + Attachments                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Remarks
          </h2>
        </div>

        {/* Description body */}
        <div className="px-6 py-5">
          {ticket.description ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700 font-normal">
              {ticket.description}
            </p>
          ) : (
            <p className="text-sm italic text-gray-400">No remarks provided.</p>
          )}
        </div>

        {/* Attachments — shown directly below the description text */}
        {attachments.length > 0 && (
          <div className="px-6 pb-6 pt-0">
            <div className="border-t border-gray-100 mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Attachments
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                  {attachments.length}
                </span>
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {attachments.map((att) => {
                const imgSrc = att.url.startsWith('http') ? att.url : `${serverOrigin}${att.url}`;
                return (
                  <a
                    key={att.id}
                    href={imgSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
                    title={att.originalName}
                  >
                    <img
                      src={imgSrc}
                      alt={att.originalName}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2">
                      <span className="text-white text-xs font-medium truncate leading-tight">
                        {att.originalName}
                      </span>
                      <span className="text-white/70 text-xs mt-0.5">
                        {att.sizeBytes < 1024 * 1024
                          ? `${Math.round(att.sizeBytes / 1024)} KB`
                          : `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                    </div>
                    {/* Open icon badge */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-white/90 shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Role-based action panel (Admin only)                                */}
      {/* ------------------------------------------------------------------ */}

      {/*
       * ADMIN: render AssignTicketModal, StatusTransitionButtons, and
       * PrioritySelector.  Each component calls handleActionComplete on
       * success, which triggers a full refetch.
       *
       * Per design: AssignTicketModal is suppressed for CLOSED/CANCELLED
       * tickets (the server enforces this too via 422, but hiding the button
       * improves UX).  StatusTransitionButtons renders an empty-state message
       * when there are no valid transitions, so it is always rendered for
       * ADMIN.  PrioritySelector is always available to ADMIN.
       *
       * Requirements: 5.1, 6.1, 7.1
       */}
      {isAdmin && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Admin Actions
          </h2>
          <div className="space-y-4">
            {/* Status transitions — always shown; renders "no transitions" message for terminal states */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">Status</p>
              <StatusTransitionButtons
                ticketId={ticket.id}
                currentStatus={ticket.status}
                onTransitioned={handleActionComplete}
              />
            </div>

            {/* Assignment — hidden for terminal ticket states (CLOSED / CANCELLED) */}
            {ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED' && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">Assignment</p>
                <AssignTicketModal
                  ticketId={ticket.id}
                  currentAssigneeId={ticket.assignedToId}
                  onAssigned={handleActionComplete}
                />
              </div>
            )}

            {/* Priority — always available to ADMIN */}
            <div>
              <PrioritySelector
                ticketId={ticket.id}
                currentPriority={ticket.priority}
                onUpdated={handleActionComplete}
              />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Activity feed                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Activity
        </h2>
        {/*
         * Activities are stored in local state and refreshed on every refetch.
         * They are ordered by createdAt ascending as returned by the API
         * (Req 10.2).
         */}
        <ActivityFeed activities={activities} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Comments + Image Upload (combined panel)                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm" onPaste={handleUploadPaste}>
        <div className="px-6 pt-6 pb-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
            Comments
          </h2>
          <CommentList comments={comments} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mx-6 mt-6" />

        {/* Combined comment + image input area */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-medium text-gray-500">Add a comment</p>
          <CommentForm ticketId={ticket.id} onCommentAdded={handleCommentAdded} />

          {/* Image attach row */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Attach images</p>

            {/* Drop zone */}
            <div
              onDrop={handleDropZoneDrop}
              onDragOver={handleDropZoneDragOver}
              onDragLeave={handleDropZoneDragLeave}
              onClick={() => { fileInputRef.current?.click(); }}
              role="button"
              tabIndex={0}
              aria-label="Upload images — click, drag & drop, or paste"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              className={[
                'flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors select-none',
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : uploadFiles.length > 0
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100',
              ].join(' ')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 shrink-0 ${isDragging ? 'text-blue-400' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${isDragging ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                  {isDragging ? 'Drop images here' : uploadFiles.length > 0 ? `${uploadFiles.length} image${uploadFiles.length !== 1 ? 's' : ''} staged` : 'Click, drag & drop, or paste images'}
                </p>
                <p className="text-xs text-gray-400">PNG, JPG, GIF, WEBP · max 5 MB each · up to {MAX_UPLOAD_FILES} files</p>
              </div>
              {uploadFiles.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleUploadSubmit(); }}
                  disabled={isUploading}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Uploading…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) { addUploadFiles(e.target.files); e.target.value = ''; }
              }}
            />

            {/* Staged previews */}
            {uploadPreviews.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {uploadPreviews.map((src, i) => (
                  <div key={i} className="relative group w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-200">
                    <img src={src} alt={uploadFiles[i]?.name ?? ''} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-end bg-black/0 group-hover:bg-black/20 transition-colors">
                      <span className="w-full truncate bg-black/50 text-white text-xs px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploadFiles[i]?.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeUploadFile(i); }}
                      className="absolute top-0.5 right-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      aria-label={`Remove ${uploadFiles[i]?.name ?? 'image'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Feedback */}
            {uploadError && <p className="mt-2 text-xs text-red-600" role="alert">{uploadError}</p>}
            {uploadSuccess && <p className="mt-2 text-xs text-emerald-600" role="status">Images uploaded successfully.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketDetailPage;
