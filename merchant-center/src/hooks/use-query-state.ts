import { useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

/** Keeps view state (location, service, date) in the URL so views can deep-link to each other. */
export function useQueryState() {
  const { search, pathname } = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(search);
  const get = (k: string) => params.get(k) ?? undefined;
  const set = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(search);
      Object.entries(patch).forEach(([k, v]) =>
        v ? next.set(k, v) : next.delete(k)
      );
      history.replace({ pathname, search: next.toString() });
    },
    [search, pathname, history]
  );
  return { get, set };
}
