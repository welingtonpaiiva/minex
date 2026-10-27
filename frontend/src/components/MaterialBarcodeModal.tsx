import { useRef, useState } from 'react';
import { api } from '../services/api';
import { Modal, Notice, errorMessage } from './ui';

export function MaterialBarcodeModal({ item, onClose, onSaved }: {
  item: { id: number; nome: string; codigo_interno: string; codigo_barras: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(item.codigo_barras === item.codigo_interno ? '' : item.codigo_barras);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const pending = useRef(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await api.patch('/materiais/' + item.id + '/codigo-barras', { codigo_barras: code });
      onSaved();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <Modal title="Vincular código de barras" onClose={() => { if (!pending.current) onClose(); }}>
    <div className="barcode-item-summary"><strong>{item.nome}</strong><span>TAG: {item.codigo_interno}</span></div>
    <Notice message={message}/>
    <form onSubmit={save}>
      <label>Código de barras
        <input autoFocus type="text" autoComplete="off" spellCheck={false} maxLength={255} disabled={busy}
          value={code} onChange={event => setCode(event.target.value)} aria-describedby="barcode-link-help"
          onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="Digite ou leia com o leitor"/>
      </label>
      <p id="barcode-link-help" className="summary-note">Selecione o campo e use o leitor ou digite o código da etiqueta. Se deixar em branco, o sistema usa a TAG como código de leitura.</p>
      <div className="form-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar código de barras'}</button>
      </div>
    </form>
  </Modal>;
}
