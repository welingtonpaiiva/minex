import { useRef, useState } from 'react';
import { CheckCircle2, ScanLine, Wifi } from 'lucide-react';
import { NfcReaderModal } from './NfcReaderModal';
import { Notice } from './ui';
import { soundFX } from '../services/soundFX';
import './ReturnReadings.css';

export interface ReturnReadingsValue { nfcId: string; barcodes: Record<number, string> }
export interface ReturnScanItem { material_id: number; codigo_barras: string; material_nome: string; codigo_interno?: string }
export const emptyReturnReadings = (): ReturnReadingsValue => ({ nfcId: '', barcodes: {} });
export const hasReturnReadings = (value: ReturnReadingsValue, items: ReturnScanItem[]) =>
  Boolean(value.nfcId) && items.length > 0 && items.every(item => Boolean(item.codigo_barras) && value.barcodes[item.material_id] === item.codigo_barras);

export function ReturnReadings({ person, items, requiredItems = items, value, onChange, onBarcodeRead, disabled = false }: {
  person: { id: number; nome: string }; items: ReturnScanItem[]; requiredItems?: ReturnScanItem[];
  value: ReturnReadingsValue; onChange: (value: ReturnReadingsValue) => void;
  onBarcodeRead?: (materialId: number) => void; disabled?: boolean;
}) {
  const [nfcOpen, setNfcOpen] = useState(false), [code, setCode] = useState(''), [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const required = [...new Map(requiredItems.map(item => [item.material_id, item])).values()];
  const readCount = required.filter(item => value.barcodes[item.material_id] === item.codigo_barras && item.codigo_barras).length;
  const ready = hasReturnReadings(value, required);
  const current = !value.nfcId ? 0 : ready ? 2 : 1;
  const nextItem = required.find(item => !item.codigo_barras || value.barcodes[item.material_id] !== item.codigo_barras);
  const steps = [
    { title: 'Crachá NFC', detail: value.nfcId ? 'Conferido' : 'Leitura obrigatória', done: Boolean(value.nfcId) },
    { title: 'Materiais', detail: `${readCount} de ${required.length} lidos`, done: required.length > 0 && readCount === required.length },
    { title: 'Confirmação', detail: ready ? 'Pronto para confirmar' : 'Aguardando leituras', done: false }
  ];
  function scan() {
    if (disabled || !value.nfcId || !code.trim()) return;
    const item = items.find(item => item.codigo_barras && item.codigo_barras === code.trim());
    if (!item) { setMessage('Código de barras não pertence aos materiais desta devolução. Leia a etiqueta correta.'); soundFX.playError(); setCode(''); input.current?.focus(); return; }
    onChange({ ...value, barcodes: { ...value.barcodes, [item.material_id]: code.trim() } });
    onBarcodeRead?.(item.material_id);
    setMessage(''); setCode(''); soundFX.playScan(); input.current?.focus();
  }
  return <section className="return-readings" aria-label="Leituras obrigatórias para devolução">
    <ol className="reading-progress" aria-label="Etapas da devolução">{steps.map((step, index) => <li key={step.title} className={step.done ? 'is-done' : current === index ? 'is-current' : ''} aria-current={current === index ? 'step' : undefined}><span>{step.done ? <CheckCircle2 size={18} /> : index + 1}</span><div><strong>{step.title}</strong><small>{step.detail}</small></div></li>)}</ol>
    <div className="return-reading-step"><div><span className={value.nfcId ? 'reading-done' : ''}>{value.nfcId ? <CheckCircle2 size={19} /> : <Wifi size={19} />}</span><div><strong>{value.nfcId ? 'Crachá NFC conferido' : 'Leia o crachá do colaborador'}</strong><small>{person.nome}</small></div></div><button type="button" className="button secondary" disabled={disabled} onClick={() => setNfcOpen(true)}>{value.nfcId ? 'Ler novamente' : 'Ler crachá NFC'}</button></div>
    <div className={'reading-next ' + (ready ? 'is-ready' : '')} role="status">{!value.nfcId ? <><Wifi size={20} /><div><strong>Comece pelo crachá NFC</strong><span>Depois, leia as etiquetas dos materiais recebidos.</span></div></> : nextItem ? <><ScanLine size={22} /><div><small>PRÓXIMA LEITURA</small><strong>{nextItem.codigo_interno || nextItem.material_nome}</strong>{nextItem.codigo_interno && <span>{nextItem.material_nome}</span>}</div></> : ready ? <><CheckCircle2 size={22} /><div><strong>Leituras concluídas</strong><span>Confira a quantidade e a condição antes de confirmar.</span></div></> : <><ScanLine size={22} /><div><strong>Selecione os itens recebidos</strong><span>A leitura das etiquetas será conferida para cada material.</span></div></>}</div>
    <div className="inline-form"><input ref={input} aria-label="Ler código de barras para devolução" placeholder={value.nfcId ? 'Leia a etiqueta do material e pressione Enter' : 'Primeiro, leia o crachá NFC'} autoComplete="off" maxLength={255} value={code} disabled={disabled || !value.nfcId} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); scan(); } }} /><button type="button" className="button secondary" disabled={disabled || !value.nfcId || !code.trim()} onClick={scan}><ScanLine size={17} />Conferir código</button></div>
    <Notice message={message} />
    <p>Leia o crachá e cada material selecionado. Para materiais por quantidade, leia a etiqueta e informe quantas unidades recebeu.</p>
    <NfcReaderModal isOpen={nfcOpen} onClose={() => setNfcOpen(false)} title="DEVOLUÇÃO — LEIA O CRACHÁ NFC" subtitle={'Aproxime o crachá de ' + person.nome} nfcOnly onNfcRead={(reading, found) => {
      if (!found || found.id !== person.id) throw new Error('Este crachá pertence a outro colaborador. Leia o crachá de ' + person.nome + '.');
      onChange({ ...value, nfcId: reading }); setNfcOpen(false); setMessage(''); setTimeout(() => input.current?.focus(), 50);
    }} />
  </section>;
}
