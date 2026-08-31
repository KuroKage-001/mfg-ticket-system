import { useCallback, useEffect, useState } from 'react';
import {
  listUsers,
  type UserListQuery,
} from '../../services/admin-api-services/user.service';
import type { SafeUser } from '../../services/system-api-services/auth.service';
import type { ApiError } from '../../config/api.config';

const PAGE_LIMIT = 20;

interface UseUsersResult {
  users: SafeUser[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  role: 'ADMIN' | 'EMPLOYEE' | undefined;
  setRole: (value: 'ADMIN' | 'EMPLOYEE' | undefined) => void;
  isActive: boolean | undefined;
  setIsActive: (value: boolean | undefined) => void;
  setPage: (page: number) => void;
  refresh: () => void;
}

/**
 * Custom hook that wraps `listUsers` from the admin user service.
 * Manages filter state (search, role, isActive), pagination, and re-fetches
 * whenever any of them change. Resets to page 1 when filters change.
 */
export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPageState] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearchState] = useState<string>('');
  const [role, setRoleState] = useState<'ADMIN' | 'EMPLOYEE' | undefined>(undefined);
  const [isActive, setIsActiveState] = useState<boolean | undefined>(undefined);

  // Refresh counter to trigger re-fetch manually
  const [refreshCount, setRefreshCount] = useState<number>(0);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPageState(1);
  }, []);

  const setRole = useCallback((value: 'ADMIN' | 'EMPLOYEE' | undefined) => {
    setRoleState(value);
    setPageState(1);
  }, []);

  const setIsActive = useCallback((value: boolean | undefined) => {
    setIsActiveState(value);
    setPageState(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshCount((c) => c + 1);
  }, []);

  // Build query, serialise for stable dependency comparison
  const query: UserListQuery = {
    page,
    limit: PAGE_LIMIT,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };

  const queryKey = JSON.stringify({ ...query, refreshCount });

  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await listUsers(query);
        if (!cancelled) {
          setUsers(result.data);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load users.');
          setUsers([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchUsers();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return {
    users,
    total,
    page,
    limit: PAGE_LIMIT,
    loading,
    error,
    search,
    setSearch,
    role,
    setRole,
    isActive,
    setIsActive,
    setPage: setPageState,
    refresh,
  };
}
