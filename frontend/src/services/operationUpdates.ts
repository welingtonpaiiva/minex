const STORAGE_KEY = 'casa_da_lanterna_operacao_atualizada';
const LOCAL_EVENT = 'operacao-atualizada';

export function subscribeOperationUpdates(listener: () => void) {
  const local = () => listener();
  const otherTab = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue !== null && event.storageArea === localStorage) listener();
  };
  window.addEventListener(LOCAL_EVENT, local);
  window.addEventListener('storage', otherTab);
  return () => {
    window.removeEventListener(LOCAL_EVENT, local);
    window.removeEventListener('storage', otherTab);
  };
}

export function notifyOperationUpdate() {
  window.dispatchEvent(new Event(LOCAL_EVENT));
  try {
    // Only a change signal is shared. Each tab reloads data with its own authentication.
    localStorage.setItem(STORAGE_KEY, `${Date.now()}:${Math.random().toString(36).slice(2)}`);
  } catch {
    // Local updates and periodic refresh remain available when storage is disabled.
  }
}
