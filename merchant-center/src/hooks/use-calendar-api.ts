import { useEffect, useState } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';

/** Calendar service base URL, from the application config (`additionalEnv.calendarApiUrl`). */
export const useCalendarBaseUrl = (): string =>
  useApplicationContext(
    (c) => (c.environment as { calendarApiUrl?: string }).calendarApiUrl ?? ''
  );

export function useCalendarApi<T>(path: string | null) {
  const base = useCalendarBaseUrl();
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: !!path });
  useEffect(() => {
    if (!path) {
      setState({ loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ data: s.data, loading: true }));
    fetch(`${base}${path}`)
      .then((r) =>
        r.ok
          ? r.json()
          : Promise.reject(new Error(`Calendar service returned ${r.status}`))
      )
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch(
        (e) =>
          !cancelled &&
          setState({
            error:
              e.message === 'Failed to fetch'
                ? `Cannot reach the calendar service at ${base}`
                : e.message,
            loading: false,
          })
      );
    return () => {
      cancelled = true;
    };
  }, [base, path]);
  return state;
}
