/**
 * CreateUserModal — modal overlay for creating a new user account.
 *  - Custom Employee ID field (e.g. EMPLOYEE ID # 2018075)
 *  - Full Name is auto-uppercased as the user types
 */

import { useState } from 'react';
import { createUser } from '../../services/admin-api-services/user.service';
import type { SafeUser } from '../../services/system-api-services/auth.service';
import type { ApiError } from '../../config/api.config';
import { useEffect } from 'react';

interface FieldErrors {
  employeeId?: string;
  fullName?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: string;
}

export interface CreateUserModalProps {
  onClose: () => void;
  onCreated: (user: SafeUser) => void;
}

function CreateUserModal({ onClose, onCreated }: CreateUserModalProps): React.ReactElement {
  const [employeeId, setEmployeeId] = useState<string>('');
  const [fullName, setFullName]     = useState<string>('');
  const [email, setEmail]           = useState<string>('');
  const [password, setPassword]     = useState<string>('');
  const [role, setRole]             = useState<'ADMIN' | 'EMPLOYEE' | ''>('');
  const [isActive, setIsActive]     = useState<string>('true');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors]   = useState<FieldErrors>({});
  const [genericError, setGenericError] = useState<string>('');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSubmitting, onClose]);

  const clearErrors = (): void => { setFieldErrors({}); setGenericError(''); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearErrors();

    const errors: FieldErrors = {};
    if (!fullName.trim())  errors.fullName = 'Full name is required.';
    if (!email.trim())     errors.email    = 'Email is required.';
    if (!password)         errors.password = 'Password is required.';
    if (!role)             errors.role     = 'Role is required.';

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setIsSubmitting(true);
    try {
      const created = await createUser({
        ...(employeeId.trim() ? { employeeId: employeeId.trim() } : {}),
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: role as 'ADMIN' | 'EMPLOYEE',
        isActive: isActive === 'true',
      });
      onCreated(created);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.field) {
        const knownFields: Array<keyof FieldErrors> = [
          'employeeId', 'fullName', 'email', 'password', 'role', 'isActive',
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cu-modal-title"
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
          <h2 id="cu-modal-title" className="text-lg font-semibold text-gray-900">Create User</h2>
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
        <form id="cu-form" onSubmit={(e) => { void handleSubmit(e); }} noValidate className="px-6 py-5 space-y-4">
          {genericError && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
              {genericError}
            </div>
          )}

          {/* Employee ID */}
          <div>
            <label htmlFor="cu-employeeId" className="block text-sm font-medium text-gray-700 mb-1">
              Employee ID <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none pointer-events-none">
                #
              </span>
              <input
                id="cu-employeeId"
                type="text"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); }}
                disabled={isSubmitting}
                maxLength={50}
                placeholder="e.g. 2018075"
                aria-invalid={fieldErrors.employeeId ? 'true' : 'false'}
                className={`${inputBase} pl-7 font-mono ${fieldErrors.employeeId ? inputError : inputNormal}`}
              />
            </div>
            {fieldErrors.employeeId && (
              <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.employeeId}</p>
            )}
          </div>

          {/* Full Name — auto UPPERCASE */}
          <div>
            <label htmlFor="cu-fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="cu-fullName"
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
            <label htmlFor="cu-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="cu-email"
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
            <label htmlFor="cu-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="cu-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              disabled={isSubmitting}
              placeholder="Minimum 8 characters"
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
              <label htmlFor="cu-role" className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="cu-role"
                value={role}
                onChange={(e) => { setRole(e.target.value as 'ADMIN' | 'EMPLOYEE' | ''); }}
                disabled={isSubmitting}
                aria-invalid={fieldErrors.role ? 'true' : 'false'}
                className={`${inputBase} ${fieldErrors.role ? inputError : inputNormal}`}
              >
                <option value="">Select a role…</option>
                <option value="ADMIN">Admin</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
              {fieldErrors.role && (
                <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
              )}
            </div>
            <div>
              <label htmlFor="cu-isActive" className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="cu-isActive"
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
        </form>

        {/* Footer */}
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
            form="cu-form"
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
            ) : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateUserModal;
