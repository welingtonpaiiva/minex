import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, Check, CheckCheck, CheckCircle2, Clock3, Layers, Package, Search, UsersRound } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { notifyChange, useResource } from '../hooks/useResource';
import { PendingReturnItem, PendingReturnPerson, PendingReturns } from '../types';
import { dateTime, MaterialIdentity, Modal, Notice, Page, Pager, Person, Reload } from './ui';
import './QuickReturn.css';
import { ReturnReadings, ReturnReadingsValue, emptyReturnReadings, hasReturnReadings } from './ReturnReadings';

const itemKey = (item: PendingReturnItem) => item.tipo + ':' + item.emprestimo_id;
const count = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`;
type Draft = { person: PendingReturnPerson; amounts: Record<string, number | ''>; condition: string; key: string; error: string; readings: ReturnReadingsValue };

function MaterialLine({ item }: { item: PendingReturnItem }) {
  return <div className="return-material">
    <span className={'return-material-icon ' + (item.kit_nome ? 'is-kit' : '')}>{item.kit_nome ? <Layers size={17} /> : <Package size={17} />}</span>
    <div><MaterialIdentity code={item.codigo_interno} name={item.material_nome} />{item.kit_nome && <small className="material-kit-name">Kit: {item.kit_nome}</small>}</div>
    <b className="return-quantity">{item.quantidade}<small> un.</small></b>
  </div>;
}

export function QuickReturn() {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  const pending = useRef(false);
  const resource = useResource<PendingReturns>('/emprestimos/pendencias', { busca: search, page, limit: 12 },
    { items: [], total: 0, resumo: { pessoas: 0, itens: 0, unidades: 0 } }, 10000);
  const { data, loading, error, updated, reload } = resource;
  useEffect(() => {
    const focus = () => { void reload(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [reload]);
  useEffect(() => {
    if (!loading && !error && page > 1 && !data.items.length) setPage(Math.max(1, Math.ceil(data.total / 12)));
  }, [loading, error, page, data.total, data.items.length]);

  function open(person: PendingReturnPerson, all: boolean) {
    setSuccess('');
    setDraft({ person, amounts: Object.fromEntries(person.materiais.map(item => [itemKey(item), all ? item.quantidade : 0])),
      condition: 'APTO', key: crypto.randomUUID(), error: '', readings: emptyReturnReadings() });
  }
  function change(values: Partial<Draft>) {
    if (!pending.current) setDraft(old => old && ({ ...old, ...values, key: crypto.randomUUID(), error: '' }));
  }
  function close() { if (!pending.current) setDraft(null); }
  const selected = draft?.person.materiais.filter(item => itemKey(item) in draft.amounts && draft.amounts[itemKey(item)] !== 0) || [];
  const units = selected.reduce((total, item) => total + Number(draft!.amounts[itemKey(item)]), 0);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !hasReturnReadings(draft.readings, selected) || pending.current) return;
    pending.current = true; setBusy(true);
    setDraft(old => old && ({ ...old, error: '' }));
    try {
      const response = await api.post('/emprestimos/entrada-rapida', {
        colaboradorId: draft.person.id, condicao: draft.condition, nfcId: draft.readings.nfcId,
        itens: selected.map(item => ({ tipo: item.tipo, emprestimoId: item.emprestimo_id, quantidade: Number(draft.amounts[itemKey(item)]), codigoBarras: draft.readings.barcodes[item.material_id] }))
      }, { headers: { 'Idempotency-Key': draft.key } });
      soundFX.playSuccess();
      setSuccess(`${count(response.data.unidadesCount, 'unidade devolvida', 'unidades devolvidas')} · ${response.data.colaborador.nome}. Estoque atualizado.`);
      setDraft(null);
      notifyChange();
    } catch (e: any) {
      setDraft(old => old && ({ ...old, error: e.response?.data?.error || 'Não foi possível confirmar a devolução. Tente novamente para conferir o resultado.' }));
      soundFX.playError();
    } finally { pending.current = false; setBusy(false); }
  }

  return <Page title="Pessoas e materiais" description="Veja quem está com materiais e receba as devoluções direto por aqui."
    action={<Reload onClick={() => void reload()} loading={loading || busy} />}>
    <div className="quick-return">
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
          : <div className="return-grid">{data.items.map(person => <article className="return-card" key={person.id} aria-label={'Materiais de ' + person.nome}>
            <div className="return-card-person"><Person person={person} /><span className="return-open-tag">Em aberto</span></div>
            <div className="return-card-meta"><span><Clock3 size={14} />Desde {dateTime(person.primeira_retirada)}</span><strong>{count(person.total_unidades, 'unidade', 'unidades')}</strong></div>
            <div className="return-card-materials">{person.materiais.slice(0, 3).map(item => <MaterialLine key={itemKey(item)} item={item} />)}
              {person.materiais.length > 3 && <details className="return-more"><summary>Ver mais {count(person.materiais.length - 3, 'item', 'itens')}</summary>{person.materiais.slice(3).map(item => <MaterialLine key={itemKey(item)} item={item} />)}</details>}
            </div>
            <div className="return-card-actions"><button className="button secondary" disabled={busy || loading} onClick={() => open(person, false)}>Escolher itens<ArrowRight size={16} /></button><button className="button primary" disabled={busy || loading} onClick={() => open(person, true)}><CheckCheck size={17} />Devolver tudo</button></div>
          </article>)}</div>}
      {data.total > 12 && <Pager page={page} total={data.total} limit={12} onChange={setPage} />}
      <p className="return-footnote"><Check size={15} />Devoluções feitas nas outras abas também atualizam esta lista automaticamente.</p>
    </div>
    {draft && <Modal title="Conferir devolução rápida" onClose={close}>
      <form className="return-confirm" onSubmit={submit}>
        <div className="return-confirm-person"><Person person={draft.person} /><span>{count(draft.person.total_unidades, 'unidade pendente', 'unidades pendentes')}</span></div>
        <p className="return-confirm-note">Marque somente os materiais recebidos fisicamente. Ajuste as quantidades se a devolução for parcial.</p>
        <Notice message={draft.error} />
        <ReturnReadings person={draft.person} items={draft.person.materiais} requiredItems={selected} value={draft.readings} disabled={busy} onChange={readings => change({ readings })} />
        <div className="return-select-actions"><button type="button" disabled={busy} onClick={() => change({ amounts: Object.fromEntries(draft.person.materiais.map(item => [itemKey(item), item.quantidade])) })}>Selecionar todos</button><button type="button" disabled={busy} onClick={() => change({ amounts: {} })}>Limpar seleção</button></div>
        <div className="return-checklist">{draft.person.materiais.map(item => {
          const key = itemKey(item), amount = draft.amounts[key] ?? 0;
          return <div className={'return-check-item ' + (amount !== 0 ? 'is-selected' : '')} key={key}>
            <label className="return-check-label"><input type="checkbox" aria-label={'Receber ' + item.codigo_interno} disabled={busy} checked={amount !== 0}
              onChange={e => change({ amounts: { ...draft.amounts, [key]: e.target.checked ? item.quantidade : 0 } })} /><span><MaterialIdentity code={item.codigo_interno} name={item.material_nome} /><small>Retirada em {dateTime(item.retirada)}{item.kit_nome && <> · {item.kit_nome}</>}</small><span className={'return-scan-status ' + (draft.readings.barcodes[item.material_id] ? 'is-read' : '')}>{draft.readings.barcodes[item.material_id] ? 'Código de barras conferido' : 'Leitura do código pendente'}</span></span></label>
            {item.tipo === 'QUANTIDADE' ? <label className="return-amount">Receber<input aria-label={'Quantidade a devolver de ' + item.codigo_interno} type="number" inputMode="numeric" min={1} max={item.quantidade} step={1} required disabled={busy || amount === 0} value={amount === 0 ? '' : amount}
              onChange={e => change({ amounts: { ...draft.amounts, [key]: e.target.value === '' ? '' : Number(e.target.value) } })} /><small>de {item.quantidade} un.</small></label> : <span className="return-single">1 un.</span>}
          </div>;
        })}</div>
        <label>Condição dos itens selecionados<select value={draft.condition} disabled={busy} onChange={e => change({ condition: e.target.value })}><option value="APTO">Aptos para reutilização</option><option value="CONFERENCIA">Aguardando conferência</option><option value="DANIFICADO">Danificados / manutenção</option></select></label>
        <p className="return-condition-note">{draft.condition === 'APTO' ? 'Os itens aptos voltam ao estoque disponível. Para condições diferentes, faça a baixa em grupos separados.' : draft.condition === 'CONFERENCIA' ? 'Os itens ficarão indisponíveis até a conferência.' : 'Os itens serão encaminhados para manutenção.'}</p>
        <div className="return-confirm-footer"><div><strong>{count(units, 'unidade', 'unidades')}</strong><span>em {count(selected.length, 'item selecionado', 'itens selecionados')}</span></div><div><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" data-tone="success" disabled={busy || !hasReturnReadings(draft.readings, selected)}><ArrowDownLeft size={18} />{busy ? 'Registrando…' : 'Confirmar baixa'}</button></div></div>
      </form>
    </Modal>}
  </Page>;
}
