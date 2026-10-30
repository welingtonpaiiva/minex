import { RefObject, useRef } from 'react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export function BarcodeInput({ value, onChange, disabled = false, inputRef }: { value: string; onChange: (value: string) => void; disabled?: boolean; inputRef?: RefObject<HTMLInputElement> }) {
  const localInput = useRef<HTMLInputElement>(null), input = inputRef || localInput;
  useBarcodeScanner({ inputRef: input, enabled: !disabled, onRead: onChange });
  return <input ref={input} aria-label="Código de barras" autoComplete="off" spellCheck={false} maxLength={255} disabled={disabled}
    value={value} onChange={event => onChange(event.target.value)} placeholder="TAG como padrão; digite ou leia outro código"
    onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}/>
}
