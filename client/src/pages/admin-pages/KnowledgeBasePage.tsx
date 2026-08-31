/**
 * KnowledgeBasePage — admin-only page for managing KB articles.
 *
 * Features:
 *  - Upload new KB files (PDF, DOCX, DOC, XLS, XLSX, CSV, images)
 *  - List all uploaded KB articles with preview/download links
 *  - Delete articles
 */

import { useEffect, useRef, useState } from 'react';
import {
  listKBArticles,
  uploadKBArticle,
  deleteKBArticle,
} from '../../services/admin-api-services/kb.service';
import type { KBArticle } from '../../services/admin-api-services/kb.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
].join(',');

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileIcon(fileType: string): React.ReactElement {
  if (fileType === 'application/pdf') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (fileType.startsWith('image/')) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType === 'text/csv') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

interface UploadFormProps {
  onUploaded: (article: KBArticle) => void;
}

function UploadForm({ onUploaded }: UploadFormProps): React.ReactElement {
  const [title, setTitle]           = useState('');
  const [file, setFile]             = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError]           = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File): void => {
    if (f.size > MAX_BYTES) { setError(`File exceeds 20 MB limit.`); return; }
    setError('');
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!file)          { setError('Please select a file.'); return; }
    if (!title.trim())  { setError('Title is required.'); return; }
    setIsUploading(true);
    setError('');
    try {
      const article = await uploadKBArticle(title.trim(), file);
      onUploaded(article);
      setTitle('');
      setFile(null);
    } catch (err: unknown) {
      const e2 = err as { message?: string };
      setError(e2.message ?? 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Upload New KB Article</h2>

      {error && (
        <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="kb-title" className="block text-xs font-medium text-gray-600 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="kb-title"
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); }}
          disabled={isUploading}
          maxLength={255}
          placeholder="e.g. Password Reset Procedure"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:bg-gray-50"
        />
      </div>

      {/* Drop zone */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          File <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">(PDF, DOCX, XLS, XLSX, CSV, images — max 20 MB)</span>
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => { setIsDragging(false); }}
          onClick={() => { fileInputRef.current?.click(); }}
          className={[
            'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors px-6 py-8',
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100',
          ].join(' ')}
          role="button"
          tabIndex={0}
          aria-label="Click or drag to upload a file"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        >
          {file ? (
            <>
              <div className="flex items-center gap-2">
                {fileIcon(file.type)}
                <span className="text-sm font-medium text-gray-700">{file.name}</span>
              </div>
              <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-sm text-gray-500">
                <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
              </p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isUploading || !file}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Article
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// KB article row
// ---------------------------------------------------------------------------

interface ArticleRowProps {
  article: KBArticle;
  onDeleted: (id: number) => void;
}

function ArticleRow({ article, onDeleted }: ArticleRowProps): React.ReactElement {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async (): Promise<void> => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setIsDeleting(true);
    try {
      await deleteKBArticle(article.id);
      onDeleted(article.id);
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {fileIcon(article.fileType)}
          <div>
            <p className="text-sm font-medium text-gray-800">{article.title}</p>
            <p className="text-xs text-gray-400">{article.originalName}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 uppercase tracking-wide">
          {article.fileType.split('/').pop()?.replace('vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx').replace('vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx').replace('vnd.ms-excel', 'xls')}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {article.uploadedBy.fullName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
        {formatDate(article.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open
          </a>
          <button
            type="button"
            onClick={() => { void handleDelete(); }}
            disabled={isDeleting}
            className={[
              'inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50',
              confirmDelete
                ? 'text-red-700 font-semibold'
                : 'text-red-500 hover:text-red-700',
            ].join(' ')}
          >
            {isDeleting ? 'Deleting…' : confirmDelete ? 'Confirm?' : 'Delete'}
          </button>
          {confirmDelete && !isDeleting && (
            <button
              type="button"
              onClick={() => { setConfirmDelete(false); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function KnowledgeBasePage(): React.ReactElement {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listKBArticles()
      .then((data) => { if (!cancelled) setArticles(data); })
      .catch((err: unknown) => {
        const e = err as { message?: string };
        if (!cancelled) setError(e.message ?? 'Failed to load KB articles.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleUploaded = (article: KBArticle): void => {
    setArticles((prev) => [article, ...prev]);
  };

  const handleDeleted = (id: number): void => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const filtered = articles.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.originalName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Knowledge Base</h1>
        <p className="mt-1 text-sm text-gray-400">Upload and manage KB articles available for ticket resolution.</p>
      </div>

      {/* Upload form */}
      <UploadForm onUploaded={handleUploaded} />

      {/* Articles list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-700">
            All Articles
            {!isLoading && (
              <span className="ml-2 text-xs font-normal text-gray-400">{articles.length} total</span>
            )}
          </h2>
          {/* Search */}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              placeholder="Search articles…"
              className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 w-48"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-6 w-6 rounded-full border-4 border-gray-300 border-t-gray-700" aria-label="Loading" />
          </div>
        ) : error ? (
          <div role="alert" className="m-5 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            {search ? 'No articles match your search.' : 'No KB articles uploaded yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Article', 'Type', 'Uploaded By', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filtered.map((article) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    onDeleted={handleDeleted}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default KnowledgeBasePage;
