/**
 * Knowledge Base API service.
 * GET  /api/kb          — list all KB articles (any authenticated user)
 * POST /api/kb          — upload a new KB article (admin only)
 * DELETE /api/kb/:id    — delete a KB article (admin only)
 */
import { BASE_URL } from '../../config/api.config';
import { apiFetch } from '../../config/api.config';

export interface KBArticle {
  id:           number;
  title:        string;
  filename:     string;
  originalName: string;
  fileType:     string;
  url:          string;
  createdAt:    string;
  uploadedBy:   { id: number; fullName: string };
}

/** List all KB articles. */
export async function listKBArticles(): Promise<KBArticle[]> {
  return apiFetch<KBArticle[]>('/kb');
}

/** Upload a new KB article. `file` is any supported document/image. */
export async function uploadKBArticle(
  title: string,
  file: File,
): Promise<KBArticle> {
  const form = new FormData();
  form.append('title', title);
  form.append('file', file);

  const response = await fetch(`${BASE_URL}/kb`, {
    method: 'POST',
    credentials: 'include',
    body: form,
    // Do NOT set Content-Type — browser sets it with the correct boundary
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw { message: (body as { message?: string }).message ?? 'Upload failed' };
  }

  return response.json() as Promise<KBArticle>;
}

/** Delete a KB article by id. */
export async function deleteKBArticle(id: number): Promise<void> {
  await apiFetch<void>(`/kb/${id}`, { method: 'DELETE' });
}
