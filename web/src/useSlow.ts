import { useEffect, useState } from 'react';

// The free hosting plan stops the API after 15 idle minutes, and the first request then
// waits about a minute for it to start again
export const WAKING_MESSAGE =
  'Waking up the server… it sleeps when nobody has used it for a while, so this can take about a minute.';

// True once `pending` has lasted longer than `delayMs`, so quick requests show nothing
export function useSlow(pending: boolean, delayMs = 4000) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);

  return slow;
}
