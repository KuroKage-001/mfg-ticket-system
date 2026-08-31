/**
 * useMyTickets — employee-scoped hook that returns only tickets assigned to
 * the currently authenticated user.
 *
 * Wraps `listTickets({ assignedToId: user.id })` from the system ticket
 * service so employee views never need to repeat the assignedToId filter.
 *
 * Returns `null` data (and loading=false) when there is no authenticated user
 * rather than making an unauthenticated request.
 */

import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../system-hooks/useTickets';
import type {
  PaginatedResult,
  TicketListQuery,
  TicketSummary,
} from '../../services/system-api-services/ticket.service';

interface UseMyTicketsOptions
  extends Omit<TicketListQuery, 'assignedToId'> {}

interface UseMyTicketsResult {
  data: PaginatedResult<TicketSummary> | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook that wraps `listTickets` scoped to the current user.
 * Additional filters (page, limit, status, priority, search) can be passed
 * via the optional `options` parameter; `assignedToId` is always overridden
 * with the authenticated user's id.
 *
 * @param options - Optional TicketListQuery fields (excludes assignedToId)
 */
export function useMyTickets(options: UseMyTicketsOptions = {}): UseMyTicketsResult {
  const { user } = useAuth();

  // Build the query; assignedToId is pinned to the current user.
  // When there is no user, pass a sentinel value of -1 so the hook still
  // runs but the server will return 401 (handled as an error state).
  const query: TicketListQuery = {
    ...options,
    assignedToId: user?.id ?? -1,
  };

  const result = useTickets(query);

  // If there is no authenticated user, suppress the data so callers don't
  // receive a misleading empty list.
  if (!user) {
    return { data: null, loading: false, error: null };
  }

  return result;
}
