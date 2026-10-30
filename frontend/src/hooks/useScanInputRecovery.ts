import { RefObject, useLayoutEffect, useRef, useState } from 'react';

// Aguarda o campo voltar a estar habilitado antes de devolver o foco.
export function useScanInputRecovery<T extends HTMLElement>(input: RefObject<T>, clear: () => void, disabled = false) {
  const [request, setRequest] = useState(0);
  const handled = useRef(0);
  useLayoutEffect(() => {
    if (disabled || handled.current === request) return;
    handled.current = request;
    input.current?.focus();
  }, [disabled, input, request]);
  return () => { clear(); setRequest(value => value + 1); };
}
