import { useState } from 'react';
import { SearchCheck, Package, History, ListFilter, BarChart2, Clock } from 'lucide-react';
import { Usuario } from '../types';
import { api } from '../services/api';
import { useResource, notifyChange } from '../hooks/useResource';
import { Page, Notice, Badge, Empty, Pager, Modal, canOperate, errorMessage, Reload, dateTime } from '../components/ui';
import { useRef } from 'react';

// ---- Sub-componente: Extravios -----------------------------------------------
function AbaExtravios({ user }: { user: Usuario }) {
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [late, setLate] = useState(true), [page, setPage] = useState(1), [record, setRecord] = useState<any>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [history, setHistory] = useState<any[]>([]);
  const pending = useRef(false), manager = ['ADMINISTRADOR', 'SUPERVISOR'].includes(user.nivel_acesso);
  const list = useResource<any>('/operacao/extravios', { busca: search, situacao: status, atrasados: String(late), page }, { items: [], total: 0 });

  async function open(item: any) {
    setMessage(''); setRecord({ ...item, descricao: '', situacao: ['DEVOLVIDO', 'ENCERRADO'].includes(item.situacao) ? 'ENCERRADO' : 'EXTRAVIO_EM_APURACAO' }); setHistory([]);
    if (item.id && manager) try { const r = await api.get('/operacao/auditoria', { params: { entidade: 'extravio', referencia_id: item.id } }); setHistory(r.data.items); } catch (e) { setMessage(errorMessage(e)); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setMessage('');
    try { await api.post(record.emprestimo_id < 0 ? '/quantidades/extravios/' + (-record.emprestimo_id) : '/operacao/extravios/' + record.emprestimo_id, record); setRecord(null); notifyChange(); }
    catch (e) { setMessage(errorMessage(e)); } finally { pending.current = false; setBusy(false); }
  }

  return (
    <>
      <Notice message={message || list.error} />
      <div className="filters">
        <label className="search">Pesquisar<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Material, código, nome ou matrícula" /></label>
        <label>Situação<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todas as situações</option>
          {['EM_OPERACAO', 'DEVOLUCAO_ATRASADA', 'EXTRAVIO_EM_APURACAO', 'LOCALIZADO', 'DEVOLVIDO', 'ENCERRADO'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
        </select></label>
        <label className="check-label"><input type="checkbox" checked={late} onChange={e => { setLate(e.target.checked); setPage(1); }} />Somente atrasos em aberto</label>
      </div>
      <section className="panel">
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Material / ocorrência</th><th>Responsável pela retirada</th><th>Retirada</th><th>Permanência</th><th>Situação</th><th>Ação</th></tr></thead>
          <tbody>{list.data.items.map((r: any) => <tr key={r.emprestimo_id}><td><strong>{r.material_nome}</strong><small>{r.codigo_interno} · {r.patrimonio || 'Sem patrimônio'}</small><small>{r.codigo || 'Sem ocorrência aberta'} · Quantidade: {r.quantidade}</small></td><td><strong>{r.colaborador_nome}</strong><small>{r.matricula} · {r.setor || '—'}</small></td><td>{dateTime(r.retirada)}<small>{r.prazo_devolucao ? 'Prazo: ' + dateTime(r.prazo_devolucao) : 'Prazo: 24h após retirada'}</small></td><td><strong style={{ color: r.atrasado ? '#ad542e' : undefined }}>{r.tempo}</strong></td><td><Badge value={r.situacao} /></td><td><button className="button secondary" onClick={() => open(r)}>{canOperate(user.nivel_acesso) ? 'Acompanhar' : 'Consultar'}</button></td></tr>)}</tbody>
        </table></div>
        {!list.data.items.length && <Empty>{list.loading ? 'Consultando pendências…' : 'Nenhuma pendência para os filtros selecionados.'}</Empty>}
        <Pager page={page} total={list.data.total} onChange={setPage} />
      </section>
      <p className="summary-note">O prazo padrão é de 24 horas após a retirada. Um prazo de devolução registrado tem prioridade. Atraso não significa perda definitiva. A devolução é confirmada no módulo de retorno ao estoque.</p>
      {record && <Modal title="Acompanhar ocorrência" onClose={() => setRecord(null)}><strong>{record.material_nome} · {record.codigo_interno}</strong><p className="summary-note" style={{ margin: '10px 0 20px' }}>{record.colaborador_nome} · Retirada: {dateTime(record.retirada)}<br />Identificação: {dateTime(record.identificado_em)} · Destino: {record.destino || 'Não informado'}</p><Notice message={message} />{canOperate(user.nivel_acesso) && <form onSubmit={save}><div className="form-grid"><label className="wide">Situação<select value={record.situacao} onChange={e => setRecord({ ...record, situacao: e.target.value })}>{['EXTRAVIO_EM_APURACAO', 'LOCALIZADO', 'ENCERRADO'].map(s => <option key={s}>{s}</option>)}</select></label><label className="wide">Descrição da atualização<textarea required rows={4} maxLength={4000} value={record.descricao} onChange={e => setRecord({ ...record, descricao: e.target.value })} /></label></div><div className="form-actions"><button className="button primary" disabled={busy}>Registrar atualização</button></div></form>}<div className="training-list">{history.map(r => <div className="training-record" key={r.id}><div><h3>{r.acao.replaceAll('_', ' ')}</h3><p>{r.usuario_nome} · {dateTime(r.data_hora)}<br />{JSON.parse(r.detalhes).descricao || 'Registro de devolução'}</p></div></div>)}</div></Modal>}
    </>
  );
}

// ---- Sub-componente: Materiais por Quantidade --------------------------------
function AbaQuantidades({ user }: { user: Usuario }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [form, setForm] = useState<any>(null), [adjust, setAdjust] = useState<any>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), key = useRef(crypto.randomUUID()), manager = ['ADMINISTRADOR', 'SUPERVISOR'].includes(user.nivel_acesso);
  const list = useResource<any>('/quantidades', { busca: search, page }, { items: [], total: 0 });

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setMessage('');
    try {
      if (form) await api.post('/quantidades', form);
      else await api.post('/quantidades/movimentar', adjust, { headers: { 'Idempotency-Key': key.current } });
      setForm(null); setAdjust(null); notifyChange();
    } catch (e) { setMessage(errorMessage(e)); } finally { pending.current = false; setBusy(false); }
  }

  return (
    <>
      <Notice message={message || list.error} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input aria-label="Pesquisar material" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Nome ou código" style={{ flex: 1, minWidth: 200, maxWidth: 400 }} />
        {manager && <button className="button primary" onClick={() => { setForm({ nome: '', codigo_interno: '', saldo_inicial: 0 }); setMessage(''); }}>+ Novo material</button>}
      </div>
      <section className="panel">
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Disponível</th><th>Em operação</th><th>Conferência</th><th>Manutenção</th>{manager && <th>Ação</th>}</tr></thead>
          <tbody>{list.data.items.map((r: any) => <tr key={r.id}><td><strong>{r.nome}</strong><small>{r.codigo_interno}</small><Badge value={r.status} /></td><td>{r.saldo_disponivel}</td><td>{r.em_operacao}</td><td>{r.saldo_conferencia}</td><td>{r.saldo_manutencao}</td>{manager && <td><button className="button secondary" onClick={() => { key.current = crypto.randomUUID(); setAdjust({ material_id: r.id, nome: r.nome, tipo: 'LIBERAR', origem: 'CONFERENCIA', quantidade: 1, justificativa: '' }); setMessage(''); }}>Conferir / ajustar</button></td>}</tr>)}</tbody>
        </table></div>
        {!list.data.items.length && <Empty />}
        <Pager page={page} total={list.data.total} onChange={setPage} />
      </section>
      {(form || adjust) && <Modal title={form ? 'Cadastrar material por quantidade' : 'Liberar ou ajustar saldo'} onClose={() => { setForm(null); setAdjust(null); }}><Notice message={message} /><form onSubmit={save}><div className="form-grid">{form ? <><label className="wide">Nome<input required maxLength={255} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label><label>Código interno<input required maxLength={255} value={form.codigo_interno} onChange={e => setForm({ ...form, codigo_interno: e.target.value })} /></label><label>Saldo inicial<input required type="number" inputMode="numeric" min={0} max={1000000} value={form.saldo_inicial} onChange={e => setForm({ ...form, saldo_inicial: Number(e.target.value) })} /></label></> : <><label className="wide">Operação<select value={adjust.tipo} onChange={e => { key.current = crypto.randomUUID(); setAdjust({ ...adjust, tipo: e.target.value }); }}><option value="LIBERAR">Liberar unidades conferidas</option><option value="AJUSTE">Ajustar saldo disponível</option></select></label>{adjust.tipo === 'LIBERAR' && <label>Origem<select value={adjust.origem} onChange={e => { key.current = crypto.randomUUID(); setAdjust({ ...adjust, origem: e.target.value }); }}><option value="CONFERENCIA">Aguardando conferência</option><option value="MANUTENCAO">Manutenção concluída</option></select></label>}<label>{adjust.tipo === 'AJUSTE' ? 'Variação de saldo (+ / −)' : 'Quantidade a liberar'}<input required type="number" min={adjust.tipo === 'AJUSTE' ? -1000000 : 1} max={1000000} value={adjust.quantidade} onChange={e => { key.current = crypto.randomUUID(); setAdjust({ ...adjust, quantidade: Number(e.target.value) }); }} /></label><label className="wide">Justificativa<textarea required maxLength={4000} value={adjust.justificativa} onChange={e => { key.current = crypto.randomUUID(); setAdjust({ ...adjust, justificativa: e.target.value }); }} /></label></>}</div><div className="form-actions"><button className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar'}</button></div></form></Modal>}
    </>
  );
}

// ---- Sub-componente: Histórico -----------------------------------------------
function AbaHistorico() {
  const [search, setSearch] = useState(''), [type, setType] = useState(''), [from, setFrom] = useState(''), [until, setUntil] = useState(''), [page, setPage] = useState(1);
  const list = useResource<any>('/historico', { paginado: 'true', busca: search, tipo: type, data_inicio: from, data_fim: until, page, limit: 30 }, { items: [], total: 0 });
  function detail(value: string) { try { const parsed = JSON.parse(value); return parsed.quantidade ? 'Quantidade: ' + parsed.quantidade + (parsed.condicao ? ' · ' + parsed.condicao : '') : value; } catch { return value; } }
  return (
    <>
      <div className="filters">
        <label className="search">Pesquisar<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Material, colaborador, código ou operador" /></label>
        <label>Tipo<select value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">Todos</option><option value="SAIDA">Retiradas</option><option value="ENTRADA">Devoluções</option><option value="MANUTENCAO">Manutenções</option></select></label>
        <label>De<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /></label>
        <label>Até<input type="date" value={until} onChange={e => { setUntil(e.target.value); setPage(1); }} /></label>
      </div>
      <section className="panel">
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Data / hora</th><th>Tipo</th><th>Material</th><th>Colaborador</th><th>Operador</th><th>Observações</th></tr></thead>
          <tbody>{list.data.items.map((r: any) => <tr key={r.id}><td>{dateTime(r.data_hora)}</td><td><Badge value={r.tipo === 'SAIDA' ? 'Retirada' : r.tipo === 'ENTRADA' ? 'Devolução' : 'Manutenção'} /></td><td><strong>{r.material_nome}</strong><small>{r.material_codigo}</small></td><td><strong>{r.colaborador_nome}</strong><small>{r.colaborador_matricula}</small></td><td>{r.operador_nome}</td><td>{detail(r.observacao)}</td></tr>)}</tbody>
        </table></div>
        {!list.data.items.length && <Empty>{list.loading ? 'Consultando histórico…' : 'Nenhuma movimentação para os filtros selecionados.'}</Empty>}
        <Pager page={page} total={list.data.total} onChange={setPage} />
      </section>
    </>
  );
}

// ---- Página unificada: Operações ----------------------------------------------
const TABS = [
  { id: 'extravios', label: 'Extravios & Pendências', icon: SearchCheck },
  { id: 'quantidades', label: 'Materiais por Quantidade', icon: Package },
  { id: 'historico', label: 'Histórico', icon: Clock },
] as const;

type TabId = typeof TABS[number]['id'];

export function Operacoes({ user }: { user: Usuario }) {
  const [tab, setTab] = useState<TabId>('extravios');

  // Reload control (one reload button no topo)
  const listExtravios = useResource<any>('/operacao/extravios', {}, { items: [], total: 0 });
  const listQuantidades = useResource<any>('/quantidades', {}, { items: [], total: 0 });
  const listHistorico = useResource<any>('/historico', {}, { items: [], total: 0 });

  function handleReload() {
    if (tab === 'extravios') listExtravios.reload();
    else if (tab === 'quantidades') listQuantidades.reload();
    else listHistorico.reload();
  }

  const reloading = tab === 'extravios' ? listExtravios.loading : tab === 'quantidades' ? listQuantidades.loading : listHistorico.loading;

  return (
    <Page
      title="Operações"
      description="Extravios e pendências, materiais por quantidade e histórico de movimentações."
      action={<Reload onClick={handleReload} loading={reloading} />}
    >
      {/* Tabs de navegação */}
      <div className="tabs" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={'tab ' + (tab === id ? 'active' : '')}
            onClick={() => setTab(id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 48, padding: '10px 20px', fontSize: 13 }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba ativa */}
      {tab === 'extravios' && <AbaExtravios user={user} />}
      {tab === 'quantidades' && <AbaQuantidades user={user} />}
      {tab === 'historico' && <AbaHistorico />}
    </Page>
  );
}
