import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { MonitoringSnapshot } from '../components/monitoringModel';

export function useMineMonitoring() {
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [error, setError] = useState(''), [now, setNow] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const clock = useRef({ server: Date.now(), local: performance.now() });
  useEffect(() => {
    let active = true, inFlight = false, failures = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const refresh = async () => {
      if (!active || inFlight) return;
      clearTimeout(timer); inFlight = true;
      const started = performance.now();
      try {
        const response = await api.get<MonitoringSnapshot>('/operacao/monitoramento', { signal: controller.signal, timeout: 12000 });
        if (!active) return;
        const received = performance.now(), server = Date.parse(response.data.horario_servidor);
        if (!Number.isFinite(server) || !Array.isArray(response.data.colaboradores) || !Array.isArray(response.data.brigadistas?.presentes)) throw new Error('Resposta inválida');
        new Intl.DateTimeFormat('pt-BR', { timeZone: response.data.fuso_horario }).format(new Date(server));
        clock.current = { server: server + Math.min(1000, (received - started) / 2), local: received };
        setNow(clock.current.server); setLastUpdate(server); setSnapshot(response.data); setError(''); failures = 0;
      } catch {
        if (active) { failures++; setError('Conexão interrompida. Os dados exibidos podem estar desatualizados.'); }
      } finally {
        inFlight = false;
        if (active) timer = setTimeout(refresh, Math.min(30000, failures ? 5000 * failures : 10000));
      }
    };
    const resume = () => { if (!document.hidden) void refresh(); };
    const tick = setInterval(() => setNow(clock.current.server + performance.now() - clock.current.local), 1000);
    void refresh();
    window.addEventListener('operacao-atualizada', refresh); window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false; controller.abort(); clearTimeout(timer); clearInterval(tick);
      window.removeEventListener('operacao-atualizada', refresh); window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  return { snapshot, error, now, lastUpdate };
}

export function useMonitoringPhotos(sources: string[]) {
  const cache = useRef(new Map<string, string>()), [, render] = useState(0);
  const key = JSON.stringify([...new Set(sources.filter(source => source?.startsWith('/api/fotos/')))].sort());
  useEffect(() => {
    let active = true;
    const controller = new AbortController(), wanted: string[] = JSON.parse(key);
    const pinned = new Set(wanted);
    for (const [source, url] of cache.current) {
      if (cache.current.size <= 96) break;
      if (!pinned.has(source)) { URL.revokeObjectURL(url); cache.current.delete(source); }
    }
    const fetchPhotos = async () => {
      const missing = wanted.filter(source => !cache.current.has(source));
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(4, missing.length) }, async () => {
        while (active && next < missing.length) {
          const source = missing[next++];
          try {
            const response = await api.get(source.replace('/api', ''), { responseType: 'blob', signal: controller.signal });
            if (active) { cache.current.set(source, URL.createObjectURL(response.data)); render(value => value + 1); }
          } catch { /* A missing photo keeps the identity fallback visible. */ }
        }
      }));
    };
    void fetchPhotos();
    return () => { active = false; controller.abort(); };
  }, [key]);
  useEffect(() => () => { cache.current.forEach(url => URL.revokeObjectURL(url)); cache.current.clear(); }, []);
  return (source: string) => source?.startsWith('data:image/') ? source : cache.current.get(source) || '';
}
