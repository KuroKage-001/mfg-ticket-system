/**
 * MyTicketsBanner — displays the count of tickets assigned to the current
 * user sourced from `myAssigned` in the dashboard summary response.
 *
 * Intended for use on the DashboardPage for EMPLOYEE users as a quick
 * at-a-glance of their personal workload.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface MyTicketsBannerProps {
  /** The `myAssigned` count from DashboardSummary. */
  myAssigned: number;
}

function MyTicketsBanner({ myAssigned }: MyTicketsBannerProps): React.ReactElement {
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-5 py-4 shadow-sm">
      {/* Left: greeting + count */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <div>
          <p className="text-sm text-indigo-600 font-medium">
            {user?.fullName ? `Welcome back, ${user.fullName}` : 'My Assigned Tickets'}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-indigo-700 leading-none">
            {myAssigned}
            <span className="ml-1.5 text-sm font-medium text-indigo-500">
              {myAssigned === 1 ? 'ticket' : 'tickets'} assigned to you
            </span>
          </p>
        </div>
      </div>

      {/* Right: link to filtered ticket list */}
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
      >
        View my tickets
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

export type { MyTicketsBannerProps };
export { MyTicketsBanner };
export default MyTicketsBanner;
