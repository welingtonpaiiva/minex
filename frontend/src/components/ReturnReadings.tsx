import { useRef, useState } from 'react';
import { CheckCircle2, ScanLine, Wifi } from 'lucide-react';
import { NfcReaderModal } from './NfcReaderModal';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useScanInputRecovery } from '../hooks/useScanInputRecovery';
import { Notice } from './ui';
import './ReturnReadings.css';

export interface ReturnReadingsValue { nfcId: string }
export interface ReturnScanItem { material_id: number; material_nome: string; codigo_interno?: string; codigo_barras?: string }
export const emptyReturnReadings = (): ReturnReadingsValue => ({ nfcId: '' });
export const hasReturnReadings = (value: ReturnReadingsValue, items: ReturnScanItem[]) => Boolean(value.nfcId) && items.length > 0;

export function ReturnReadings({ person, items, requiredItems = items, value, onChange, disabled = false, onBarcodeRead }: {
  person: { id: number; nome: string }; items: ReturnScanItem[]; requiredItems?: ReturnScanItem[];
  value: ReturnReadingsValue; onChange: (value: ReturnReadingsValue) => void; disabled?: boolean; onBarcodeRead?: (materialId: number) => void;
}) {
  const [nfcOpen, setNfcOpen] = useState(false);
  const [code, setCode] = useState(''), [message, setMessage] = useState(''), [identified, setIdentified] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const recoverScanner = useScanInputRecovery(input, () => setCode(''), disabled);
  function readBarcode(reading: string) {
    if (disabled || !value.nfcId) return;
    const clean = reading.trim();
    const matches = items.filter(item => item.codigo_barras === clean || item.codigo_interno === clean);
    if (!matches.length) { setMessage('Código não pertence aos materiais deste colaborador. Confira a etiqueta.'); setIdentified(''); recoverScanner(); return; }
    const item = matches[0];
    setCode(''); setMessage(''); setIdentified('Etiqueta identificada: ' + (item.codigo_interno || item.material_nome) + (matches.length > 1 ? '. Selecione o empréstimo e a quantidade recebida.' : '. Confira os itens selecionados.'));
    onBarcodeRead?.(item.material_id);
  }
  useBarcodeScanner({ inputRef: input, enabled: !disabled && !!value.nfcId && !nfcOpen, onRead: readBarcode });
  return <section className="return-readings" aria-label="Identificação para devolução">
    <div className="return-reading-step"><div><span className={value.nfcId ? 'reading-done' : ''}>{value.nfcId ? <CheckCircle2 size={19}/> : <Wifi size={19}/>}</span>
      <div><strong>{value.nfcId ? 'NFC conferido' : 'Identifique o colaborador pelo NFC'}</strong><small>{person.nome}</small></div></div>
      <button type="button" className="button secondary" disabled={disabled} onClick={() => setNfcOpen(true)}>{value.nfcId ? 'Conferir NFC novamente' : 'Ler ou digitar NFC'}</button>
    </div>
    <p>{requiredItems.length ? requiredItems.length + ' item(ns) selecionado(s). Confira os materiais recebidos e confirme a devolução.' : 'Selecione os materiais recebidos para confirmar a devolução.'}</p>
    <div className="inline-form"><input ref={input} aria-label="Ler código de barras para devolução" value={code} disabled={disabled || !value.nfcId} autoComplete="off" maxLength={255}
      placeholder={value.nfcId ? 'Leia a etiqueta ou digite a TAG' : 'Primeiro identifique o colaborador pelo NFC'} onChange={event => setCode(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); readBarcode(code); } }}/>
      <button type="button" className="button secondary" disabled={disabled || !value.nfcId || !code.trim()} onClick={() => readBarcode(code)}><ScanLine size={17}/>Identificar item</button></div>
    <Notice message={message}/><Notice message={identified} type="success"/>
    <NfcReaderModal isOpen={nfcOpen} onClose={() => setNfcOpen(false)} title="DEVOLUÇÃO — LEIA O CRACHÁ NFC"
      subtitle={'Aproxime o crachá ou digite o código NFC de ' + person.nome} nfcOnly onNfcRead={(reading, found) => {
        if (!found || found.id !== person.id) throw new Error('Este crachá pertence a outro colaborador. Informe o NFC de ' + person.nome + '.');
        onChange({ nfcId: reading }); setNfcOpen(false);
      }}/>
  </section>;
}
