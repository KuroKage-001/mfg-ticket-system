/**
 * ViewUserModal — displays a read-only summary of a user record.
 */

import { useEffect, useState } from 'react';
import { getUserById } from '../../services/admin-api-services/user.service';
import type { SafeUser } from '../../services/system-api-services/auth.service';
import type { ApiError } from '../../config/api.config';

export interface ViewUserModalProps {
  userId: number;
  onClose: () => void;
  /** Called when the user clicks "Edit" inside the modal */
  onEdit: (id: number) => void;
}

function RoleBadge({ role }: { role: 'ADMIN' | 'EMPLOYEE' }): React.ReactElement {
  const styles =
    role === 'ADMIN'
      ? 'bg-indigo-100 text-indigo-700 ring-indigo-200'
      : 'bg-blue-100 text-blue-700 ring-blue-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}>
      {role === 'ADMIN' ? 'Admin' : 'Employee'}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }): React.ReactElement {
  const styles = isActive
    ? 'bg-green-100 text-green-700 ring-green-200'
    : 'bg-red-100 text-red-700 ring-red-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function ViewUserModal({ userId, onClose, onEdit }: ViewUserModalProps): React.ReactElement {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getUserById(userId)
      .then((u) => { if (!cancelled) setUser(u); })
      .catch((err: unknown) => {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(typeof apiErr.message === 'string' ? apiErr.message : 'Failed to load user.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-user-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 id="view-user-modal-title" className="text-lg font-semibold text-gray-900">
            User Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading && (
            <div className="space-y-3 animate-pulse" aria-label="Loading">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-20 bg-gray-200 rounded" />
                  <div className="h-5 w-full bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && user !== null && (
            <dl className="space-y-4">
              {/* Avatar / Name */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-lg font-semibold text-gray-600 uppercase">
                  {user.fullName.charAt(0)}
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">{user.fullName}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-1">Role</dt>
                  <dd><RoleBadge role={user.role} /></dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-1">Status</dt>
                  <dd><ActiveBadge isActive={user.isActive} /></dd>
                </div>
              </div>

              {user.employeeId !== null && user.employeeId !== undefined && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-1">Employee ID</dt>
                  <dd className="text-sm text-gray-700 font-mono">#{user.employeeId}</dd>
                </div>
              )}

              <div>
                <dt className="text-xs font-medium text-gray-500 mb-1">System ID</dt>
                <dd className="text-sm text-gray-700 font-mono">#{user.id}</dd>
              </div>            </dl>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && user !== null && (
          <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => { onEdit(user.id); }}
              className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
            >
              Edit User
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewUserModal;
