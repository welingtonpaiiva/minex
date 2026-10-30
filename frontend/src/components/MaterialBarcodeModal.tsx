import { useRef, useState } from 'react';
import { api } from '../services/api';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useScanInputRecovery } from '../hooks/useScanInputRecovery';
import { MaterialIdentity, Modal, Notice, errorMessage } from './ui';

export function MaterialBarcodeModal({ item, onClose, onSaved }: {
  item: { id: number; nome: string; codigo_interno: string; codigo_barras: string; foto_url?: string };
  onClose: () => void; onSaved: () => void;
}) {
  const [code, setCode] = useState(item.codigo_barras || item.codigo_interno);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null), pending = useRef(false);
  const recoverScanner = useScanInputRecovery(input, () => setCode(''), busy);
  useBarcodeScanner({ inputRef: input, enabled: !busy, onRead: value => setCode(value) });
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try { await api.patch('/materiais/' + item.id + '/codigo-barras', { codigo_barras: code }); onSaved(); }
    catch (error) { setMessage(errorMessage(error)); recoverScanner(); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal title="Vincular código de barras" onClose={() => { if (!pending.current) onClose(); }}>
    <MaterialIdentity code={item.codigo_interno} name={item.nome} photo={item.foto_url}/><Notice message={message}/>
    <form onSubmit={save}><label>Código de barras<input ref={input} autoFocus aria-label="Código de barras" autoComplete="off" spellCheck={false}
      maxLength={255} disabled={busy} value={code} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}/></label>
      <p className="summary-note">Digite ou leia a etiqueta. Deixe em branco para usar a TAG. Confira o valor antes de salvar.</p>
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="button primary" disabled={busy}>Salvar código de barras</button></div>
    </form>
  </Modal>;
}
