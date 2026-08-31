/**
 * LoginPage — split-panel layout.
 *
 * Left  : pure white panel with the sign-in form (no logo needed — kept clean).
 * Right : full-height cover image (Unsplash, free to use).
 *         Using a crisp top-down shot of industrial server/tech gear — fits
 *         the Manufacturing IT context and gives the page a polished feel.
 *
 * Image credit: Unsplash free-license
 * https://images.unsplash.com/photo-1558618666-fcd25c85cd64
 */

import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/system-hooks/useAuth';
import type { ApiError } from '../../config/api.config';

// ---------------------------------------------------------------------------
// Unsplash direct image URL — industrial wiring / circuit board close-up.
// Clean, minimal, professional. Free to embed (Unsplash licence).
// ---------------------------------------------------------------------------
const PANEL_IMAGE =
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LoginPage(): React.ReactElement {
  const { user, isLoading, login } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/dashboard';

  const [email, setEmail]               = useState<string>('');
  const [password, setPassword]         = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [emailError, setEmailError]       = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [genericError, setGenericError]   = useState<string>('');

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <svg className="animate-spin h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  // ── Already authenticated ────────────────────────────────────────────────
  if (user !== null) return <Navigate to="/dashboard" replace />;

  const clearErrors = (): void => {
    setEmailError('');
    setPasswordError('');
    setGenericError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearErrors();
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.field === 'email') {
        setEmailError(apiErr.message);
      } else if (apiErr.field === 'password') {
        setPasswordError(apiErr.message);
      } else if (typeof apiErr.message === 'string' && apiErr.message.length > 0) {
        setGenericError('Invalid credentials or inactive account.');
      } else {
        setGenericError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared input classes
  const inputBase = [
    'w-full rounded-md border px-3.5 py-2.5 text-sm text-gray-900',
    'placeholder-gray-400 bg-white',
    'focus:outline-none focus:ring-2 transition-colors',
    'disabled:bg-gray-50 disabled:cursor-not-allowed',
  ].join(' ');

  return (
    <div className="flex min-h-screen">

      {/* ── LEFT — form panel ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-12 lg:px-16 xl:px-24 bg-white">
        <div className="w-full max-w-sm mx-auto">

          {/* Heading — matches reference style */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              MFG Ticket System
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Sign in to your account to continue.
            </p>
          </div>

          {/* Generic error */}
          {genericError && (
            <div
              role="alert"
              className="mb-5 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {genericError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); }}
                aria-describedby={emailError ? 'email-error' : undefined}
                aria-invalid={emailError ? 'true' : 'false'}
                disabled={isSubmitting}
                placeholder="you@company.com"
                className={`${inputBase} ${emailError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-gray-400 focus:border-gray-400'}`}
              />
              {emailError && (
                <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                  aria-describedby={passwordError ? 'password-error' : undefined}
                  aria-invalid={passwordError ? 'true' : 'false'}
                  disabled={isSubmitting}
                  placeholder="••••••••"
                  className={`${inputBase} pr-10 ${passwordError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-gray-400 focus:border-gray-400'}`}
                />
                {/* Show / hide toggle */}
                <button
                  type="button"
                  onClick={() => { setShowPassword((p) => !p); }}
                  disabled={isSubmitting}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 focus:outline-none"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7a9.77 9.77 0 012.07-5.93M9.88 9.88A3 3 0 0114.12 14.12M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 active:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 mt-1"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>

          </form>

          {/* Footer note */}
          <p className="mt-8 text-xs text-gray-400 text-center">
            MFG IT · Manufacturing Ticket System
          </p>

        </div>
      </div>

      {/* ── RIGHT — image panel ───────────────────────────────────────── */}
      {/*
       * Hidden on mobile, visible from lg upward.
       * Photo: aerial view of electronic circuit board — clean, modern,
       * directly relevant to IT / manufacturing tech.
       * Source: Unsplash (free licence, no attribution required for web use)
       */}
      <div
        className="hidden lg:block lg:w-1/2 xl:w-3/5 relative overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={PANEL_IMAGE}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* very subtle tint so the left edge blends into white */}
        <div className="absolute inset-y-0 left-0 w-16 bg-linear-to-r from-white/30 to-transparent" />
      </div>

    </div>
  );
}

export default LoginPage;
