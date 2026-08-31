/**
 * EditUserModal — inline modal for editing a user record.
 * Mirrors the logic from EditUserPage but rendered as an overlay.
 */

import { useEffect, useState } from 'react';
import { getUserById, updateUser } from '../../services/admin-api-services/user.service';
import type { UpdateUserDto } from '../../services/admin-api-services/user.service';
import type { SafeUser } from '../../services/system-api-services/auth.service';
import type { ApiError } from '../../config/api.config';

export interface EditUserModalProps {
  userId: number;
  onClose: () => void;
  /** Called after a successful save, with the updated user */
  onSaved: (user: SafeUser) => void;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: string;
}

function EditUserModal({ userId, onClose, onSaved }: EditUserModalProps): React.ReactElement {
  const [originalUser, setOriginalUser] = useState<SafeUser | null>(null);

  // Form fields
  const [employeeId, setEmployeeId] = useState<string>('');
  const [fullName, setFullName]     = useState<string>('');
  const [email, setEmail]           = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<'ADMIN' | 'EMPLOYEE'>('EMPLOYEE');
  const [isActive, setIsActive] = useState<string>('true');

  // Fetch state
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string>('');

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [genericError, setGenericError] = useState<string>('');
  const [noChangesError, setNoChangesError] = useState<boolean>(false);

  // Close on Escape (unless submitting)
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSubmitting, onClose]);

  // Fetch user data on mount
  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    setFetchError('');
    getUserById(userId)
      .then((u) => {
        if (!cancelled) {
          setOriginalUser(u);
          setEmployeeId(u.employeeId ?? '');
          setFullName(u.fullName);
          setEmail(u.email);
          setRole(u.role);
          setIsActive(String(u.isActive));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setFetchError(
            typeof apiErr.message === 'string' && apiErr.message.length > 0
              ? apiErr.message
              : 'Failed to load user. Please try again.',
          );
        }
      })
      .finally(() => { if (!cancelled) setIsFetching(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const clearErrors = (): void => {
    setFieldErrors({});
    setGenericError('');
    setNoChangesError(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearErrors();
    if (originalUser === null) return;

    const dto: UpdateUserDto = {};
    const trimmedEmpId = employeeId.trim() || null;
    if (trimmedEmpId !== originalUser.employeeId) dto.employeeId = trimmedEmpId;
    if (fullName.trim() !== originalUser.fullName)   dto.fullName = fullName.trim();
    if (email.trim() !== originalUser.email)         dto.email = email.trim();
    if (password !== '')                             dto.password = password;
    if (role !== originalUser.role)                  dto.role = role;
    if ((isActive === 'true') !== originalUser.isActive) dto.isActive = isActive === 'true';

    if (Object.keys(dto).length === 0) {
      setNoChangesError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateUser(userId, dto);
      onSaved(updated);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.field) {
        const knownFields: Array<keyof FieldErrors> = ['fullName', 'email', 'password', 'role', 'isActive'];
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { if (!isSubmitting) onClose(); }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 bg-white">
          <div>
            <h2 id="edit-user-modal-title" className="text-lg font-semibold text-gray-900">Edit User</h2>
            {originalUser !== null && (
              <p className="text-xs text-gray-400 mt-0.5">{originalUser.fullName}</p>
            )}
          </div>
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

        {/* Body */}
        <div className="px-6 py-5">
          {/* Fetch loading skeleton */}
          {isFetching && (
            <div className="space-y-4 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-9 w-full bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Fetch error */}
          {!isFetching && fetchError && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {/* Form */}
          {!isFetching && !fetchError && (
            <form id="edit-user-form" onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-4">
              {genericError && (
                <div role="alert" className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
                  {genericError}
                </div>
              )}

              {/* Employee ID */}
              <div>
                <label htmlFor="eu-employeeId" className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID{' '}
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none pointer-events-none">
                    #
                  </span>
                  <input
                    id="eu-employeeId"
                    type="text"
                    value={employeeId}
                    onChange={(e) => { setEmployeeId(e.target.value); }}
                    disabled={isSubmitting}
                    maxLength={50}
                    placeholder="e.g. 2018075"
                    className={`${inputBase} pl-7 font-mono ${inputNormal}`}
                  />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="eu-fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="eu-fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value.toUpperCase()); }}
                  disabled={isSubmitting}
                  maxLength={100}
                  placeholder="e.g. JANE DOE"
                  aria-invalid={fieldErrors.fullName ? 'true' : 'false'}
                  className={`${inputBase} uppercase ${fieldErrors.fullName ? inputError : inputNormal}`}
                />
                {fieldErrors.fullName && (
                  <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="eu-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="eu-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); }}
                  disabled={isSubmitting}
                  maxLength={191}
                  placeholder="e.g. jane@example.com"
                  aria-invalid={fieldErrors.email ? 'true' : 'false'}
                  className={`${inputBase} ${fieldErrors.email ? inputError : inputNormal}`}
                />
                {fieldErrors.email && (
                  <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="eu-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password{' '}
                  <span className="text-gray-400 font-normal text-xs">(leave blank to keep current)</span>
                </label>
                <input
                  id="eu-password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                  disabled={isSubmitting}
                  placeholder="New password (minimum 8 characters)"
                  aria-invalid={fieldErrors.password ? 'true' : 'false'}
                  className={`${inputBase} ${fieldErrors.password ? inputError : inputNormal}`}
                />
                {fieldErrors.password && (
                  <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
                )}
              </div>

              {/* Role + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="eu-role" className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="eu-role"
                    value={role}
                    onChange={(e) => { setRole(e.target.value as 'ADMIN' | 'EMPLOYEE'); }}
                    disabled={isSubmitting}
                    aria-invalid={fieldErrors.role ? 'true' : 'false'}
                    className={`${inputBase} ${fieldErrors.role ? inputError : inputNormal}`}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="EMPLOYEE">Employee</option>
                  </select>
                  {fieldErrors.role && (
                    <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="eu-isActive" className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="eu-isActive"
                    value={isActive}
                    onChange={(e) => { setIsActive(e.target.value); }}
                    disabled={isSubmitting}
                    aria-invalid={fieldErrors.isActive ? 'true' : 'false'}
                    className={`${inputBase} ${fieldErrors.isActive ? inputError : inputNormal}`}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  {fieldErrors.isActive && (
                    <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.isActive}</p>
                  )}
                </div>
              </div>

              {noChangesError && (
                <p role="status" className="text-sm text-amber-600">
                  No changes detected. Update at least one field before saving.
                </p>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!isFetching && !fetchError && (
          <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-2 border-t border-gray-100">
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
              form="edit-user-form"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditUserModal;
