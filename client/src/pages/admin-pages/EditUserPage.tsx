import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserById, updateUser } from '../../services/admin-api-services/user.service';
import type { UpdateUserDto } from '../../services/admin-api-services/user.service';
import type { SafeUser } from '../../services/system-api-services/auth.service';
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
// EditUserPage
// ---------------------------------------------------------------------------

function EditUserPage(): React.ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Original fetched user — used to diff changed fields
  const [originalUser, setOriginalUser] = useState<SafeUser | null>(null);

  // Form fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
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

  // ---------------------------------------------------------------------------
  // Fetch user on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (id === undefined) {
      setFetchError('Invalid user ID.');
      setIsFetching(false);
      return;
    }

    const userId = Number(id);
    if (isNaN(userId)) {
      setFetchError('Invalid user ID.');
      setIsFetching(false);
      return;
    }

    let cancelled = false;

    const fetchUser = async (): Promise<void> => {
      try {
        const user = await getUserById(userId);
        if (!cancelled) {
          setOriginalUser(user);
          setFullName(user.fullName);
          setEmail(user.email);
          setRole(user.role);
          setIsActive(String(user.isActive));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setFetchError(
            typeof apiErr.message === 'string' && apiErr.message.length > 0
              ? apiErr.message
              : 'Failed to load user. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    void fetchUser();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---------------------------------------------------------------------------
  // Form submission
  // ---------------------------------------------------------------------------

  const clearErrors = (): void => {
    setFieldErrors({});
    setGenericError('');
    setNoChangesError(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearErrors();

    if (originalUser === null) return;

    // Build DTO with only changed fields
    const dto: UpdateUserDto = {};

    if (fullName.trim() !== originalUser.fullName) {
      dto.fullName = fullName.trim();
    }
    if (email.trim() !== originalUser.email) {
      dto.email = email.trim();
    }
    if (password !== '') {
      dto.password = password;
    }
    if (role !== originalUser.role) {
      dto.role = role;
    }
    if ((isActive === 'true') !== originalUser.isActive) {
      dto.isActive = isActive === 'true';
    }

    // If nothing changed, show inline message and skip API call
    if (Object.keys(dto).length === 0) {
      setNoChangesError(true);
      return;
    }

    const userId = Number(id);
    setIsSubmitting(true);

    try {
      await updateUser(userId, dto);
      navigate('/admin/users');
    } catch (err: unknown) {
      const apiErr = err as ApiError;

      if (apiErr.field) {
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

  // Loading skeleton while fetching
  if (isFetching) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="h-8 w-40 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-9 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fetch error (e.g. 404 user not found)
  if (fetchError) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div
          role="alert"
          className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700"
        >
          {fetchError}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => { navigate('/admin/users'); }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Edit User</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update the details for{' '}
          <span className="font-medium text-gray-700">{originalUser?.fullName}</span>.
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

          {/* Password (optional) */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password{' '}
              <span className="text-gray-400 font-normal text-xs">(leave blank to keep current)</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              disabled={isSubmitting}
              placeholder="New password (minimum 8 characters)"
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
                onChange={(e) => { setRole(e.target.value as 'ADMIN' | 'EMPLOYEE'); }}
                disabled={isSubmitting}
                aria-describedby={fieldErrors.role ? 'role-error' : undefined}
                aria-invalid={fieldErrors.role ? 'true' : 'false'}
                className={`${inputBase} ${fieldErrors.role ? inputError : inputNormal}`}
              >
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

          {/* No changes message */}
          {noChangesError && (
            <p role="status" className="mb-4 text-sm text-amber-600">
              No changes detected. Update at least one field before saving.
            </p>
          )}

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
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserPage;
