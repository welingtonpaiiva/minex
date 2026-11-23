import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DoorOpen, LogIn, LogOut, Monitor, Search } from 'lucide-react';
import { Usuario } from '../types';
import { useResource, notifyChange } from '../hooks/useResource';
import { NfcReaderModal } from '../components/NfcReaderModal';
import { MonitoringProfile } from '../components/MonitoringProfile';
import { useMineMonitoring } from '../hooks/useMineMonitoring';
import { elapsedLabel, orderPeople } from '../components/monitoringModel';
import { soundFX } from '../services/soundFX';
import { api } from '../services/api';
import { Page, Notice, Person, Badge, Reload, Empty, dateTime, canOperate, errorMessage, Pager } from '../components/ui';
export function Acessos({ user }: { user?: Usuario }) {
  const [params, setParams] = useSearchParams();
  const [profileId, setProfileId] = useState<number | null>(null);
  const selectedProfile = params.get('colaborador');
  useEffect(() => {
    const value = Number(selectedProfile);
    setProfileId(Number.isSafeInteger(value) && value > 0 ? value : null);
  }, [selectedProfile]);
  function closeProfile() {
    setProfileId(null);
    if (selectedProfile) setParams(current => { const next = new URLSearchParams(current); next.delete('colaborador'); return next; }, { replace: true });
  }
  const { snapshot, error, now, lastUpdate } = useMineMonitoring();
  const monitored = orderPeople(snapshot?.colaboradores || [], now, snapshot?.limite_segundos || 21600);
  const data = { colaboradores: monitored.map(person => ({ ...person, id: person.acesso_id, tempo: elapsedLabel(person.seconds), excedido: person.critical })),
    dentro_mina: monitored.length, quantidade: monitored.filter(person => person.critical).length };
  const loading = !snapshot && !error, reload = notifyChange;
  const updated = lastUpdate ? new Date(lastUpdate).toLocaleTimeString('pt-BR', { timeZone: snapshot?.fuso_horario || 'America/Sao_Paulo' }) : '';
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
  return <Page title="Acesso à mina" description="Acompanhe os acessos e a presença por retirada de máscara de fuga." action={<div className="access-page-actions"><Link className="button secondary" to="/dashboard"><Monitor size={18} />Dashboard e modo TV</Link><Reload onClick={reload} loading={loading} /></div>}>
    {profileId !== null && <MonitoringProfile key={profileId} personId={profileId} onClose={closeProfile} />}
    <NfcReaderModal isOpen={nfc} onClose={()=>setNfc(false)} onNfcRead={async(_,person)=>{if(!person)return;const compliance=await api.get('/operacao/conformidade/'+person.id);setPerson({...person,conformidade:compliance.data.situacao});setCode(person.matricula);setMessage('');setSuccess('');setNfc(false);}}/>
    <Notice message={message || error || history.error} /><Notice message={success} type="success" />
    <div className="metric-grid"><div className="metric"><div>Dentro da mina<DoorOpen size={20} /></div><strong>{snapshot ? data.dentro_mina : '—'}</strong><small>Mesmos registros exibidos no dashboard</small></div><div className="metric"><div>Permanência acima de 6h</div><strong>{snapshot ? data.quantidade : '—'}</strong><small>Atualização: {updated || 'aguardando'}</small></div></div>
    {user && canOperate(user.nivel_acesso) && <section className="panel"><div className="panel-heading"><div><h2>Registrar acesso</h2><p>Leia o crachá ou digite a matrícula.</p></div><button className="button primary" onClick={()=>setNfc(true)}>Aproximar crachá NFC</button></div><div className="panel-content"><form onSubmit={identify} className="inline-form"><input aria-label="Matrícula ou NFC" placeholder="Matrícula ou cartão NFC" value={code} onChange={e=>setCode(e.target.value)} required maxLength={255}/><button className="button primary" disabled={busy}><Search size={18}/>Identificar</button></form>{person && <div className="selected-person"><Person person={person}/><label>Destino<input value={destino} onChange={e=>setDestino(e.target.value)} maxLength={255} placeholder="Local ou operação"/></label><button className="button primary" disabled={busy || person.conformidade !== 'CONFORME'} onClick={()=>register('ENTRADA')}><LogIn size={18}/>Entrada na mina</button><button className="button secondary" disabled={busy} onClick={()=>register('SAIDA')}><LogOut size={18}/>Saída da mina</button></div>}</div></section>}
    <div className="tabs"><button className={'tab ' + (tab === 'ativos' ? 'active' : '')} onClick={()=>setTab('ativos')}>Dentro da mina</button><button className={'tab ' + (tab === 'historico' ? 'active' : '')} onClick={()=>setTab('historico')}>Histórico de acessos</button></div>
    {tab === 'ativos' ? <section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Colaborador</th><th>Entrada</th><th>Permanência</th><th>Destino</th>{user && canOperate(user.nivel_acesso) && <th>Ação</th>}</tr></thead><tbody>{data.colaboradores.map((c:any)=><tr key={c.id}><td><button type="button" className="access-person-button" aria-label={'Abrir perfil de ' + c.nome} onClick={() => setProfileId(c.colaborador_id)}><Person person={c}/></button>{c.possui_mascara_fuga && <small>Máscara de fuga em posse</small>}</td><td>{dateTime(c.entrada)}</td><td><strong style={{color:c.excedido?'#bb3838':undefined}}>{c.tempo}</strong>{c.excedido && <small>Mais de seis horas</small>}</td><td>{c.destino || '—'}</td>{user && canOperate(user.nivel_acesso) && <td>{c.origem === 'MASCARA_FUGA' ? <Link className="button secondary" to="/entrada">Devolver máscara</Link> : <button className="button secondary" disabled={busy} onClick={()=>register('SAIDA', {...c,id:c.colaborador_id})}>Registrar saída</button>}</td>}</tr>)}</tbody></table></div>{!data.colaboradores.length && <Empty>{loading?'Consultando acessos…':'Nenhum acesso em aberto.'}</Empty>}</section>
    : <><input aria-label="Buscar acessos" placeholder="Nome ou matrícula" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Colaborador</th><th>Entrada</th><th>Saída</th><th>Destino</th></tr></thead><tbody>{history.data.items.map((c:any)=><tr key={c.id}><td><strong>{c.nome}</strong><small>{c.matricula} · {c.setor}</small></td><td>{dateTime(c.entrada)}</td><td>{c.saida ? dateTime(c.saida) : <Badge value="EM_OPERACAO"/>}</td><td>{c.destino || '—'}</td></tr>)}</tbody></table></div>{!history.data.items.length && <Empty/>}<Pager page={page} total={history.data.total} onChange={setPage}/></section></>}
    <p className="summary-note">Quem estiver com máscara de fuga retirada é considerado dentro da mina. A presença automática termina após a devolução de todas as máscaras; acessos manuais abertos também precisam ser encerrados. Este painel apoia a operação e não substitui os procedimentos oficiais de segurança.</p>
  </Page>;
}
