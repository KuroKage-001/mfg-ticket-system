import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUser } from '../../services/admin-api-services/user.service';
import type { ApiError } from '../../config/api.config';

// ---------------------------------------------------------------------------
// Field error map
// ---------------------------------------------------------------------------

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: string;
}

// ---------------------------------------------------------------------------
// CreateUserPage
// ---------------------------------------------------------------------------

function CreateUserPage(): React.ReactElement {
  const navigate = useNavigate();

  // Form fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<'ADMIN' | 'EMPLOYEE' | ''>('');
  const [isActive, setIsActive] = useState<string>('true');

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [genericError, setGenericError] = useState<string>('');

  const clearErrors = (): void => {
    setFieldErrors({});
    setGenericError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearErrors();

    // Basic client-side presence checks
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (!email.trim()) errors.email = 'Email is required.';
    if (!password) errors.password = 'Password is required.';
    if (!role) errors.role = 'Role is required.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      await createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: role as 'ADMIN' | 'EMPLOYEE',
        isActive: isActive === 'true',
      });

      navigate('/admin/users');
    } catch (err: unknown) {
      const apiErr = err as ApiError;

      if (apiErr.field) {
        // Field-level error from 400 or 409 (duplicate email has field="email")
        const knownFields: Array<keyof FieldErrors> = [
          'fullName',
          'email',
          'password',
          'role',
          'isActive',
        ];
        if (knownFields.includes(apiErr.field as keyof FieldErrors)) {
          setFieldErrors({ [apiErr.field]: apiErr.message });
        } else {
          setGenericError(apiErr.message ?? 'An error occurred. Please try again.');
        }
      } else {
        setGenericError(
          typeof apiErr.message === 'string' && apiErr.message.length > 0
            ? apiErr.message
            : 'An unexpected error occurred. Please try again.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const inputBase =
    'w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed';
  const inputError = 'border-red-400 focus:ring-red-400';
  const inputNormal = 'border-gray-300';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Create User</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add a new user account to the system.
        </p>
      </div>

      {/* Generic error banner */}
      {genericError && (
        <div
          role="alert"
          className="mb-5 rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700"
        >
          {genericError}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          {/* Full Name */}
          <div className="mb-4">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); }}
              disabled={isSubmitting}
              maxLength={100}
              placeholder="e.g. Jane Doe"
              aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
              aria-invalid={fieldErrors.fullName ? 'true' : 'false'}
              className={`${inputBase} ${fieldErrors.fullName ? inputError : inputNormal}`}
            />
            {fieldErrors.fullName && (
              <p id="fullName-error" role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              disabled={isSubmitting}
              maxLength={191}
              placeholder="e.g. jane@example.com"
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              aria-invalid={fieldErrors.email ? 'true' : 'false'}
              className={`${inputBase} ${fieldErrors.email ? inputError : inputNormal}`}
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              disabled={isSubmitting}
              placeholder="Minimum 8 characters"
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              aria-invalid={fieldErrors.password ? 'true' : 'false'}
              className={`${inputBase} ${fieldErrors.password ? inputError : inputNormal}`}
            />
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Role and isActive — side-by-side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => { setRole(e.target.value as 'ADMIN' | 'EMPLOYEE' | ''); }}
                disabled={isSubmitting}
                aria-describedby={fieldErrors.role ? 'role-error' : undefined}
                aria-invalid={fieldErrors.role ? 'true' : 'false'}
                className={`${inputBase} ${fieldErrors.role ? inputError : inputNormal}`}
              >
                <option value="">Select a role…</option>
                <option value="ADMIN">Admin</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
              {fieldErrors.role && (
                <p id="role-error" role="alert" className="mt-1 text-xs text-red-600">
                  {fieldErrors.role}
                </p>
              )}
            </div>

            {/* Is Active */}
            <div>
              <label htmlFor="isActive" className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="isActive"
                value={isActive}
                onChange={(e) => { setIsActive(e.target.value); }}
                disabled={isSubmitting}
                aria-describedby={fieldErrors.isActive ? 'isActive-error' : undefined}
                aria-invalid={fieldErrors.isActive ? 'true' : 'false'}
                className={`${inputBase} ${fieldErrors.isActive ? inputError : inputNormal}`}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              {fieldErrors.isActive && (
                <p id="isActive-error" role="alert" className="mt-1 text-xs text-red-600">
                  {fieldErrors.isActive}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { navigate('/admin/users'); }}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              {isSubmitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateUserPage;
