import type { SafeUser } from '../../services/system-api-services/auth.service';

interface UserTableProps {
  users: SafeUser[];
  onView: (id: number) => void;
  onEdit: (id: number) => void;
}

function RoleBadge({ role }: { role: 'ADMIN' | 'EMPLOYEE' }): React.ReactElement {
  const styles =
    role === 'ADMIN'
      ? 'bg-indigo-100 text-indigo-700 ring-indigo-200'
      : 'bg-blue-100 text-blue-700 ring-blue-200';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {role === 'ADMIN' ? 'Admin' : 'Employee'}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }): React.ReactElement {
  const styles = isActive
    ? 'bg-green-100 text-green-700 ring-green-200'
    : 'bg-red-100 text-red-700 ring-red-200';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

/**
 * UserTable — renders a list of users in a table with role/active badges
 * and View/Edit action buttons.
 */
function UserTable({ users, onView, onEdit }: UserTableProps): React.ReactElement {
  const btnBase =
    'rounded px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Employee ID
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Full Name
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Email
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-500">
                {user.employeeId !== null && user.employeeId !== undefined
                  ? `#${user.employeeId}`
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {user.fullName}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                {user.email}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <RoleBadge role={user.role} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <ActiveBadge isActive={user.isActive} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onView(user.id)}
                    className={`${btnBase} bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-500`}
                    aria-label={`View user ${user.fullName}`}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(user.id)}
                    className={`${btnBase} bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400`}
                    aria-label={`Edit user ${user.fullName}`}
                  >
                    Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { UserTable };
export default UserTable;
