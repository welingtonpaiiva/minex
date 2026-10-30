import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, CheckCircle2, Search } from 'lucide-react';
import { api } from '../services/api';
import { notifyChange } from '../hooks/useResource';
import { soundFX } from '../services/soundFX';
import { Badge, MaterialIdentity, Notice, Page, Person, dateTime, errorMessage } from './ui';
import { ReturnCondition, returnConditionMessage } from './ReturnCondition';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useScanInputRecovery } from '../hooks/useScanInputRecovery';

interface Loan { id: number; quantidade: number; retirada: string; versao: string; colaborador: { id: number; nome: string; matricula: string; setor: string; foto_url: string } }
interface Preview { codigo: string; material: { id: number; nome: string; codigo_interno: string; codigo_barras: string; patrimonio: string; foto_url?: string; status: string; tipo_controle: string }; emprestimos: Loan[]; conferencia: { quantidade: number; versao: string } | null }
type Selection = { acao: 'DEVOLUCAO' | 'CONFERENCIA'; emprestimoId?: number; versao: string };

export function CodeReturn({ incomingScan }: { incomingScan?: { code: string; sequence: number } }) {
  const [code, setCode] = useState(''), [preview, setPreview] = useState<Preview | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null), [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('APTO'), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), key = useRef(crypto.randomUUID()), scanner = useRef<HTMLInputElement>(null);
  const lastLookup = useRef({ code: '', time: 0 });
  const cachedPreview = useRef<Preview | null>(null);
  const recoverScanner = useScanInputRecovery(scanner, () => {
    setCode(''); cachedPreview.current = null; lastLookup.current = { code: '', time: 0 };
  }, busy);
  const changed = () => { key.current = crypto.randomUUID(); setMessage(''); };
  const loan = preview?.emprestimos.find(item => item.id === selection?.emprestimoId);
  const maximum = selection?.acao === 'CONFERENCIA' ? preview?.conferencia?.quantidade || 0 : loan?.quantidade || 0;
  const quantitative = preview?.material.tipo_controle === 'QUANTIDADE';
  function choose(value: Selection) { setSelection(value); setQuantity(1); setCondition('APTO'); setReason(''); setConfirmed(false); changed(); }
  async function lookupCode(reading: string) {
    if (pending.current || !reading.trim()) return;
    lastLookup.current = { code: reading.trim(), time: performance.now() };
    cachedPreview.current = null;
    setCode(reading.trim());
    pending.current = true; setBusy(true); setPreview(null); setSelection(null); setMessage(''); setSuccess('');
    setQuantity(1); setCondition('APTO'); setReason(''); setConfirmed(false); key.current = crypto.randomUUID();
    try {
      const result = (await api.get<Preview>('/emprestimos/entrada-por-codigo/' + encodeURIComponent(reading.trim()))).data;
      cachedPreview.current = result;
      setPreview(result); soundFX.playScan();
      if (result.emprestimos.length === 1) setSelection({ acao: 'DEVOLUCAO', emprestimoId: result.emprestimos[0].id, versao: result.emprestimos[0].versao });
      else if (!result.emprestimos.length && result.conferencia) setSelection({ acao: 'CONFERENCIA', versao: result.conferencia.versao });
      else if (!result.emprestimos.length) recoverScanner();
    } catch (error) { setMessage(errorMessage(error)); recoverScanner(); soundFX.playError(); }
    finally { pending.current = false; setBusy(false); }
  }
  function readBarcode(reading: string) {
    if (reading === lastLookup.current.code && performance.now() - lastLookup.current.time < 700 && cachedPreview.current) {
      if (code !== reading || !preview) {
        const result = cachedPreview.current;
        setCode(reading); setPreview(result); setConfirmed(false); setCondition('APTO'); setQuantity(1); setReason('');
        setSelection(result.emprestimos.length === 1 ? { acao: 'DEVOLUCAO', emprestimoId: result.emprestimos[0].id, versao: result.emprestimos[0].versao }
          : !result.emprestimos.length && result.conferencia ? { acao: 'CONFERENCIA', versao: result.conferencia.versao } : null);
      }
      return;
    }
    void lookupCode(reading);
  }
  useBarcodeScanner({ inputRef: scanner, enabled: !busy, onRead: readBarcode });
  const handledScan = useRef<number>();
  useEffect(() => {
    if (incomingScan && handledScan.current !== incomingScan.sequence) {
      handledScan.current = incomingScan.sequence; void lookupCode(incomingScan.code);
    }
  }, [incomingScan]);
  useEffect(() => {
    if (success && !busy && !preview) scanner.current?.focus();
  }, [success, busy, preview]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (pending.current || !preview || !selection || !confirmed || quantity < 1 || quantity > maximum) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const { data } = await api.post('/emprestimos/entrada-por-codigo', { codigo: preview.codigo, ...selection, quantidade: quantity,
        condicao: condition, justificativa: reason, confirmar: true }, { headers: { 'Idempotency-Key': key.current } });
      const outcome = data.condicao === 'APTO' && quantitative && data.status !== 'DISPONIVEL'
        ? 'Saldo recebido. O material permanece ' + data.status.toLowerCase().replaceAll('_', ' ') + '.'
        : returnConditionMessage(data.condicao);
      setSuccess(`${data.quantidade} unidade(s) · ${data.material.codigo_interno}${data.colaborador ? ' · ' + data.colaborador.nome : ''}. ${outcome}`);
      cachedPreview.current = null; lastLookup.current = { code: '', time: 0 };
      setPreview(null); setSelection(null); setCode(''); setConfirmed(false); soundFX.playSuccess(); notifyChange();
    } catch (error) { setMessage(errorMessage(error)); recoverScanner(); soundFX.playError(); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Page title="Devolução por código" description="Digite a TAG ou leia o código de barras para registrar o retorno ao estoque.">
    <Notice message={success} type="success"/><Notice message={message}/>
    <section className="panel panel-content"><form className="inline-form" onSubmit={event => { event.preventDefault(); void lookupCode(code); }}>
      <input ref={scanner} autoFocus aria-label="Código do item para devolução" autoComplete="off" spellCheck={false} maxLength={255} required disabled={busy}
        placeholder="Digite a TAG ou use o leitor — ex.: LM-003" value={code} onChange={event => { setCode(event.target.value); setPreview(null); setSelection(null); setConfirmed(false); changed(); }}/>
      <button className="button primary" disabled={busy || !code.trim()}><Search size={18}/>{busy ? 'Processando…' : 'Consultar código'}</button>
    </form><p className="summary-note">{busy ? 'Consultando o material…' : 'Leitor pronto. A leitura USB identifica o item automaticamente; a devolução exige sua confirmação.'}</p></section>
    {preview && <div className="operation-layout"><section className="panel panel-content">
      <MaterialIdentity code={preview.material.codigo_interno} name={preview.material.nome} barcode={preview.material.codigo_barras} photo={preview.material.foto_url}/>
      <p className="summary-note">Patrimônio: {preview.material.patrimonio || 'Não informado'}</p><Badge value={preview.material.status}/>
      {preview.emprestimos.length > 0 && <><h2 style={{ marginTop: 24 }}>Responsável pela retirada</h2>
        {preview.emprestimos.length > 1 && <p className="summary-note">Selecione de qual empréstimo está recebendo as unidades.</p>}
        <div className="compact-list">{preview.emprestimos.map(item => <button type="button" className="compact-row code-return-loan" key={item.id} disabled={busy}
          aria-pressed={selection?.acao === 'DEVOLUCAO' && selection.emprestimoId === item.id} style={{ width: '100%', textAlign: 'left', background: selection?.emprestimoId === item.id ? '#f4f0fa' : undefined }}
          onClick={() => choose({ acao: 'DEVOLUCAO', emprestimoId: item.id, versao: item.versao })}>
          <Person person={item.colaborador}/><span className="code-return-loan-meta">{item.quantidade} un.<small>{dateTime(item.retirada)}</small></span>
        </button>)}</div></>}
      {preview.conferencia && <div style={{ marginTop: 24 }}><p className="summary-note">{preview.conferencia.quantidade} unidade(s) já recebida(s), aguardando conferência.</p>
        <button type="button" className="button secondary" disabled={busy} aria-pressed={selection?.acao === 'CONFERENCIA'} onClick={() => choose({ acao: 'CONFERENCIA', versao: preview.conferencia!.versao })}>Conferir e liberar pelo código</button></div>}
      {!preview.emprestimos.length && !preview.conferencia && <p className="summary-note">Este item não possui devolução ou conferência pendente.</p>}
    </section>{selection && <form className="panel summary-panel" onSubmit={submit}>
      <h2>{selection.acao === 'CONFERENCIA' ? 'Liberar item conferido' : 'Confirmar recebimento'}</h2>
      {loan && <p className="summary-note">{loan.colaborador.nome} · {loan.colaborador.matricula}</p>}
      {quantitative && <label>Quantidade a receber<input aria-label="Quantidade a receber por código" type="number" min={1} max={maximum} required disabled={busy} value={quantity} onChange={event => { setQuantity(Number(event.target.value)); setConfirmed(false); changed(); }}/><small>Até {maximum} unidade(s).</small></label>}
      {selection.acao === 'DEVOLUCAO' ? <ReturnCondition value={condition} disabled={busy} onChange={value => { setCondition(value); setConfirmed(false); changed(); }}/>
        : <><p className="summary-note">O item conferido e apto voltará ao estoque disponível.</p><label>Justificativa da liberação<textarea aria-label="Justificativa da liberação" required maxLength={4000} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); changed(); }}/></label></>}
      <label className="code-return-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => { setConfirmed(event.target.checked); changed(); }}/><span>{selection.acao === 'CONFERENCIA' ? 'Conferi o material e confirmo que está apto para uso.' : 'Recebi fisicamente o material e conferi a condição informada.'}</span></label>
      <button className="button primary full" data-tone="success" disabled={busy || !confirmed || quantity < 1 || quantity > maximum}>
        {selection.acao === 'CONFERENCIA' ? <CheckCircle2 size={18}/> : <ArrowDownLeft size={18}/>}{busy ? 'Registrando…' : selection.acao === 'CONFERENCIA' ? 'Liberar no estoque' : 'Confirmar devolução por código'}
      </button>
    </form>}</div>}
  </Page>;
}
