import { useState, useRef } from 'react';
import { DoorOpen, LogIn, LogOut, Search } from 'lucide-react';
import { Usuario } from '../types';
import { useResource, notifyChange } from '../hooks/useResource';
import { NfcReaderModal } from '../components/NfcReaderModal';
import { soundFX } from '../services/soundFX';
import { api } from '../services/api';
import { Page, Notice, Person, Badge, Reload, Empty, dateTime, canOperate, errorMessage, Pager } from '../components/ui';
export function Acessos({ user }: { user?: Usuario }) {
  const { data, error, loading, reload, updated } = useResource<any>('/operacao/acessos', {}, { colaboradores: [], dentro_mina: 0, quantidade: 0 }, 15000);
  const [code, setCode] = useState(''), [person, setPerson] = useState<any>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState(''), [destino, setDestino] = useState(''), [tab, setTab] = useState('ativos'), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const pending = useRef(false);
  const [nfc,setNfc]=useState(false);
  const history = useResource<any>('/operacao/acessos/historico', { busca: search, page }, { items: [], total: 0 });
  async function identify(e: React.FormEvent) {
    e.preventDefault(); setMessage(''); setSuccess(''); setPerson(null); setBusy(true);
    try { const res = await api.get('/colaboradores/nfc/' + encodeURIComponent(code.trim())); const compliance = await api.get('/operacao/conformidade/' + res.data.id); setPerson({ ...res.data, conformidade: compliance.data.situacao }); }
    catch(e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  }
  async function register(type: string, collaborator = person) {
    if (!collaborator || pending.current) return; pending.current = true; setBusy(true); setMessage(''); setSuccess('');
    try { await api.post('/operacao/acessos', { colaborador_id: collaborator.id, tipo: type, destino }); soundFX.playSuccess();setSuccess(type === 'ENTRADA' ? 'Entrada na mina registrada.' : 'Saída da mina registrada.'); setPerson(null); setCode(''); notifyChange(); }
    catch(e) { setMessage(errorMessage(e)); } finally { pending.current = false; setBusy(false); }
  }
  return <Page title="Acesso à mina" description="Registre a entrada e a saída efetiva de cada colaborador." action={<Reload onClick={reload} loading={loading} />}>
    <NfcReaderModal isOpen={nfc} onClose={()=>setNfc(false)} onNfcRead={async(_,person)=>{if(!person)return;const compliance=await api.get('/operacao/conformidade/'+person.id);setPerson({...person,conformidade:compliance.data.situacao});setCode(person.matricula);setMessage('');setSuccess('');setNfc(false);}}/>
    <Notice message={message || error || history.error} /><Notice message={success} type="success" />
    <div className="metric-grid"><div className="metric"><div>Dentro da mina<DoorOpen size={20} /></div><strong>{data.dentro_mina}</strong><small>Acessos em aberto</small></div><div className="metric"><div>Permanência acima de 8h</div><strong>{data.quantidade}</strong><small>Atualização: {updated || 'aguardando'}</small></div></div>
    {user && canOperate(user.nivel_acesso) && <section className="panel"><div className="panel-heading"><div><h2>Registrar acesso</h2><p>Leia o crachá ou digite a matrícula.</p></div><button className="button primary" onClick={()=>setNfc(true)}>Aproximar crachá NFC</button></div><div className="panel-content"><form onSubmit={identify} className="inline-form"><input aria-label="Matrícula ou NFC" placeholder="Matrícula ou cartão NFC" value={code} onChange={e=>setCode(e.target.value)} required maxLength={255}/><button className="button primary" disabled={busy}><Search size={18}/>Identificar</button></form>{person && <div className="selected-person"><Person person={person}/><label>Destino<input value={destino} onChange={e=>setDestino(e.target.value)} maxLength={255} placeholder="Local ou operação"/></label><button className="button primary" disabled={busy || person.conformidade !== 'CONFORME'} onClick={()=>register('ENTRADA')}><LogIn size={18}/>Entrada na mina</button><button className="button secondary" disabled={busy} onClick={()=>register('SAIDA')}><LogOut size={18}/>Saída da mina</button></div>}</div></section>}
    <div className="tabs"><button className={'tab ' + (tab === 'ativos' ? 'active' : '')} onClick={()=>setTab('ativos')}>Dentro da mina</button><button className={'tab ' + (tab === 'historico' ? 'active' : '')} onClick={()=>setTab('historico')}>Histórico de acessos</button></div>
    {tab === 'ativos' ? <section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Colaborador</th><th>Entrada</th><th>Permanência</th><th>Destino</th>{user && canOperate(user.nivel_acesso) && <th>Ação</th>}</tr></thead><tbody>{data.colaboradores.map((c:any)=><tr key={c.id}><td><Person person={c}/></td><td>{dateTime(c.entrada)}</td><td><strong style={{color:c.excedido?'#bb3838':undefined}}>{c.tempo}</strong>{c.excedido && <small>Mais de oito horas</small>}</td><td>{c.destino || '—'}</td>{user && canOperate(user.nivel_acesso) && <td><button className="button secondary" disabled={busy} onClick={()=>register('SAIDA', {...c,id:c.colaborador_id})}>Registrar saída</button></td>}</tr>)}</tbody></table></div>{!data.colaboradores.length && <Empty>{loading?'Consultando acessos…':'Nenhum acesso em aberto.'}</Empty>}</section>
    : <><input aria-label="Buscar acessos" placeholder="Nome ou matrícula" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Colaborador</th><th>Entrada</th><th>Saída</th><th>Destino</th></tr></thead><tbody>{history.data.items.map((c:any)=><tr key={c.id}><td><strong>{c.nome}</strong><small>{c.matricula} · {c.setor}</small></td><td>{dateTime(c.entrada)}</td><td>{c.saida ? dateTime(c.saida) : <Badge value="EM_OPERACAO"/>}</td><td>{c.destino || '—'}</td></tr>)}</tbody></table></div>{!history.data.items.length && <Empty/>}<Pager page={page} total={history.data.total} onChange={setPage}/></section></>}
    <p className="summary-note">O registro de materiais e o acesso à mina são independentes. Este painel apoia a operação e não substitui os procedimentos oficiais de segurança.</p>
  </Page>;
}
