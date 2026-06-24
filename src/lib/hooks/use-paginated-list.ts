"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api/fetcher";
import type { ListResponse } from "@/lib/svix/types";

interface State<T> {
  items: T[];
  iterator: string | null;
  done: boolean;
  loading: boolean;
  error: string | null;
}

/** Builds `path?limit=&iterator=` while preserving any existing query. */
function withCursor(path: string, iterator: string | null, limit: number): string {
  const [base, qs] = path.split("?");
  const params = new URLSearchParams(qs);
  params.set("limit", String(limit));
  if (iterator) params.set("iterator", iterator);
  return `${base}?${params.toString()}`;
}

/**
 * Accumulating cursor pagination against a BFF list endpoint that returns a
 * Svix `ListResponse`. Reusable across apps, endpoints, messages, event types.
 */
export function usePaginatedList<T>(path: string, limit = 50) {
  const [state, setState] = useState<State<T>>({
    items: [],
    iterator: null,
    done: false,
    loading: true,
    error: null,
  });

  const load = useCallback(
    async (cursor: string | null, reset: boolean) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const page = await apiGet<ListResponse<T>>(withCursor(path, cursor, limit));
        setState((s) => ({
          items: reset ? page.data : [...s.items, ...page.data],
          iterator: page.iterator,
          done: page.done,
          loading: false,
          error: null,
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load",
        }));
      }
    },
    [path, limit],
  );

  useEffect(() => {
    load(null, true);
  }, [load]);

  const loadMore = useCallback(() => {
    setState((s) => {
      if (!s.done && !s.loading) void load(s.iterator, false);
      return s;
    });
  }, [load]);

  const reload = useCallback(() => load(null, true), [load]);

  return {
    items: state.items,
    done: state.done,
    loading: state.loading,
    error: state.error,
    loadMore,
    reload,
  };
}
