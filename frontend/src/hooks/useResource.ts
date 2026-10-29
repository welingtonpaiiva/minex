import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { errorMessage } from '../components/ui';
import { notifyOperationUpdate, subscribeOperationUpdates } from '../services/operationUpdates';
export function useResource<T>(url: string, params: Record<string, unknown>, initial: T, poll = 30000) {
  const [data, setData] = useState<T>(initial), [loading, setLoading] = useState(true), [error, setError] = useState(''), [updated, setUpdated] = useState('');
  const key = JSON.stringify(params), serial = useRef(0);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    setLoading(true);
    try { const result = await api.get<T>(url, { params: JSON.parse(key) }); if (request === serial.current) { setData(result.data); setError(''); setUpdated(new Date().toLocaleTimeString('pt-BR')); } }
    catch (e) { if (request === serial.current) setError(errorMessage(e)); }
    finally { if (request === serial.current) setLoading(false); }
  }, [url, key]);
  useEffect(() => {
    const debounce = setTimeout(reload, 200), timer = poll ? setInterval(reload, poll) : undefined;
    const unsubscribe = subscribeOperationUpdates(() => { void reload(); });
    return () => { serial.current++; clearTimeout(debounce); if (timer) clearInterval(timer); unsubscribe(); };
  }, [reload, poll]);
  return { data, loading, error, updated, reload };
}
export const notifyChange = notifyOperationUpdate;
