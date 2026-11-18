import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowRight, Check, CheckCheck, CheckCircle2, Clock3, Layers, Package, Search, UsersRound } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { notifyChange, useResource } from '../hooks/useResource';
import { Colaborador, PendingReturnItem, PendingReturnPerson, PendingReturns } from '../types';
import { NfcReaderModal } from './NfcReaderModal';
import { ReturnNfcConfirmation } from './ReturnNfcConfirmation';
import { dateTime, MaterialIdentity, Modal, Notice, Page, Pager, Person, Reload } from './ui';
import './QuickReturn.css';
import './QuickReturnModal.css';
import { ReturnCondition, returnConditionMessage } from './ReturnCondition';
import { ReturnReadings, ReturnReadingsValue, hasReturnReadings } from './ReturnReadings';
import { useElapsedClock } from '../hooks/useElapsedClock';
import { materialHoldingTime } from '../utils/materialHoldingTime';

const itemKey = (item: PendingReturnItem) => item.tipo + ':' + item.emprestimo_id;
const count = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`;
type Draft = { person: PendingReturnPerson; amounts: Record<string, number | ''>; condition: string; key: string; error: string; readings: ReturnReadingsValue };

function MaterialLine({ item, now }: { item: PendingReturnItem; now: number }) {
  const holding = materialHoldingTime(item.retirada, now);
  return <div className={'return-material' + (holding.overdue ? ' is-overdue' : '')}>
    <span className={'return-material-icon ' + (item.kit_nome ? 'is-kit' : '')}>{item.kit_nome ? <Layers size={17} /> : <Package size={17} />}</span>
    <div><MaterialIdentity code={item.codigo_interno} name={item.material_nome}  photo={item.foto_url}/>{item.kit_nome && <small className="material-kit-name">Kit: {item.kit_nome}</small>}<small className="return-material-time">Em posse: {holding.label}{holding.overdue ? ' · acima de 8 horas' : ''}</small></div>
    <b className="return-quantity">{item.quantidade}<small> un.</small></b>
  </div>;
}

export function QuickReturn() {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  const pending = useRef(false);
  const [trackingNfc, setTrackingNfc] = useState(true), [confirmingNfc, setConfirmingNfc] = useState(false);
  const [returnAllPerson, setReturnAllPerson] = useState<PendingReturnPerson | null>(null);
  const resource = useResource<PendingReturns>('/emprestimos/pendencias', { busca: search, page, limit: 12 },
    { items: [], total: 0, resumo: { pessoas: 0, itens: 0, unidades: 0 } }, 10000);
  const { data, loading, error, updated, reload } = resource;
  const now = useElapsedClock(data.horario_servidor);
  useEffect(() => {
    const focus = () => { void reload(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [reload]);
  useEffect(() => {
    if (!loading && !error && page > 1 && !data.items.length) setPage(Math.max(1, Math.ceil(data.total / 12)));
  }, [loading, error, page, data.total, data.items.length]);

  function open(person: PendingReturnPerson, all: boolean, nfcId = '') {
    setSuccess('');
    setDraft({ person, amounts: Object.fromEntries(person.materiais.map(item => [itemKey(item), all ? item.quantidade : 0])),
      condition: 'APTO', key: crypto.randomUUID(), error: '', readings: { nfcId } });
  }
  async function track(nfcId: string, person?: Colaborador) {
    if (!person) return;
    if (returnAllPerson && person.id !== returnAllPerson.id) {
      throw new Error('Este crachá pertence a outro colaborador. Aproxime o crachá de ' + returnAllPerson.nome + '.');
    }
    const response = await api.get<PendingReturns>('/emprestimos/pendencias', { params: { colaboradorId: person.id, limit: 1 } });
    const found = response.data.items.find(item => item.id === person.id);
    if (!found) throw new Error(person.nome + ' não possui materiais pendentes de devolução.');
    open(found, !!returnAllPerson, nfcId); setTrackingNfc(false); setReturnAllPerson(null);
  }
  function startTracking(person: PendingReturnPerson | null = null) {
    setReturnAllPerson(person); setTrackingNfc(true);
  }
  function closeTracking() {
    setTrackingNfc(false); setReturnAllPerson(null);
  }
  function change(values: Partial<Draft>) {
    if (!pending.current) setDraft(old => old && ({ ...old, ...values, key: crypto.randomUUID(), error: '' }));
  }
  function close() { if (!pending.current) { setDraft(null); setConfirmingNfc(false); } }
  const selected = draft?.person.materiais.filter(item => itemKey(item) in draft.amounts && draft.amounts[itemKey(item)] !== 0) || [];
  const units = selected.reduce((total, item) => total + Number(draft!.amounts[itemKey(item)]), 0);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !hasReturnReadings(draft.readings, selected) || pending.current) return;
    setConfirmingNfc(true);
  }
  async function confirmReturn(nfcId: string) {
    if (!draft || !hasReturnReadings({ nfcId }, selected) || pending.current) return;
    pending.current = true; setBusy(true);
    setDraft(old => old && ({ ...old, error: '' }));
    try {
      const response = await api.post('/emprestimos/entrada-rapida', {
        colaboradorId: draft.person.id, condicao: draft.condition, nfcId,
        itens: selected.map(item => ({ tipo: item.tipo, emprestimoId: item.emprestimo_id, quantidade: Number(draft.amounts[itemKey(item)]) }))
      }, { headers: { 'Idempotency-Key': draft.key } });
      soundFX.playSuccess();
      setSuccess(`${count(response.data.unidadesCount, 'unidade devolvida', 'unidades devolvidas')} · ${response.data.colaborador.nome}. ${returnConditionMessage(draft.condition)}`);
      setDraft(null);
      setConfirmingNfc(false);
      notifyChange();
    } catch (e: any) {
      setDraft(old => old && ({ ...old, error: e.response?.data?.error || 'Não foi possível confirmar a devolução. Tente novamente para conferir o resultado.' }));
      soundFX.playError();
      throw e;
    } finally { pending.current = false; setBusy(false); }
  }

  return <Page title="Pessoas e materiais" description="Veja quem está com materiais e receba as devoluções direto por aqui."
    action={<Reload onClick={() => void reload()} loading={loading || busy} />}>
    <div className="quick-return">
      <button className="button primary nfc-start" disabled={busy} onClick={() => startTracking()}>Rastrear pelo crachá NFC</button>
      <p className="summary-note">Leia o crachá para abrir os materiais do colaborador. Confira os itens recebidos e leia novamente o NFC para confirmar a devolução.</p>
      <section className="return-overview" aria-label="Resumo das devoluções pendentes">
        <div className="return-overview-intro"><span className="return-overview-icon"><ArrowDownLeft size={26} /></span><div><span className="return-eyebrow">ENTRADA · BAIXA RÁPIDA</span><h2>De volta ao estoque.</h2><p>Confira, receba e siga para o próximo atendimento.</p></div></div>
        <div className="return-stats">
          <div><UsersRound size={17} /><strong>{data.resumo.pessoas}</strong><span>Pessoas</span></div>
          <div><Package size={17} /><strong>{data.resumo.itens}</strong><span>Itens em aberto</span></div>
          <div><CheckCheck size={17} /><strong>{data.resumo.unidades}</strong><span>Unidades a devolver</span></div>
        </div>
      </section>
      <Notice message={success} type="success" />
      <Notice message={error} />
      <div className="return-toolbar"><label className="return-search"><Search size={19} /><input aria-label="Buscar pessoas ou materiais pendentes"
        placeholder="Buscar pessoa, matrícula, material ou código…" value={search} maxLength={255} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
        <span className="return-updated" role="status"><i />{loading ? 'Atualizando lista…' : updated ? `Atualizado às ${updated}` : 'Consultando pendências…'}</span>
      </div>
      <div className="return-section-heading"><div><h2>Com materiais em mãos</h2><p>As pessoas permanecem aqui até a devolução do último item.</p></div><span>{count(data.total, 'pessoa', 'pessoas')}</span></div>
      {loading && !updated && !data.items.length ? <div className="return-grid" aria-label="Carregando pendências">{[1, 2, 3].map(i => <div className="return-skeleton" key={i}><span /><span /><span /></div>)}</div>
        : !data.items.length ? <section className="return-empty"><span><CheckCircle2 size={36} /></span><h2>{error ? 'Não foi possível carregar a lista' : search ? 'Nenhuma pendência encontrada' : 'Tudo devolvido por aqui'}</h2><p>{error ? 'Atualize a lista para tentar novamente.' : search ? 'Tente outro nome, matrícula ou código de material.' : 'Quem retirar materiais aparecerá automaticamente nesta aba.'}</p>{search && <button className="button secondary" onClick={() => { setSearch(''); setPage(1); }}>Limpar busca</button>}</section>
          : <div className="return-grid">{data.items.map(person => { const holding = materialHoldingTime(person.primeira_retirada, now); return <article className={'return-card' + (holding.overdue ? ' is-overdue' : '')} key={person.id} aria-label={'Materiais de ' + person.nome} data-overdue={holding.overdue}>
            <div className="return-card-person"><Person person={person} /><span className="return-open-tag">{holding.overdue ? <><AlertTriangle size={14} />Acima de 8 horas</> : 'Em aberto'}</span></div>
            <div className="return-card-meta"><span><Clock3 size={14} />Desde {dateTime(person.primeira_retirada)}</span><strong>{count(person.total_unidades, 'unidade', 'unidades')}</strong></div>
            <div className="return-holding-time"><span>Tempo com materiais</span><time aria-label={'Tempo com materiais de ' + person.nome}>{holding.label}</time><small>Desde a retirada mais antiga ainda pendente</small></div>
            <div className="return-card-materials">{person.materiais.slice(0, 3).map(item => <MaterialLine key={itemKey(item)} item={item} now={now} />)}
              {person.materiais.length > 3 && <details className="return-more"><summary>Ver mais {count(person.materiais.length - 3, 'item', 'itens')}</summary>{person.materiais.slice(3).map(item => <MaterialLine key={itemKey(item)} item={item} now={now} />)}</details>}
            </div>
            <div className="return-card-actions"><button className="button secondary" disabled={busy || loading} onClick={() => open(person, false)}>Escolher itens<ArrowRight size={16} /></button><button className="button primary" disabled={busy || loading} onClick={() => startTracking(person)}><CheckCheck size={17} />Devolver tudo</button></div>
          </article>; })}</div>}
      {data.total > 12 && <Pager page={page} total={data.total} limit={12} onChange={setPage} />}
      <p className="return-footnote"><Check size={15} />Devoluções feitas nas outras abas também atualizam esta lista automaticamente.</p>
    </div>
    {draft && <Modal title="Conferir devolução rápida" onClose={close} className="return-confirm-modal" backdropClassName="return-confirm-backdrop">
      <form className="return-confirm" onSubmit={submit}>
        <div className="return-confirm-layout">
        <div className="return-confirm-details">
        <div className="return-confirm-person"><Person person={draft.person} /><span>{count(draft.person.total_unidades, 'unidade pendente', 'unidades pendentes')}</span></div>
        <p className="return-confirm-note">Marque somente os materiais recebidos fisicamente. Ajuste as quantidades se a devolução for parcial.</p>
        <Notice message={draft.error} />
        <ReturnReadings person={draft.person} items={draft.person.materiais} requiredItems={selected} value={draft.readings} disabled={busy} onChange={readings => change({ readings })} onBarcodeRead={materialId=>{const matches=draft.person.materiais.filter(item=>item.material_id===materialId);if(matches.length===1){const item=matches[0],key=itemKey(item);change({amounts:{...draft.amounts,[key]:draft.amounts[key]||item.quantidade}});}}} />
        <ReturnCondition value={draft.condition} disabled={busy} onChange={condition => change({ condition })}/>
        </div>
        <section className="return-confirm-materials" aria-label="Materiais para devolução">
        <div className="return-confirm-materials-heading"><h3>Materiais do colaborador</h3><span>{count(draft.person.materiais.length, 'item', 'itens')}</span></div>
        <div className="return-select-actions"><button type="button" disabled={busy} onClick={() => change({ amounts: Object.fromEntries(draft.person.materiais.map(item => [itemKey(item), item.quantidade])) })}>Selecionar todos</button><button type="button" disabled={busy} onClick={() => change({ amounts: {} })}>Limpar seleção</button></div>
        <div className="return-checklist">{draft.person.materiais.map(item => {
          const key = itemKey(item), amount = draft.amounts[key] ?? 0;
          return <div className={'return-check-item ' + (amount !== 0 ? 'is-selected' : '')} key={key}>
            <label className="return-check-label"><input type="checkbox" aria-label={'Receber ' + item.codigo_interno} disabled={busy} checked={amount !== 0}
              onChange={e => change({ amounts: { ...draft.amounts, [key]: e.target.checked ? item.quantidade : 0 } })} /><span><MaterialIdentity code={item.codigo_interno} name={item.material_nome}  photo={item.foto_url}/><small>Retirada em {dateTime(item.retirada)}{item.kit_nome && <> · {item.kit_nome}</>}</small></span></label>
            {item.tipo === 'QUANTIDADE' ? <label className="return-amount">Receber<input aria-label={'Quantidade a devolver de ' + item.codigo_interno} type="number" inputMode="numeric" min={1} max={item.quantidade} step={1} required disabled={busy || amount === 0} value={amount === 0 ? '' : amount}
              onChange={e => change({ amounts: { ...draft.amounts, [key]: e.target.value === '' ? '' : Number(e.target.value) } })} /><small>de {item.quantidade} un.</small></label> : <span className="return-single">1 un.</span>}
          </div>;
        })}</div>
        </section>
        </div>
        <div className="return-confirm-footer"><div><strong>{count(units, 'unidade', 'unidades')}</strong><span>em {count(selected.length, 'item selecionado', 'itens selecionados')}</span></div><div><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" data-tone="success" disabled={busy || !hasReturnReadings(draft.readings, selected)}><ArrowDownLeft size={18} />{busy ? 'Registrando…' : 'Confirmar baixa'}</button></div></div>
      </form>
    </Modal>}
    <NfcReaderModal isOpen={trackingNfc} onClose={closeTracking} nfcOnly
      title="ENTRADA — APROXIME O CRACHÁ NFC" subtitle={returnAllPerson
        ? 'Aproxime o crachá de ' + returnAllPerson.nome + ' para reconhecer o colaborador e conferir todos os materiais a devolver.'
        : 'Leia o crachá do colaborador para abrir os materiais pendentes de devolução.'} onNfcRead={track}/>
    <ReturnNfcConfirmation isOpen={confirmingNfc} person={draft?.person || null}
      onClose={() => { if (!pending.current) setConfirmingNfc(false); }} onConfirm={confirmReturn}/>
  </Page>;
}
