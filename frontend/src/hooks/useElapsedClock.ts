import { useEffect, useRef, useState } from 'react';

// Atualiza somente a tela a cada segundo; a consulta ao servidor usa seu próprio intervalo.
export function useElapsedClock(serverTime?: string) {
  const [now, setNow] = useState(Date.now);
  const clock = useRef({ server: Date.now(), local: performance.now() });
  useEffect(() => {
    const timestamp = serverTime ? Date.parse(serverTime) : NaN;
    if (Number.isFinite(timestamp)) { clock.current = { server: timestamp, local: performance.now() }; setNow(timestamp); }
  }, [serverTime]);
  useEffect(() => {
    const tick = setInterval(() => setNow(clock.current.server + performance.now() - clock.current.local), 1000);
    return () => clearInterval(tick);
  }, []);
  return now;
}
