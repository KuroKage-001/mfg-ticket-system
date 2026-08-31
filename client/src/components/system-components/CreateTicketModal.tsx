/**
 * CreateTicketModal — floating modal for creating a new ticket.
 *
 * Changes:
 *  - External Ticket ID is now REQUIRED
 *  - Date is auto-filled (today, read-only) and stored in description
 *  - Priority is a single direct dropdown (URGENT / HIGH / MEDIUM / LOW)
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/system-hooks/useAuth';
import { createTicket, uploadAttachments } from '../../services/client-api-services/ticket.service';
import { listUsers } from '../../services/admin-api-services/user.service';
import { listKBArticles } from '../../services/admin-api-services/kb.service';
import type { KBArticle } from '../../services/admin-api-services/kb.service';
import type { ApiError } from '../../config/api.config';
import type { SafeUser } from '../../services/system-api-services/auth.service';
import type { TicketDetail } from '../../services/system-api-services/ticket.service';
import {
  inferTicketType,
  ticketTypeLabel,
  type TicketType,
} from '../../hooks/system-hooks/useTicketTimer';

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

type PriorityValue = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
type ContactMethodValue = 'EMAIL' | 'PHONE' | 'TEAMS';

const PRIORITY_OPTIONS: { value: PriorityValue; label: string; badgeClass: string }[] = [
  { value: 'URGENT', label: '1 - Critical (Urgent)',  badgeClass: 'bg-red-100 text-red-800 ring-red-300' },
  { value: 'HIGH',   label: '2 - High',               badgeClass: 'bg-orange-100 text-orange-800 ring-orange-300' },
  { value: 'MEDIUM', label: '3 - Moderate (Medium)',  badgeClass: 'bg-yellow-100 text-yellow-800 ring-yellow-300' },
  { value: 'LOW',    label: '4 - Low',                badgeClass: 'bg-green-100 text-green-800 ring-green-300' },
];

const CONTACT_METHOD_OPTIONS: {
  value: ContactMethodValue;
  label: string;
  icon: React.ReactElement;
}[] = [
  {
    value: 'EMAIL',
    label: 'Email',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'PHONE',
    label: 'Phone',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    value: 'TEAMS',
    label: 'Teams',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
  },
];

interface FieldErrors {
  externalTicketId?: string;
  description?: string;
  category?: string;
  priority?: string;
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
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CreateTicketModalProps {
  onClose: () => void;
  onCreated: (ticket: TicketDetail, externalId: string, autoStart: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CreateTicketModal({ onClose, onCreated }: CreateTicketModalProps): React.ReactElement {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Auto date
  const [ticketDate] = useState<string>(todayISO());

  // Form fields
  const [externalTicketId, setExternalTicketId] = useState<string>('');
  const [detectedType, setDetectedType] = useState<TicketType>('GENERAL');
  const [description, setDescription] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category | ''>('');
  const [priority, setPriority] = useState<PriorityValue | ''>('');
  const [contactMethod, setContactMethod] = useState<ContactMethodValue | null>(null);
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [usedKnowledgeBase, setUsedKnowledgeBase] = useState<boolean>(false);

  // Employee list (admin only) — includes current admin so "Assign to me" works
  const [employees, setEmployees] = useState<SafeUser[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);

  // KB articles — loaded when KB checkbox is ticked
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [isLoadingKb, setIsLoadingKb] = useState<boolean>(false);
  const [selectedKbId, setSelectedKbId] = useState<number | ''>('');

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [genericError, setGenericError] = useState<string>('');

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSubmitting, onClose]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setIsLoadingEmployees(true);
    listUsers({ role: 'EMPLOYEE', isActive: true, limit: 100 })
      .then((r) => {
        if (!cancelled) {
          // Ensure the current admin user appears in the list so "Assign to me" works
          const list = r.data;
          if (user && !list.find((e) => e.id === user.id)) {
            list.unshift({ id: user.id, fullName: user.fullName, email: '', role: 'ADMIN', isActive: true, employeeId: null, createdAt: '', updatedAt: '' } as SafeUser);
          }
          setEmployees(list);
        }
      })
      .catch(() => { if (!cancelled) setEmployees([]); })
      .finally(() => { if (!cancelled) setIsLoadingEmployees(false); });
    return () => { cancelled = true; };
  }, [isAdmin, user]);

  // Load KB articles when the KB checkbox is first ticked
  useEffect(() => {
    if (!usedKnowledgeBase || kbArticles.length > 0) return;
    let cancelled = false;
    setIsLoadingKb(true);
    listKBArticles()
      .then((data) => { if (!cancelled) setKbArticles(data); })
      .catch(() => { if (!cancelled) setKbArticles([]); })
      .finally(() => { if (!cancelled) setIsLoadingKb(false); });
    return () => { cancelled = true; };
  }, [usedKnowledgeBase, kbArticles.length]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const MAX_FILES = 5;

  const addFiles = (files: FileList | File[]): void => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const remaining = MAX_FILES - attachments.length;
    const toAdd = incoming.slice(0, remaining).filter((f) => f.size <= MAX_FILE_SIZE);
    if (toAdd.length === 0) return;
    setAttachments((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachmentPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number): void => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemarksDropZone = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const handleRemarksDropZoneDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item !== undefined && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  };

  const handleExternalIdChange = (value: string): void => {
    setExternalTicketId(value);
    setDetectedType(inferTicketType(value));
  };

  const clearErrors = (): void => { setFieldErrors({}); setGenericError(''); };

  // Selected priority option for badge display
  const selectedPriorityOption = PRIORITY_OPTIONS.find((o) => o.value === priority) ?? null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    clearErrors();

    const errors: FieldErrors = {};
    if (!externalTicketId.trim()) errors.externalTicketId = 'External Ticket ID is required.';
    if (!category)                errors.category  = 'Category is required.';
    if (!priority)                errors.priority  = 'Priority is required.';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    const extId = externalTicketId.trim();
    const priorityLabel = selectedPriorityOption?.label ?? priority;

    setIsSubmitting(true);
    try {
      const resolvedTitle = extId; // title is the external ticket ID itself
      const selectedKbTitle = selectedKbId !== ''
        ? kbArticles.find((k) => k.id === selectedKbId)?.title ?? ''
        : '';
      const resolvedDescription =
        `${description.trim()}\n\n---\nExternal Reference: ${extId}\nDate: ${formatDisplayDate(ticketDate)}\nPriority: ${priorityLabel}${selectedKbTitle ? `\nKB Article Used: ${selectedKbTitle}` : ''}`;

      const dto = {
        title: resolvedTitle,
        description: resolvedDescription.trim() || extId,
        category,
        priority: priority as string,
        ...(usedKnowledgeBase ? { usedKnowledgeBase: true } : {}),
        ...(contactMethod !== null ? { contactMethod } : {}),
        ...(assignedToId !== '' ? { assignedToId: Number(assignedToId) } : {}),
      } as Parameters<typeof createTicket>[0];

      const ticket = await createTicket(dto);

      // Upload attachments after ticket is created (non-fatal if they fail)
      if (attachments.length > 0) {
        try {
          await uploadAttachments(ticket.id, attachments);
        } catch {
          // Non-fatal — ticket created successfully
        }
      }

      onCreated(ticket, extId, assignedToId !== '');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.field) {
        const knownFields: Array<keyof FieldErrors> = [
          'externalTicketId', 'description', 'category', 'priority', 'assignedToId',
        ];
        if (knownFields.includes(apiErr.field as keyof FieldErrors)) {
          setFieldErrors({ [apiErr.field]: apiErr.message });
        } else {
          setGenericError(apiErr.message ?? 'An error occurred.');
        }
      } else {
        setGenericError(
          typeof apiErr.message === 'string' && apiErr.message.length > 0
            ? apiErr.message : 'An unexpected error occurred.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBase =
    'w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed';
  const inputError  = 'border-red-400 focus:ring-red-400';
  const inputNormal = 'border-gray-300';

  const typeBadgeClass = TYPE_BADGE[detectedType];
  const typeLabel      = ticketTypeLabel(detectedType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ct-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { if (!isSubmitting) onClose(); }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 sm:mx-4">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-white px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 id="ct-modal-title" className="text-lg font-semibold text-gray-900">New Ticket</h2>
          <button
            type="button"
            onClick={() => { if (!isSubmitting) onClose(); }}
            disabled={isSubmitting}
            className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="px-6 py-5 space-y-4">

          {genericError && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
              {genericError}
            </div>
          )}

          {/* External Ticket ID — required */}
          <div>
            <label htmlFor="ct-external-id" className="block text-sm font-medium text-gray-700 mb-1">
              External Ticket ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="ct-external-id"
                ref={firstInputRef}
                type="text"
                value={externalTicketId}
                onChange={(e) => { handleExternalIdChange(e.target.value); }}
                disabled={isSubmitting}
                maxLength={100}
                placeholder="INC00000XX · SCTASK00000XX · RITM00000XX"
                aria-describedby={fieldErrors.externalTicketId ? 'ct-ext-id-error' : 'ct-ext-id-hint'}
                aria-invalid={fieldErrors.externalTicketId ? 'true' : 'false'}
                className={`${inputBase} font-mono pr-24 ${fieldErrors.externalTicketId ? inputError : inputNormal}`}
              />
              {externalTicketId.trim() && (
                <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${typeBadgeClass}`}>
                  {typeLabel}
                </span>
              )}
            </div>
            {fieldErrors.externalTicketId && (
              <p id="ct-ext-id-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.externalTicketId}</p>
            )}
          </div>

          {/* Remarks + image attachments */}
          <div>
            <label htmlFor="ct-description" className="block text-sm font-medium text-gray-700 mb-1">
              Remarks
            </label>
            <div
              onDrop={handleRemarksDropZone}
              onDragOver={handleRemarksDropZoneDragOver}
              className="rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-gray-500 focus-within:border-gray-500 transition-colors"
            >
              <textarea
                id="ct-description"
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
                onPaste={handlePaste}
                disabled={isSubmitting}
                maxLength={5000}
                rows={3}
                placeholder="Add remarks, paste or drop images here…"
                aria-describedby={fieldErrors.description ? 'ct-description-error' : undefined}
                aria-invalid={fieldErrors.description ? 'true' : 'false'}
                className="w-full rounded-t-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed resize-y bg-transparent border-0"
              />
              {/* Attachment previews */}
              {attachmentPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pb-2">
                  {attachmentPreviews.map((src, i) => (
                    <div key={i} className="relative group w-16 h-16 shrink-0">
                      <img
                        src={src}
                        alt={`attachment-${i + 1}`}
                        className="w-full h-full object-cover rounded border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => { removeAttachment(i); }}
                        disabled={isSubmitting}
                        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-xs leading-none focus:outline-none"
                        aria-label={`Remove image ${i + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Toolbar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200 bg-gray-50 rounded-b-md">
                <button
                  type="button"
                  onClick={() => { fileInputRef.current?.click(); }}
                  disabled={isSubmitting || attachments.length >= MAX_FILES}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Attach image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Attach image
                </button>
                <span className="text-xs text-gray-400">
                  {attachments.length}/{MAX_FILES} · max 5 MB each
                </span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
            />
            {fieldErrors.description && (
              <p id="ct-description-error" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
            )}
          </div>

          {/* Category + Priority — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label htmlFor="ct-category" className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="ct-category"
                value={category}
                onChange={(e) => { setCategory(e.target.value as Category | ''); }}
                disabled={isSubmitting}
                aria-invalid={fieldErrors.category ? 'true' : 'false'}
                className={`${inputBase} ${fieldErrors.category ? inputError : inputNormal}`}
              >
                <option value="">Select a category…</option>
                {VALID_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {fieldErrors.category && (
                <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.category}</p>
              )}
            </div>

            {/* Priority — single dropdown */}
            <div>
              <label htmlFor="ct-priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                id="ct-priority"
                value={priority}
                onChange={(e) => { setPriority(e.target.value as PriorityValue | ''); }}
                disabled={isSubmitting}
                aria-invalid={fieldErrors.priority ? 'true' : 'false'}
                className={`${inputBase} ${fieldErrors.priority ? inputError : inputNormal}`}
              >
                <option value="">Select priority…</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {/* Live badge preview */}
              {selectedPriorityOption && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${selectedPriorityOption.badgeClass}`}>
                    {selectedPriorityOption.value}
                  </span>
                </div>
              )}
              {fieldErrors.priority && (
                <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.priority}</p>
              )}
            </div>
          </div>

          {/* Contact Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Method <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <div className="flex gap-2" role="group" aria-label="Contact method">
              {CONTACT_METHOD_OPTIONS.map((opt) => {
                const isSelected = contactMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setContactMethod(isSelected ? null : opt.value); }}
                    disabled={isSubmitting}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50
                      ${isSelected
                        ? 'border-gray-800 bg-gray-900 text-white shadow-sm'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                      }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assign To */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="ct-assignedToId" className="block text-sm font-medium text-gray-700">
                Assign To <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => { setAssignedToId(String(user?.id ?? '')); }}
                disabled={isSubmitting}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 transition-colors"
              >
                Assign to me
              </button>
            </div>
            {isAdmin ? (
              <select
                id="ct-assignedToId"
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
            ) : (
              <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${inputNormal} bg-gray-50`}>
                {assignedToId !== '' ? (
                  <>
                    <span className="text-gray-700">{user?.fullName ?? 'You'}</span>
                    <button
                      type="button"
                      onClick={() => { setAssignedToId(''); }}
                      disabled={isSubmitting}
                      className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-gray-400 italic">Not assigned — click "Assign to me" above</span>
                )}
              </div>
            )}
            {fieldErrors.assignedToId && (
              <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.assignedToId}</p>
            )}
          </div>

          {/* Knowledge Base */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-3">
            <div className="flex items-start gap-3">
              <input
                id="ct-kb"
                type="checkbox"
                checked={usedKnowledgeBase}
                onChange={(e) => {
                  setUsedKnowledgeBase(e.target.checked);
                  if (!e.target.checked) setSelectedKbId('');
                }}
                disabled={isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <div>
                <label htmlFor="ct-kb" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Resolved using Knowledge Base (KB)
                </label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Check this if you used an existing KB article to resolve the issue.
                </p>
              </div>
            </div>

            {/* KB article selector — shown only when checkbox is ticked */}
            {usedKnowledgeBase && (
              <div>
                <label htmlFor="ct-kb-article" className="block text-xs font-medium text-gray-600 mb-1">
                  Select KB Article <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  id="ct-kb-article"
                  value={selectedKbId}
                  onChange={(e) => { setSelectedKbId(e.target.value === '' ? '' : Number(e.target.value)); }}
                  disabled={isSubmitting || isLoadingKb}
                  className={`${inputBase} ${inputNormal} text-sm`}
                >
                  <option value="">
                    {isLoadingKb ? 'Loading KB articles…' : kbArticles.length === 0 ? 'No KB articles available' : 'Select a KB article…'}
                  </option>
                  {kbArticles.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.title} — {kb.originalName}
                    </option>
                  ))}
                </select>
                {selectedKbId !== '' && (() => {
                  const article = kbArticles.find((k) => k.id === selectedKbId);
                  return article ? (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Preview / Download
                    </a>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { if (!isSubmitting) onClose(); }}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating…
                </>
              ) : assignedToId !== '' ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Ticket &amp; Start Timer
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Ticket
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTicketModal;
