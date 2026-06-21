import { useEffect, useRef, useState } from 'react';

/**
 * Hitung mundur dari `from` detik. Memanggil `onDone` sekali saat mencapai 0.
 * Set `running=false` untuk menjeda.
 */
export function useCountdown(from: number, onDone?: () => void, running = true) {
  const [seconds, setSeconds] = useState(from);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onDoneRef.current?.();
      }
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, running]);

  return seconds;
}
