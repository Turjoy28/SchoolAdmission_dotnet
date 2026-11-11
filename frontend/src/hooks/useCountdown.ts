import { useState, useEffect, useRef } from 'react';

export function useCountdown(expiresAt?: string, serverTime?: string) {
  const offsetRef = useRef<number>(0);

  // Calculate clock skew: serverTime - clientLocalTime
  if (serverTime) {
    offsetRef.current = new Date(serverTime).getTime() - Date.now();
  }

  const [_, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!expiresAt) {
    return {
      msLeft: 0,
      formatted: '00:00',
      isExpired: true,
      progressPercent: 0,
    };
  }

  const expiryMs = new Date(expiresAt).getTime();
  const currentServerTime = Date.now() + offsetRef.current;
  const msLeft = Math.max(0, expiryMs - currentServerTime);

  const totalSeconds = Math.floor(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpired = msLeft <= 0;

  // Assuming standard 10-minute (600s) window for progress bar visualization
  const totalDurationMs = 600 * 1000;
  const progressPercent = Math.min(100, Math.max(0, (msLeft / totalDurationMs) * 100));

  return {
    msLeft,
    formatted,
    isExpired,
    progressPercent,
  };
}
