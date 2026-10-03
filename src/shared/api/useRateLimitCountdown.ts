import { useEffect, useState } from 'react';
import { useAppSelector } from '@/shared/lib/store';
import { selectRetryAt } from './rateLimitSlice';

export function useRateLimitCountdown(): number | null {
  const retryAt = useAppSelector(selectRetryAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (retryAt === null || retryAt <= Date.now()) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= retryAt) {
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [retryAt]);

  return retryAt !== null && retryAt > now ? Math.ceil((retryAt - now) / 1000) : null;
}
