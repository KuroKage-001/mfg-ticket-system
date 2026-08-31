/**
 * API configuration and base fetch wrapper for the MFG Ticket System client.
 * All service calls go through `apiFetch` to ensure consistent credential
 * handling and error normalisation.
 */

export const BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

/** Shape of the error thrown by `apiFetch` on non-2xx responses. */
export interface ApiError {
  message: string;
  field?: string;
}

/**
 * Thin wrapper around `fetch` that:
 *  - Prepends `BASE_URL` to the given path
 *  - Sends credentials (session cookie) on every request
 *  - Parses the JSON response body
 *  - Throws an `ApiError` object on non-2xx HTTP status codes
 *
 * @param path    The API path to request (e.g. "/auth/me")
 * @param init    Optional `RequestInit` options passed directly to `fetch`
 * @returns       The parsed JSON response typed as `T`
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    // Attempt to parse a structured error body from the server.
    // Fall back gracefully if the body is not JSON or is empty.
    let errorBody: { message?: string; field?: string } = {};
    try {
      errorBody = (await response.json()) as { message?: string; field?: string };
    } catch {
      // Non-JSON error body — use a generic message.
    }

    const error: ApiError = {
      message: errorBody.message ?? `Request failed with status ${response.status}`,
      ...(errorBody.field !== undefined ? { field: errorBody.field } : {}),
    };

    throw error;
  }

  // Parse and return the success body.
  return response.json() as Promise<T>;
}
