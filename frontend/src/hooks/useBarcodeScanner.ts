import { RefObject, useLayoutEffect, useRef } from 'react';

// Leitores USB HID enviam teclas. Captura a sequência rápida mesmo sem foco
// e aceita Enter, Tab ou pausa ao final, sem submeter outros formulários.
export function useBarcodeScanner({ onRead, inputRef, enabled = true }: {
  onRead: (code: string) => void; inputRef?: RefObject<HTMLInputElement>; enabled?: boolean;
}) {
  const callback = useRef(onRead);
  callback.current = onRead;
  useLayoutEffect(() => {
    if (!enabled) return;
    let buffer = '', lastKey = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => { buffer = ''; lastKey = 0; clearTimeout(timer); };
    const allowed = (target: EventTarget | null) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length && !dialogs[dialogs.length - 1].contains(inputRef?.current || null)) return false;
      if (!(target instanceof HTMLElement)) return true;
      if (target === inputRef?.current) return true;
      return !target.closest('textarea,select,[contenteditable="true"],input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])');
    };
    const finish = () => {
      const code = buffer.trim(); reset();
      if (code.length < 3) return;
      callback.current(code);
    };
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || !allowed(event.target)) { reset(); return; }
      if ((event.key === 'Enter' || event.key === 'Tab') && buffer.length >= 3) {
        event.preventDefault(); event.stopPropagation(); finish(); return;
      }
      if (event.key.length !== 1) { if (event.key !== 'Shift') reset(); return; }
      const time = performance.now();
      if (lastKey && time - lastKey > 80) buffer = '';
      lastKey = time; buffer = (buffer + event.key).slice(-255);
      clearTimeout(timer);
      timer = setTimeout(() => { if (allowed(document.activeElement)) finish(); else reset(); }, 180);
    };
    window.addEventListener('keydown', keys, true);
    window.addEventListener('blur', reset);
    return () => { reset(); window.removeEventListener('keydown', keys, true); window.removeEventListener('blur', reset); };
  }, [enabled, inputRef]);
}
