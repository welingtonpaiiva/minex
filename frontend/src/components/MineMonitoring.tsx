import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, DoorOpen, FlaskConical, HardHat, Minimize2, ShieldPlus, Tv, UsersRound, WifiOff } from 'lucide-react';
import { useMineMonitoring, useMonitoringPhotos } from '../hooks/useMineMonitoring';
import { elapsedLabel, monitorPage, MonitorBrigadist, orderPeople, TimedPerson } from './monitoringModel';
import { MonitoringPortrait as Portrait } from './MonitoringPortrait';
import { MonitoringProfile } from './MonitoringProfile';
import { monitoringDemo } from './monitoringDemo';
import './MineMonitoring.css';

const ROTATION_MS = 12000;
function CollaboratorCard({ person, photo, timeFormat, onProfile }: { person: TimedPerson; photo: string; timeFormat: Intl.DateTimeFormat; onProfile: () => void }) {
  return <article className={'mine-access-card ' + (person.invalid ? 'is-invalid' : person.critical ? 'is-critical' : 'is-normal')} aria-label={'Permanência de ' + person.nome} data-person-id={person.colaborador_id} data-critical={person.critical}>
    <div className="mine-access-main"><Portrait name={person.nome} src={photo} /><div className="mine-access-details">
      <span className="mine-state">{person.invalid ? <AlertTriangle size={13} /> : person.critical ? <AlertTriangle size={13} /> : <span />}{person.invalid ? 'CONFERIR HORÁRIO' : person.critical ? '> 6 HORAS' : 'DENTRO DO LIMITE'}</span>
      <h2 title={person.nome}>{person.nome}</h2><p className="mine-access-role" title={person.cargo || 'Função não informada'}>{person.cargo || 'Função não informada'}</p>
      <dl><div><dt>Matrícula:</dt><dd>{person.matricula}</dd></div><div><dt>Empresa:</dt><dd title={person.empresa}>{person.empresa || 'Não informada'}</dd></div><div><dt>Turma:</dt><dd>{person.turma || 'Não informada'}</dd></div></dl>
    </div></div>
    <div className="mine-access-time"><span><Clock3 size={13} />Entrada: <strong>{person.entrada ? timeFormat.format(new Date(person.entrada)) : 'Não informada'}</strong></span><time className="mine-elapsed" aria-label={'Tempo de permanência de ' + person.nome}>{elapsedLabel(person.seconds)}</time></div>
    <button type="button" className="mine-open-profile" aria-label={'Abrir perfil de ' + person.nome} title="Clique para ver o perfil e os acessos" onClick={onProfile} />
  </article>;
}

function Brigadist({ person, photo, onProfile }: { person: MonitorBrigadist; photo: string; onProfile: () => void }) {
  return <article className="mine-brigadist" aria-label={'Brigadista ' + person.nome}><Portrait name={person.nome} src={photo} /><div><h3 title={person.nome}>{person.nome}</h3><p title={person.brigada_especialidade || person.cargo}>{person.brigada_especialidade || person.cargo || 'Especialidade não informada'}</p><span>Matrícula: {person.matricula}</span><span>Turma: {person.turma || 'Não informada'}</span><b className="mine-presence">NA MINA</b>{person.habilitacao !== 'VIGENTE' && <small className={person.habilitacao === 'VENCIDA' ? 'is-expired' : ''}>{person.habilitacao === 'VENCIDA' ? 'HABILITAÇÃO VENCIDA' : 'HABILITAÇÃO NÃO INFORMADA'}</small>}{person.status !== 'ATIVO' && <small className="is-expired">CADASTRO INATIVO</small>}</div><button type="button" className="mine-open-profile" aria-label={'Abrir perfil do brigadista ' + person.nome} onClick={onProfile} /></article>;
}

