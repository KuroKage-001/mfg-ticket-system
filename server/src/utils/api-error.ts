/**
 * A typed error class that route handlers throw and catch, then serialize into
 * HTTP JSON responses via `handleApiError`.
 *
 * Satisfies Requirements 1.6, 14.2, 2.3 (error serialization boundary).
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ApiError";
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
