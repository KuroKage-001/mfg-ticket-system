/**
 * CategoriesPage — admin CRUD for ticket problem categories.
 *
 * Features:
 *  - List all categories with live search filter
 *  - Inline create (top form)
 *  - Inline edit (row expands into an edit form)
 *  - Toggle active/inactive (soft disable without delete)
 *  - Hard delete with confirmation dialog
 *  - Pagination (50 per page client-side — all rows loaded from API at once)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/admin-api-services/category.service';
import type { TicketCategory } from '../../services/admin-api-services/category.service';
import type { ApiError } from '../../config/api.config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// DeleteConfirmDialog
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
  category: TicketCategory;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ category, onConfirm, onCancel }: DeleteConfirmProps): React.ReactElement {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-labelledby="del-confirm-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 id="del-confirm-title" className="text-sm font-semibold text-gray-900">Delete category?</h2>
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-medium text-gray-700 break-all">{category.name}</span> will be permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoriesPage
// ---------------------------------------------------------------------------

function CategoriesPage(): React.ReactElement {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [isLoading, setIsLoading]   = useState<boolean>(true);
  const [loadError, setLoadError]   = useState<string>('');

  // ── Search + pagination ───────────────────────────────────────────────────
  const [search, setSearch]   = useState<string>('');
  const [page, setPage]       = useState<number>(1);

  // ── Create form ───────────────────────────────────────────────────────────
  const [newName, setNewName]         = useState<string>('');
  const [newSortOrder, setNewSortOrder] = useState<string>('');
  const [isCreating, setIsCreating]   = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');
  const newNameRef = useRef<HTMLInputElement>(null);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editingId, setEditingId]       = useState<number | null>(null);
  const [editName, setEditName]         = useState<string>('');
  const [editSortOrder, setEditSortOrder] = useState<string>('');
  const [isSaving, setIsSaving]         = useState<boolean>(false);
  const [editError, setEditError]       = useState<string>('');

  // ── Delete state ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TicketCategory | null>(null);
  const [isDeleting, setIsDeleting]     = useState<boolean>(false);
  const [actionError, setActionError]   = useState<string>('');

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError('');
    try {
      // Fetch all (including inactive) — we do a separate admin-level GET that
      // fetches with isActive filtering off by including inactive on the server.
      // For now, GET /api/categories returns active only, so we fetch once and
      // show all. Admin can toggle isActive to re-enable.
      const data = await listCategories();
      setCategories(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setLoadError(e.message ?? 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Filtered + paginated list ─────────────────────────────────────────────
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 on search change
  useEffect(() => { setPage(1); }, [search]);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newName.trim()) { setCreateError('Name is required.'); return; }
    setIsCreating(true);
    setCreateError('');
    try {
      const created = await createCategory({
        name:      newName.trim(),
        sortOrder: newSortOrder !== '' ? Number(newSortOrder) : 0,
      });
      setCategories((prev) => [...prev, created].sort((a, b) =>
        a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.name.localeCompare(b.name),
      ));
      setNewName('');
      setNewSortOrder('');
      newNameRef.current?.focus();
    } catch (err: unknown) {
      const e = err as ApiError;
      setCreateError(e.message ?? 'Failed to create category.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const startEdit = (cat: TicketCategory): void => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(String(cat.sortOrder));
    setEditError('');
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setEditName('');
    setEditSortOrder('');
    setEditError('');
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (editingId === null) return;
    if (!editName.trim()) { setEditError('Name is required.'); return; }
    setIsSaving(true);
    setEditError('');
    try {
      const updated = await updateCategory(editingId, {
        name:      editName.trim(),
        sortOrder: editSortOrder !== '' ? Number(editSortOrder) : 0,
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === editingId ? updated : c))
           .sort((a, b) =>
             a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.name.localeCompare(b.name),
           ),
      );
      cancelEdit();
    } catch (err: unknown) {
      const e = err as ApiError;
      setEditError(e.message ?? 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const handleToggleActive = async (cat: TicketCategory): Promise<void> => {
    setActionError('');
    try {
      const updated = await updateCategory(cat.id, { isActive: !cat.isActive });
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
    } catch (err: unknown) {
      const e = err as ApiError;
      setActionError(e.message ?? 'Failed to update category.');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionError('');
    try {
      await deleteCategory(deleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const e = err as ApiError;
      setActionError(e.message ?? 'Failed to delete category.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Shared input style ─────────────────────────────────────────────────────
  const inputBase =
    'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Problem Categories</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage ticket problem categories. Changes appear immediately in the Create Ticket form.
        </p>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Category</h2>
        <form onSubmit={(e) => { void handleCreate(e); }} noValidate className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-56">
            <label htmlFor="new-cat-name" className="block text-xs font-medium text-gray-600 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              id="new-cat-name"
              ref={newNameRef}
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
              disabled={isCreating}
              maxLength={300}
              placeholder="e.g. PROMIS >> LOT SPLIT / MERGE"
              className={`${inputBase} w-full`}
            />
          </div>
          <div className="w-28">
            <label htmlFor="new-cat-sort" className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
            <input
              id="new-cat-sort"
              type="number"
              value={newSortOrder}
              onChange={(e) => { setNewSortOrder(e.target.value); }}
              disabled={isCreating}
              min={0}
              placeholder="0"
              className={`${inputBase} w-full`}
            />
          </div>
          <button
            type="submit"
            disabled={isCreating || !newName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
          >
            {isCreating ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Adding…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </>
            )}
          </button>
          {createError && (
            <p role="alert" className="w-full text-xs text-red-600">{createError}</p>
          )}
        </form>
      </div>

      {/* Action error */}
      {actionError && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => { setActionError(''); }} className="text-red-400 hover:text-red-600 text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Category list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* List header + search */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-700">All Categories</h2>
            {!isLoading && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {filtered.length}{search ? ` / ${categories.length}` : ''}
              </span>
            )}
          </div>
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search categories…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="px-5 py-12 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading categories…
            </div>
          </div>
        )}

        {/* Load error */}
        {!isLoading && loadError && (
          <div role="alert" className="m-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
            <button type="button" onClick={() => { void load(); }} className="ml-2 underline text-red-600 hover:text-red-800">Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !loadError && filtered.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-gray-400">
            {search ? 'No categories match your search.' : 'No categories yet. Add one above.'}
          </p>
        )}

        {/* Table */}
        {!isLoading && !loadError && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-16">Sort</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category Name</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">Status</th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageSlice.map((cat) => (
                  editingId === cat.id ? (
                    /* ── Edit row ── */
                    <tr key={cat.id} className="bg-blue-50">
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          value={editSortOrder}
                          onChange={(e) => { setEditSortOrder(e.target.value); }}
                          disabled={isSaving}
                          min={0}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => { setEditName(e.target.value); setEditError(''); }}
                          disabled={isSaving}
                          maxLength={300}
                          autoFocus
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { void handleSaveEdit(); }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        {editError && <p className="mt-1 text-xs text-red-600">{editError}</p>}
                      </td>
                      <td className="px-5 py-3" />
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { void handleSaveEdit(); }}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    /* ── Normal row ── */
                    <tr key={cat.id} className={`transition-colors hover:bg-gray-50 ${!cat.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3 text-sm text-gray-400 tabular-nums">{cat.sortOrder}</td>
                      <td className="px-5 py-3 text-sm text-gray-800 break-all">{cat.name}</td>
                      <td className="px-5 py-3">
                        {cat.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Active</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200">Inactive</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => { startEdit(cat); }}
                            title="Edit"
                            className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Toggle active */}
                          <button
                            type="button"
                            onClick={() => { void handleToggleActive(cat); }}
                            title={cat.isActive ? 'Deactivate' : 'Activate'}
                            className="rounded p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            {cat.isActive ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(cat); setActionError(''); }}
                            disabled={isDeleting}
                            title="Delete"
                            className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !loadError && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-400">
              Page {safePage} of {totalPages} · {filtered.length} categories
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPage((p) => Math.max(1, p - 1)); }}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); }}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget !== null && (
        <DeleteConfirmDialog
          category={deleteTarget}
          onConfirm={() => { void handleConfirmDelete(); }}
          onCancel={() => { setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}

export default CategoriesPage;
