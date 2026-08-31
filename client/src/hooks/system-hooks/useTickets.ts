import { useEffect, useState } from 'react';
import {
  listTickets,
  type PaginatedResult,
  type TicketListQuery,
  type TicketSummary,
} from '../../services/system-api-services/ticket.service';
import type { ApiError } from '../../config/api.config';

interface UseTicketsResult {
  data: PaginatedResult<TicketSummary> | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook that wraps `listTickets` from the system ticket service.
 * Re-fetches whenever the serialized query params change.
 */
export function useTickets(query: TicketListQuery, refreshKey = 0): UseTicketsResult {
  const [data, setData] = useState<PaginatedResult<TicketSummary> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = JSON.stringify({ ...query, refreshKey });

  useEffect(() => {
    let cancelled = false;

    const fetchTickets = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await listTickets(query);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load tickets.');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchTickets();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return { data, loading, error };
}
