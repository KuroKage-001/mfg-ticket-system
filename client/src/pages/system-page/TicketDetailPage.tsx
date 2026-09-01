/**
 * TicketDetailPage — full detail view for a single ticket.
 *
 * Layout: two-column on large screens.
 *  Left (main):  ticket header, metadata, remarks, admin actions, activity feed.
 *  Right (sidebar): sticky comments panel with list + form + image upload.
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

function formatDate(iso: string | null): string | null {
  if (iso === null) return null;
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="mb-6 h-4 w-28 rounded bg-gray-200" />
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-7 w-3/4 rounded bg-gray-200" />
            <div className="flex gap-2">
              <div className="h-5 w-20 rounded-full bg-gray-200" />
              <div className="h-5 w-16 rounded-full bg-gray-200" />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-1/2 rounded bg-gray-200" />
            ))}
          </div>
        </div>
        <div className="w-80 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-gray-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Activity Feed wrapper
// ---------------------------------------------------------------------------

const ACTIVITY_PREVIEW_COUNT = 3;

interface CollapsibleActivityFeedProps {
  activities: TicketActivityWithActor[];
}

function CollapsibleActivityFeed({ activities }: CollapsibleActivityFeedProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const hasMore = activities.length > ACTIVITY_PREVIEW_COUNT;
  // Show latest N when collapsed; show all when expanded
  const visible = expanded ? activities : activities.slice(-ACTIVITY_PREVIEW_COUNT);
  const hiddenCount = activities.length - ACTIVITY_PREVIEW_COUNT;

  return (
    <div>
      <ActivityFeed activities={visible} />

      {hasMore && (
        <button
          type="button"
          onClick={() => { setExpanded((p) => !p); }}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
        >
          {expanded ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              Collapse
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              Show {hiddenCount} more {hiddenCount === 1 ? 'entry' : 'entries'}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TicketDetailPage
// ---------------------------------------------------------------------------

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

  // Incrementing this key remounts TicketTimer so it re-reads localStorage
  // after a reopen (localStorage cleared) or a resolve (completedAt written).
  // Without this, the timer display doesn't update until a manual page reload.
  const [timerKey, setTimerKey] = useState<number>(0);

  // ------------------------------------------------------------------
  // Attachment upload state
  // ------------------------------------------------------------------
  const MAX_UPLOAD_FILES = 5;
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        reader.onload = (e) => { setUploadPreviews((p) => [...p, e.target?.result as string]); };
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

  const handleDropZoneDragLeave = (): void => { setIsDragging(false); };

  const handleUploadPaste = (e: React.ClipboardEvent): void => {
    const imageFiles: File[] = [];
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item !== undefined && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) { e.preventDefault(); addUploadFiles(imageFiles); }
  };

  // ------------------------------------------------------------------
  // refetch
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
      // silently ignore — mutation already succeeded
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

  // ------------------------------------------------------------------
  // Timer handlers
  // ------------------------------------------------------------------

  const handleTimerComplete = useCallback(async (): Promise<void> => {
    if (!ticket) return;
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') return;
    setTimerError('');
    try {
      await transitionStatus(ticket.id, 'RESOLVED');
      // Await the refetch so ticket state is fresh before remounting the timer.
      // The status badge, metadata, and showReopen all derive from ticket state,
      // so they update in the same render cycle as the timerKey bump.
      await refetch();
      setTimerKey((k) => k + 1);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setTimerError(apiErr.message ?? 'Failed to update ticket status. Please use the Admin Actions panel.');
    }
  }, [ticket, timerTicketType, refetch]);

  const handleTimerStart = useCallback(async (): Promise<void> => {
    if (!ticket) return;
    setTimerError('');
    try {
      if (ticket.status === 'OPEN') {
        await transitionStatus(ticket.id, 'IN_PROGRESS');
        // Await refetch so status badge updates before timer remounts
        await refetch();
      }
      // Bump timerKey so TicketTimer remounts with the cleared localStorage (after reopen)
      // or picks up the fresh IN_PROGRESS status from refetch
      setTimerKey((k) => k + 1);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setTimerError(apiErr.message ?? 'Failed to update ticket status.');
    }
  }, [ticket, refetch]);

  // ------------------------------------------------------------------
  // Initial fetch
  // ------------------------------------------------------------------
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
          setError(typeof apiErr.message === 'string' && apiErr.message.length > 0
            ? apiErr.message : 'Failed to load ticket.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchTicket();
    return () => { cancelled = true; };
  }, [id]);

  // Fetch KB article linked to this ticket
  useEffect(() => {
    if (!ticket?.usedKnowledgeBase) { setKbArticle(null); return; }
    const match = /KB Article Used:\s*(.+)/i.exec(ticket.description);
    const kbTitle = match?.[1]?.trim() ?? null;
    if (!kbTitle) { setKbArticle(null); return; }
    let cancelled = false;
    listKBArticles()
      .then((articles) => {
        if (cancelled) return;
        const found = articles.find((a) => a.title.toLowerCase() === kbTitle.toLowerCase())
          ?? articles.find((a) => kbTitle.toLowerCase().includes(a.title.toLowerCase()))
          ?? null;
        setKbArticle(found);
      })
      .catch(() => { if (!cancelled) setKbArticle(null); });
    return () => { cancelled = true; };
  }, [ticket?.id, ticket?.usedKnowledgeBase, ticket?.description]);

  // ------------------------------------------------------------------
  // Mutation callbacks
  // ------------------------------------------------------------------

  const handleActionComplete = useCallback((updatedTicket: TicketDetail): void => {
    // Apply the returned ticket immediately so status badge, metadata, and
    // canStartTimer / showReopen all update in this render cycle — no reload.
    setTicket(updatedTicket);
    setActivities(updatedTicket.activities as unknown as TicketActivityWithActor[]);
    setComments(updatedTicket.comments as unknown as TicketCommentWithAuthor[]);
    // Also bump timerKey so TicketTimer picks up any status-driven changes
    setTimerKey((k) => k + 1);
    // Background refetch for attachments and any other async updates
    void refetch();
  }, [refetch]);

  const handleCommentAdded = useCallback((_comment: TicketCommentWithAuthor): void => {
    void refetch();
  }, [refetch]);

  const handleReopen = useCallback(async (): Promise<void> => {
    if (!ticket) return;
    setIsReopening(true);
    setReopenError('');
    try {
      archiveAndResetTimer();
      await transitionStatus(ticket.id, 'IN_PROGRESS', 'Ticket Reopened — new timer session started');
      // Await refetch so ticket.status updates to IN_PROGRESS in state before
      // the timer remounts — this ensures canStartTimer is true and showReopen
      // is false in the same render, no page reload needed.
      await refetch();
      setTimerKey((k) => k + 1);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setReopenError(apiErr.message ?? 'Failed to reopen ticket.');
    } finally {
      setIsReopening(false);
    }
  }, [ticket, archiveAndResetTimer, refetch]);

  // ------------------------------------------------------------------
  // Loading / error states
  // ------------------------------------------------------------------
  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="mb-1 font-semibold">Unable to load ticket</p>
          <p>{error}</p>
          <Link to="/tickets" className="mt-3 inline-block text-xs text-red-600 underline hover:text-red-800">
            ← Back to Tickets
          </Link>
        </div>
      </div>
    );
  }

  if (!ticket) return <></>;

  const isAdmin = user?.role === 'ADMIN';
  const serverOrigin = BASE_URL.replace(/\/api$/, '');
  const createdAtFormatted = formatDate(ticket.createdAt);
  const closedAtFormatted  = formatDate(ticket.closedAt);
  const timerIsCompleted   = timerCompletedAt !== null;

  const resolvedAtFormatted =
    ticket.resolvedAt !== null
      ? formatDate(ticket.resolvedAt)
      : timerIsCompleted
        ? formatDate(timerCompletedAt)
        : null;

  const showReopen =
    ticket.status === 'RESOLVED' ||
    ticket.status === 'CLOSED' ||
    ticket.status === 'CANCELLED' ||
    timerIsCompleted;

  // Whether the timer Start button should be offered
  const canStartTimer = ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Back navigation */}
      <div className="mb-6">
        <Link to="/tickets" className="text-sm text-gray-500 hover:text-gray-800 hover:underline transition-colors">
          ← Back to Tickets
        </Link>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Two-column grid                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left / main column ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Ticket header */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-1 font-mono text-sm font-medium text-gray-500">{ticket.ticketNumber}</p>
            <h1 className="mb-4 text-2xl font-bold text-gray-900 leading-snug">{ticket.title}</h1>
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

          {/* Details */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Details</h2>
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
                  {resolvedAtFormatted !== null ? resolvedAtFormatted : <span className="text-gray-400">—</span>}
                </dd>
              </div>
              {ticket.resolvedBy !== null && ticket.resolvedBy !== undefined && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Resolved by</dt>
                  <dd className="mt-0.5 text-sm text-gray-800">{ticket.resolvedBy.fullName}</dd>
                </div>
              )}
              {closedAtFormatted !== null && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Closed</dt>
                  <dd className="mt-0.5 text-sm text-gray-800">{closedAtFormatted}</dd>
                </div>
              )}
              {ticket.closedBy !== null && ticket.closedBy !== undefined && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Closed by</dt>
                  <dd className="mt-0.5 text-sm text-gray-800">{ticket.closedBy.fullName}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-gray-500">Contact Method</dt>
                <dd className="mt-0.5">
                  {ticket.contactMethod !== null && ticket.contactMethod !== undefined
                    ? <ContactMethodBadge method={ticket.contactMethod} />
                    : <span className="text-sm text-gray-400">—</span>}
                </dd>
              </div>
              {ticket.usedKnowledgeBase && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-gray-500">KB Article Used</dt>
                  <dd className="mt-0.5">
                    {kbArticle !== null ? (
                      <a href={kbArticle.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 transition-colors">
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

            {/* Time Tracker */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Time Tracker</p>
              {/*
               * key={timerKey} forces a remount every time a reopen or resolve
               * happens so useTicketTimer re-reads localStorage immediately,
               * showing the correct Start / Elapsed / Completed state without
               * requiring a manual page reload.
               */}
              <TicketTimer
                key={timerKey}
                ticketId={ticket.id}
                onComplete={() => { void handleTimerComplete(); }}
                {...(canStartTimer ? {
                  onStart: (_extId) => { void handleTimerStart(); },
                  externalTicketId: ticket.title.match(/^\[?([A-Z0-9]+)\]?/i)?.[1] ?? '',
                } : {})}
              />
              {timerError && (
                <p className="mt-2 text-xs text-red-600" role="alert">{timerError}</p>
              )}
            </div>

            {/* Reopen — employees only */}
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

          {/* Remarks + Attachments */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Remarks</h2>
            </div>
            <div className="px-6 py-5">
              {ticket.description ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{ticket.description}</p>
              ) : (
                <p className="text-sm italic text-gray-400">No remarks provided.</p>
              )}
            </div>
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
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {attachments.map((att) => {
                    const imgSrc = att.url.startsWith('http') ? att.url : `${serverOrigin}${att.url}`;
                    return (
                      <a key={att.id} href={imgSrc} target="_blank" rel="noopener noreferrer"
                        className="group relative block aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
                        title={att.originalName}>
                        <img src={imgSrc} alt={att.originalName}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2">
                          <span className="text-white text-xs font-medium truncate leading-tight">{att.originalName}</span>
                          <span className="text-white/70 text-xs mt-0.5">
                            {att.sizeBytes < 1024 * 1024
                              ? `${Math.round(att.sizeBytes / 1024)} KB`
                              : `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                        </div>
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

          {/* Admin Actions */}
          {isAdmin && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Admin Actions</h2>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-500">Status</p>
                  <StatusTransitionButtons
                    ticketId={ticket.id}
                    currentStatus={ticket.status}
                    onTransitioned={handleActionComplete}
                  />
                </div>
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

          {/* Activity Feed */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Activity</h2>
              {activities.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {activities.length}
                </span>
              )}
            </div>
            <CollapsibleActivityFeed activities={activities} />
          </div>

        </div>{/* end left column */}

        {/* ── Right / sidebar column ── */}
        <div className="w-full lg:w-96 shrink-0 lg:sticky lg:top-6" onPaste={handleUploadPaste}>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Comments
                {comments.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 normal-case">
                    {comments.length}
                  </span>
                )}
              </h2>
            </div>

            {/* Comment list — scrollable */}
            <div className="px-5 py-4 overflow-y-auto max-h-112">
              <CommentList comments={comments} />
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Add comment + image upload */}
            <div className="px-5 py-4 space-y-4 bg-gray-50/40">
              <p className="text-xs font-medium text-gray-500">Add a comment</p>
              <CommentForm ticketId={ticket.id} onCommentAdded={handleCommentAdded} />

              {/* Image attach */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Attach images</p>
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
                    'flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2.5 cursor-pointer transition-colors select-none',
                    isDragging ? 'border-blue-400 bg-blue-50'
                      : uploadFiles.length > 0 ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 shrink-0 ${isDragging ? 'text-blue-400' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${isDragging ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      {isDragging ? 'Drop here'
                        : uploadFiles.length > 0 ? `${uploadFiles.length} image${uploadFiles.length !== 1 ? 's' : ''} staged`
                          : 'Click, drag & drop, or paste'}
                    </p>
                    <p className="text-xs text-gray-400">PNG · JPG · GIF · max 5 MB · up to {MAX_UPLOAD_FILES}</p>
                  </div>
                  {uploadFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleUploadSubmit(); }}
                      disabled={isUploading}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isUploading ? (
                        <>
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Uploading…
                        </>
                      ) : 'Upload'}
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) { addUploadFiles(e.target.files); e.target.value = ''; } }}
                />

                {uploadPreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uploadPreviews.map((src, i) => (
                      <div key={i} className="relative group w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-gray-200">
                        <img src={src} alt={uploadFiles[i]?.name ?? ''} className="w-full h-full object-cover" />
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

                {uploadError && <p className="mt-2 text-xs text-red-600" role="alert">{uploadError}</p>}
                {uploadSuccess && <p className="mt-2 text-xs text-emerald-600" role="status">Images uploaded successfully.</p>}
              </div>
            </div>

          </div>
        </div>{/* end right column */}

      </div>
    </div>
  );
}

export default TicketDetailPage;
