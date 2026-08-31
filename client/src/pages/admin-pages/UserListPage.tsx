import { useState } from 'react';
import { useUsers } from '../../hooks/admin-hooks/useUsers';
import UserTable from '../../components/admin-components/UserTable';
import PaginationControls from '../../components/system-components/PaginationControls';
import ViewUserModal from '../../components/admin-components/ViewUserModal';
import EditUserModal from '../../components/admin-components/EditUserModal';
import CreateUserModal from '../../components/admin-components/CreateUserModal';

const inputBase =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function UserListPage(): React.ReactElement {
  const {
    users,
    total,
    page,
    limit,
    loading,
    error,
    search,
    setSearch,
    role,
    setRole,
    isActive,
    setIsActive,
    setPage,
    refresh,
  } = useUsers();

  // Modal state
  const [creatingUser, setCreatingUser]   = useState<boolean>(false);
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const handleRoleChange = (value: string) => {
    if (value === '') {
      setRole(undefined);
    } else if (value === 'ADMIN' || value === 'EMPLOYEE') {
      setRole(value);
    }
  };

  const handleIsActiveChange = (value: string) => {
    if (value === '') {
      setIsActive(undefined);
    } else {
      setIsActive(value === 'true');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage system users, roles, and access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setCreatingUser(true); }}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          + Create User
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="flex flex-col gap-1">
          <label htmlFor="search" className="text-xs font-medium text-gray-600">
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputBase} w-56`}
          />
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1">
          <label htmlFor="role" className="text-xs font-medium text-gray-600">
            Role
          </label>
          <select
            id="role"
            value={role ?? ''}
            onChange={(e) => handleRoleChange(e.target.value)}
            className={`${inputBase} w-36`}
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
        </div>

        {/* Active Status */}
        <div className="flex flex-col gap-1">
          <label htmlFor="isActive" className="text-xs font-medium text-gray-600">
            Active Status
          </label>
          <select
            id="isActive"
            value={isActive === undefined ? '' : String(isActive)}
            onChange={(e) => handleIsActiveChange(e.target.value)}
            className={`${inputBase} w-36`}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-3" role="status" aria-label="Loading users">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-gray-200" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* User table */}
      {!loading && !error && (
        <>
          {users.length === 0 ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <p className="text-sm text-gray-500">No users found matching your filters.</p>
            </div>
          ) : (
            <UserTable
              users={users}
              onView={(id) => { setViewingUserId(id); }}
              onEdit={(id) => { setEditingUserId(id); }}
            />
          )}

          {/* Pagination */}
          <PaginationControls
            page={page}
            limit={limit}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Create User Modal */}
      {creatingUser && (
        <CreateUserModal
          onClose={() => { setCreatingUser(false); }}
          onCreated={() => { setCreatingUser(false); refresh(); }}
        />
      )}

      {/* View User Modal */}
      {viewingUserId !== null && (
        <ViewUserModal
          userId={viewingUserId}
          onClose={() => { setViewingUserId(null); }}
          onEdit={(id) => { setViewingUserId(null); setEditingUserId(id); }}
        />
      )}

      {/* Edit User Modal */}
      {editingUserId !== null && (
        <EditUserModal
          userId={editingUserId}
          onClose={() => { setEditingUserId(null); }}
          onSaved={() => { setEditingUserId(null); refresh(); }}
        />
      )}
    </div>
  );
}

export default UserListPage;