export function MineMonitoring() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const demo = params.get('demo') === '1', tv = params.get('tv') === '1';
  const live = useMineMonitoring(!demo);
  const [demoStarted, setDemoStarted] = useState(Date.now);
  const demoData = useMemo(() => monitoringDemo(demoStarted), [demoStarted]);
  const snapshot = demo ? demoData : live.snapshot, error = demo ? '' : live.error, now = live.now;
  const lastUpdate = demo ? demoStarted : live.lastUpdate;
  const [profileId, setProfileId] = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const nativeFullscreen = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (nativeFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  function changeMode(key: string, active: boolean) {
    setParams(current => { const next = new URLSearchParams(current); if (active) next.set(key, '1'); else next.delete(key); return next; });
  }
  function toggleDemo() {
    setDemoStarted(Date.now()); setProfileId(null); setPageTick(0); setBrigadePage(0); changeMode('demo', !demo);
  }
  function exitTv() {
    changeMode('tv', false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }
  function enterTv() {
    setProfileId(null); changeMode('tv', true);
    void document.documentElement.requestFullscreen?.().then(() => {
      nativeFullscreen.current = true;
      if (!mounted.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }).catch(() => {});
  }
  useEffect(() => {
    const fullscreen = () => { if (document.fullscreenElement) nativeFullscreen.current = true; else if (nativeFullscreen.current) { nativeFullscreen.current = false; changeMode('tv', false); } };
    document.addEventListener('fullscreenchange', fullscreen);
    return () => document.removeEventListener('fullscreenchange', fullscreen);
  }, [setParams]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && tv && profileId === null) exitTv(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [tv, profileId, setParams]);
  useEffect(() => {
    if (!tv || !controlsVisible) return;
    const timeout = setTimeout(() => setControlsVisible(false), 3000);
    return () => clearTimeout(timeout);
  }, [tv, controlsVisible]);
  useEffect(() => { setControlsVisible(true); }, [tv]);
  const grid = useRef<HTMLDivElement>(null), brigadeList = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ columns: 4, rows: 4, height: 180, gap: 10 });
  const [pageTick, setPageTick] = useState(0), [brigadePage, setBrigadePage] = useState(0), [brigadeCapacity, setBrigadeCapacity] = useState(3);
  useEffect(() => {
    const resize = () => {
      const area = grid.current, sidebar = brigadeList.current;
      const unit = Math.max(1, Math.min(1.8, window.innerHeight / 1080)), gap = 10 * unit;
      if (area) {
        const columns = Math.max(1, Math.min(4, Math.floor((area.clientWidth + gap) / (320 * unit + gap))));
        const rows = Math.max(1, Math.floor((area.clientHeight + gap) / (174 * unit + gap)));
        setLayout({ columns, rows, height: Math.max(174 * unit, (area.clientHeight - gap * (rows - 1)) / rows), gap });
      }
      if (sidebar) setBrigadeCapacity(Math.max(1, Math.floor(sidebar.clientHeight / (165 * unit))));
    };
    const observer = new ResizeObserver(resize);
    if (grid.current) observer.observe(grid.current);
    if (brigadeList.current) observer.observe(brigadeList.current);
    window.addEventListener('resize', resize); resize();
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    if (profileId !== null) return;
    const timer = setInterval(() => { setPageTick(value => value + 1); setBrigadePage(value => value + 1); }, ROTATION_MS);
    return () => clearInterval(timer);
  }, [profileId]);
  const zone = snapshot?.fuso_horario || 'America/Sao_Paulo';
  const formats = useMemo(() => ({
    weekday: new Intl.DateTimeFormat('pt-BR', { timeZone: zone, weekday: 'long' }),
    date: new Intl.DateTimeFormat('pt-BR', { timeZone: zone, day: '2-digit', month: 'long', year: 'numeric' }),
    clock: new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    entry: new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  }), [zone]);
  const people = useMemo(() => orderPeople(snapshot?.colaboradores || [], now, snapshot?.limite_segundos || 21600), [snapshot, now]);
  const critical = people.filter(person => person.critical).length, normal = people.filter(person => !person.critical && !person.invalid).length;
  const invalid = people.filter(person => person.invalid).length;
  const selection = monitorPage(people, layout.columns * layout.rows, pageTick);
  const brigade = snapshot?.brigadistas;
  const brigadePages = Math.max(1, Math.ceil((brigade?.presentes.length || 0) / brigadeCapacity));
  const brigadeVisible = brigade?.presentes.slice((brigadePage % brigadePages) * brigadeCapacity, ((brigadePage % brigadePages) + 1) * brigadeCapacity) || [];
  const photo = useMonitoringPhotos([...selection.visible.map(person => person.foto_url), ...brigadeVisible.map(person => person.foto_url)]);
  useEffect(() => { if (grid.current) grid.current.scrollTop = 0; }, [selection.overflow, selection.fixedCount]);
  useEffect(() => {
    const region = grid.current;
    if (!region || !selection.overflow || profileId !== null) return;
    // A saturated display is identified explicitly; critical records never join regular pagination.
    const timer = setInterval(() => {
      region.scrollTo({ top: region.scrollTop + region.clientHeight >= region.scrollHeight - 4 ? 0 : region.scrollTop + region.clientHeight - 12,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, ROTATION_MS);
    return () => clearInterval(timer);
  }, [selection.overflow, selection.fixedCount, profileId]);
  const metrics = [
    { label: 'COLABORADORES NA MINA', value: people.length, icon: UsersRound, tone: 'purple' },
    { label: 'DENTRO DO LIMITE', note: '(≤ 6 HORAS)', value: normal, icon: CheckCircle2, tone: 'green' },
    { label: 'ACIMA DO LIMITE', note: '(> 6 HORAS)', value: critical, icon: AlertTriangle, tone: 'red' },
    { label: 'BRIGADISTAS NA MINA', value: brigade?.na_mina || 0, icon: ShieldPlus, tone: 'blue' }
  ];
  const date = new Date(now);
  return <div className={'monitoring-screen' + (tv ? ' is-tv' : '')} onMouseMove={event => { if (tv && event.clientY < 85) setControlsVisible(true); }}>
    {!tv ? <nav className="monitoring-toolbar" aria-label="Navegação do dashboard"><Link to="/"><ArrowLeft size={17} />Menu principal</Link><Link to="/acessos"><DoorOpen size={18} />Acesso à Mina</Link><span className="monitoring-toolbar-space" /><button type="button" className={demo ? 'is-demo' : ''} onClick={toggleDemo}><FlaskConical size={17} />{demo ? 'Voltar aos dados reais' : 'Dados de teste'}</button><button type="button" onClick={enterTv}><Tv size={18} />Modo TV</button></nav>
      : <div className={'monitoring-tv-controls' + (controlsVisible ? ' is-visible' : '')}><button type="button" onClick={exitTv}><Minimize2 size={17} />Sair do modo TV</button><span>Esc para sair · Clique em uma pessoa para abrir o perfil</span></div>}
    <div className="mine-monitor" data-monitor-state={demo ? 'demo' : error ? 'stale' : snapshot ? 'live' : 'loading'} data-view-mode={tv ? 'tv' : 'dashboard'}>
    <aside className="mine-brigade-sidebar" aria-label="Brigadistas na mina">
      <div className="mine-brand"><img src="/logowhite.png" alt="CMOC" /><strong>MINA SUBTERRÂNEA</strong><span>PAINEL DE ACESSO</span></div>
      <h2 className="mine-brigade-title"><HardHat size={32} />BRIGADISTAS</h2>
      <div className="mine-brigade-list" ref={brigadeList}>{brigadeVisible.map(person => <Brigadist key={person.colaborador_id} person={person} photo={photo(person.foto_url)} onProfile={() => setProfileId(person.colaborador_id)} />)}{!brigadeVisible.length && <div className="mine-brigade-empty"><ShieldPlus size={38} /><p>{!snapshot ? 'Consultando a brigada…' : brigade?.total ? 'Nenhum brigadista registrado dentro da mina.' : 'Nenhum brigadista identificado no cadastro.'}</p></div>}</div>
      {brigadePages > 1 && <span className="mine-brigade-page">BRIGADISTAS · {brigadePage % brigadePages + 1} / {brigadePages}</span>}
      <section className="mine-brigade-summary" aria-label="Total de brigadistas"><h3><UsersRound size={23} />TOTAL DE BRIGADISTAS</h3><dl><div><dt><i />Na mina</dt><dd>{snapshot ? brigade?.na_mina : '—'}</dd></div><div><dt><i />Fora da mina</dt><dd>{snapshot ? brigade?.fora_mina : '—'}</dd></div><div><dt>Total cadastrado</dt><dd>{snapshot ? brigade?.total : '—'}</dd></div></dl><p>Presença física não representa habilitação vigente.</p></section>
    </aside>
    <section className="mine-monitor-main" aria-label="Monitoramento de acesso à mina">
      <header className="mine-monitor-header"><div><h1>COLABORADORES NA MINA</h1><span className={'mine-live-state ' + (demo ? 'is-demo' : error ? 'is-offline' : !snapshot ? 'is-loading' : '')}>{demo ? <FlaskConical size={14} /> : error ? <WifiOff size={14} /> : <i />}{demo ? 'MODO TESTE · DADOS E FOTOS FICTÍCIOS' : error ? 'DADOS DESATUALIZADOS' : snapshot ? 'EM TEMPO REAL' : 'CONECTANDO AO SISTEMA'}</span></div><div className="mine-operational-clock"><div><span>{formats.weekday.format(date)}</span><span>{formats.date.format(date)}</span></div><time aria-label="Relógio operacional">{formats.clock.format(date)}</time></div></header>
      <section className="mine-metrics" aria-label="Indicadores operacionais">{metrics.map(({ label, note, value, icon: Icon, tone }) => <article className={'mine-metric ' + tone} key={label} aria-label={label}><span><Icon /></span><div><strong>{snapshot ? value : '—'}</strong><p>{label}{note && <small>{note}</small>}</p></div></article>)}</section>
      <div className={'mine-alert-band ' + (error ? 'has-data-warning' : critical ? 'is-critical' : invalid ? 'has-data-warning' : 'is-normal')} role={error || critical || invalid ? 'alert' : 'status'}>
        <span>{error || critical || invalid ? <AlertTriangle /> : <CheckCircle2 />}</span><div><strong>{error ? 'ATENÇÃO: DADOS PODEM ESTAR DESATUALIZADOS — RECONECTANDO AUTOMATICAMENTE' : !snapshot ? 'CONSULTANDO OS REGISTROS DE ACESSO À MINA' : critical ? `ATENÇÃO: ${critical} ${critical === 1 ? 'COLABORADOR EXCEDEU' : 'COLABORADORES EXCEDERAM'} O TEMPO PADRÃO DE TURNO (> 6 HORAS)` : invalid ? 'ATENÇÃO: EXISTEM REGISTROS COM HORÁRIO DE ENTRADA INCONSISTENTE' : people.length ? 'TODOS OS COLABORADORES ESTÃO DENTRO DO LIMITE DE PERMANÊNCIA' : 'NENHUM COLABORADOR REGISTRADO DENTRO DA MINA'}</strong><p>{error ? lastUpdate ? `Última posição recebida às ${formats.clock.format(new Date(lastUpdate))}. Os contadores seguem a partir dos registros disponíveis.` : 'Aguardando comunicação com o servidor. Nenhuma posição atual confirmada.' : `Tempo de permanência contado desde o momento da entrada na mina.${invalid ? ` ${invalid} registro(s) aguardando conferência de horário.` : ''}`}</p></div>
      </div>
      <div className={'mine-grid-region ' + (selection.overflow ? 'is-overflow' : '')} ref={grid}>
        {selection.visible.length ? <div className="mine-access-grid" style={{ '--monitor-columns': layout.columns, '--monitor-card-height': `${layout.height}px`, '--monitor-gap': `${layout.gap}px` } as CSSProperties}>{selection.visible.map(person => <CollaboratorCard key={person.acesso_id} person={person} photo={photo(person.foto_url)} timeFormat={formats.entry} onProfile={() => setProfileId(person.colaborador_id)} />)}</div> : <div className="mine-monitor-empty"><HardHat size={58} /><h2>{!snapshot ? 'Carregando a posição da mina' : 'Nenhum acesso em aberto'}</h2><p>{!snapshot ? 'Os dados aparecerão assim que a conexão for confirmada.' : 'Novas entradas registradas no sistema aparecerão automaticamente.'}</p></div>}
      </div>
      <footer className="mine-monitor-footer"><span>{selection.overflow ? `CAPACIDADE VISUAL EXCEDIDA · ${selection.fixedCount} REGISTROS EM ATENÇÃO · EXIBIÇÃO CONTÍNUA DA LISTA PRIORITÁRIA` : selection.pages > 1 ? `EXIBIÇÃO AUTOMÁTICA · ${selection.page + 1} / ${selection.pages} · CRÍTICOS MANTIDOS EM DESTAQUE` : selection.waiting ? `${selection.waiting} COLABORADOR(ES) DENTRO DO LIMITE · ESPAÇO RESERVADO AOS REGISTROS EM ATENÇÃO` : 'MONITORAMENTO CONTÍNUO DE ACESSO À MINA'}</span><span>{error ? 'CONEXÃO INTERROMPIDA' : lastUpdate ? `SINCRONIZADO ÀS ${formats.clock.format(new Date(lastUpdate))}` : 'AGUARDANDO DADOS'} · {zone}</span></footer>
    </section>
    </div>
    {demo && <div className="monitoring-demo-label" role="status">DEMONSTRAÇÃO · DADOS FICTÍCIOS · SEM ALTERAÇÃO NOS ACESSOS REAIS</div>}
    {profileId !== null && <MonitoringProfile key={profileId} personId={profileId} demoPerson={demo ? demoData.colaboradores.find(person => person.colaborador_id === profileId) : undefined} onClose={() => setProfileId(null)} onOpenAccess={() => navigate('/acessos?colaborador=' + profileId)} />}
  </div>;
}
