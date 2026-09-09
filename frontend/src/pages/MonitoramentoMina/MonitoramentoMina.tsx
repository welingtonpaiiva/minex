import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor, Users, ArrowRightToLine, ArrowLeftToLine,
  AlertTriangle, FlaskConical, Search, Filter,
  ChevronLeft, ChevronRight, Radio, Pause, Play
} from 'lucide-react';
import { api } from '../../services/api';
import { ColaboradorCardCompacto } from './components/ColaboradorCardCompacto';
import { ColaboradorSidePanel } from './components/ColaboradorSidePanel';
import clsx from 'clsx';

// ─── MOCK DATA — 35 colaboradores para teste visual ───────────────────────────
const now = Date.now();
const h = (n: number) => new Date(now - n * 3600000).toISOString();

const MOCK_ATIVOS_RAW = [
  { acesso_id:'T01', nome:'CARLOS EDUARDO SILVA', matricula:'1234', cargo:'Operador de Mina', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(2.5), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea' }] },
  { acesso_id:'T02', nome:'MARCOS ANTONIO FERREIRA', matricula:'5678', cargo:'Técnico de Segurança', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(4.1), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T03', nome:'ANA PAULA RODRIGUES', matricula:'9012', cargo:'Geóloga Sr.', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(1.2), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Detector Multi-Gás' },{ nome:'Rádio Comunicador IS' }] },
  { acesso_id:'T04', nome:'ROBERTO SOUZA LIMA', matricula:'3456', cargo:'Mecânico Industrial', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(7.3), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12' }] },
  { acesso_id:'T05', nome:'ANTONIO CARLOS FERNANDES DE OLIVEIRA', matricula:'7890', cargo:'Supervisor de Operações', setor:'OPERAÇÃO', status:'ATIVO', data_hora_entrada:h(8.1), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T06', nome:'GUILHERME HENRIQUE MARTINS DA SILVA', matricula:'2345', cargo:'Eletricista', setor:'ELÉTRICA', status:'ATIVO', data_hora_entrada:h(3.7), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Multímetro Intrínseco' }] },
  { acesso_id:'T07', nome:'FERNANDA CRISTINA ALVES', matricula:'6789', cargo:'Técnica de Geologia', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(2.0), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T08', nome:'PAULO ROBERTO MENDES', matricula:'1122', cargo:'Técnico de Gases', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(5.5), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Medidor O2 e CO' }] },
  { acesso_id:'T09', nome:'LUCAS GABRIEL PEREIRA', matricula:'3344', cargo:'Operador de Equipamentos', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(0.8), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea' }] },
  { acesso_id:'T10', nome:'FERNANDA AUGUSTO RODRIGUES PEREIRA', matricula:'5566', cargo:'Técnico de Instrumentação', setor:'INSTRUMENTAÇÃO', status:'ATIVO', data_hora_entrada:h(6.2), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T11', nome:'RAFAEL SOUZA BARBOSA', matricula:'7788', cargo:'Técnico de Manutenção', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(3.3), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Auto-Resgatador Subterrâneo' }] },
  { acesso_id:'T12', nome:'CAMILA SANTOS OLIVEIRA', matricula:'9900', cargo:'Técnica de Drenagem', setor:'DRENAGEM', status:'ATIVO', data_hora_entrada:h(1.9), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T13', nome:'DIEGO LIMA CARVALHO', matricula:'1133', cargo:'Técnico de Bombeamento', setor:'BOMBEAMENTO', status:'ATIVO', data_hora_entrada:h(7.8), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea' }] },
  { acesso_id:'T14', nome:'MARIANA COSTA FERREIRA', matricula:'2244', cargo:'Técnica de Comunicação', setor:'COMUNICAÇÃO', status:'ATIVO', data_hora_entrada:h(4.4), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Rádio Comunicador IS' }] },
  { acesso_id:'T15', nome:'THIAGO MENDONÇA ALVES', matricula:'3355', cargo:'Operador de Mina', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(2.6), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T16', nome:'PATRICIA ROCHA SANTOS', matricula:'4466', cargo:'Geóloga', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(5.0), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Detector Multi-Gás' }] },
  { acesso_id:'T17', nome:'ANDERSON VIEIRA GOMES', matricula:'5577', cargo:'Mecânico Industrial', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(8.5), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12' }] },
  { acesso_id:'T18', nome:'JESSICA NUNES RODRIGUES', matricula:'6688', cargo:'Técnica de Segurança', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(1.5), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T19', nome:'FELIPE CARDOSO MELO', matricula:'7799', cargo:'Eletricista', setor:'ELÉTRICA', status:'ATIVO', data_hora_entrada:h(3.1), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Medidor O2 e CO' }] },
  { acesso_id:'T20', nome:'BEATRIZ ALBUQUERQUE LIMA', matricula:'8811', cargo:'Supervisora de Operações', setor:'OPERAÇÃO', status:'ATIVO', data_hora_entrada:h(9.0), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T21', nome:'RODRIGO FONSECA TEIXEIRA', matricula:'9922', cargo:'Técnico de Gases', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(2.2), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Auto-Resgatador Subterrâneo' }] },
  { acesso_id:'T22', nome:'SIMONE APARECIDA BORGES', matricula:'1044', cargo:'Técnica de Instrumentação', setor:'INSTRUMENTAÇÃO', status:'ATIVO', data_hora_entrada:h(4.8), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T23', nome:'MAURICIO HENRIQUE PINTO', matricula:'2155', cargo:'Operador de Equipamentos', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(6.7), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea' }] },
  { acesso_id:'T24', nome:'VANESSA LOPES DA CUNHA', matricula:'3266', cargo:'Técnica de Drenagem', setor:'DRENAGEM', status:'ATIVO', data_hora_entrada:h(1.0), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T25', nome:'ALEXANDRE MIRANDA BARBOSA', matricula:'4377', cargo:'Técnico de Manutenção', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(7.6), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12' }] },
  { acesso_id:'T26', nome:'RENATA FREITAS SILVA', matricula:'5488', cargo:'Geóloga Sr.', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(3.4), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Detector Multi-Gás' }] },
  { acesso_id:'T27', nome:'LEANDRO NASCIMENTO COSTA', matricula:'6599', cargo:'Técnico de Bombeamento', setor:'BOMBEAMENTO', status:'ATIVO', data_hora_entrada:h(5.8), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T28', nome:'TATIANE ROSA SOUSA', matricula:'7610', cargo:'Técnica de Comunicação', setor:'COMUNICAÇÃO', status:'ATIVO', data_hora_entrada:h(2.3), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Rádio Comunicador IS' }] },
  { acesso_id:'T29', nome:'EDSON MARQUES XAVIER', matricula:'8721', cargo:'Mecânico Industrial', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(8.9), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12' }] },
  { acesso_id:'T30', nome:'CRISTIANE GONCALVES MOURA', matricula:'9832', cargo:'Operadora de Mina', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(0.5), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T31', nome:'WELLINGTON FIGUEIREDO DIAS', matricula:'1043', cargo:'Técnico de Segurança', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(4.0), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Medidor O2 e CO' }] },
  { acesso_id:'T32', nome:'KARINA MOREIRA AZEVEDO', matricula:'2154', cargo:'Técnica de Geologia', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(6.5), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T33', nome:'FABIO CUNHA RAMOS', matricula:'3265', cargo:'Eletricista', setor:'ELÉTRICA', status:'ATIVO', data_hora_entrada:h(2.8), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Multímetro Intrínseco' }] },
  { acesso_id:'T34', nome:'ADRIANA SALES MONTEIRO', matricula:'4376', cargo:'Supervisora de Operações', setor:'OPERAÇÃO', status:'ATIVO', data_hora_entrada:h(7.4), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T35', nome:'IGOR BATISTA CAVALCANTE', matricula:'5487', cargo:'Técnico de Instrumentação', setor:'INSTRUMENTAÇÃO', status:'ATIVO', data_hora_entrada:h(1.7), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Auto-Resgatador Subterrâneo' }] },
];
const MOCK_ATIVOS = MOCK_ATIVOS_RAW.map(a => ({ ...a, foto_url: `https://i.pravatar.cc/150?u=${a.acesso_id}` }));

const MOCK_HISTORICO_RAW = [
  { acesso_id:'H01', nome:'JULIANA COSTA MENDES', matricula:'7890', cargo:'Supervisora', setor:'OPERAÇÃO', status:'ENCERRADO', data_hora_entrada:h(9), data_hora_saida:new Date(now - 1.5*3600000).toISOString(), foto_url:null, materiais:[] },
  { acesso_id:'H02', nome:'CARLOS MENEZES PORTO', matricula:'2211', cargo:'Operador de Mina', setor:'EXTRAÇÃO', status:'ENCERRADO', data_hora_entrada:h(10), data_hora_saida:new Date(now - 0.5*3600000).toISOString(), foto_url:null, materiais:[] },
];
const MOCK_HISTORICO = MOCK_HISTORICO_RAW.map(a => ({ ...a, foto_url: `https://i.pravatar.cc/150?u=${a.acesso_id}` }));

const PAGE_SIZE = 25; // Usado apenas como fallback se necessário
const TV_SCROLL_SPEED = 40; // px/s
const TV_PAUSE_MS = 2500; // pausa nos extremos

// ─────────────────────────────────────────────────────────────────────────────
export const MonitoramentoMina: React.FC = () => {
  const [ativos, setAtivos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [aba, setAba] = useState<'ATIVOS' | 'HISTORICO'>('ATIVOS');
  const [loading, setLoading] = useState(true);
  const [modoTeste, setModoTeste] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [acessoSelecionado, setAcessoSelecionado] = useState<any>(null);
  const [modoApresentacao, setModoApresentacao] = useState(false);
  const [tvPausado, setTvPausado] = useState(false);
  const [clock, setClock] = useState(new Date());

  const tvScrollRef = useRef<HTMLDivElement>(null);
  const tvAnimRef = useRef<number | null>(null);
  const tvDirRef = useRef<1 | -1>(1); // 1 descendo, -1 subindo
  const tvPausadoRef = useRef(false);

  const ativosExibidos  = modoTeste ? MOCK_ATIVOS    : ativos;
  const historicoExibido = modoTeste ? MOCK_HISTORICO : historico;

  // Separar colaboradores com material pendente há mais de 8h (pinados no topo)
  const agora = Date.now();
  const isPendente8h = (acesso: any) =>
    acesso.materiais?.length > 0 &&
    Math.floor((agora - new Date(acesso.data_hora_entrada).getTime()) / 3600000) >= 8;

  const listaAtualRaw = aba === 'ATIVOS' ? ativosExibidos : historicoExibido;
  const listaAtual = aba === 'ATIVOS'
    ? [
        ...listaAtualRaw.filter(isPendente8h),
        ...listaAtualRaw.filter(a => !isPendente8h(a)),
      ]
    : listaAtualRaw;
  const pinados = aba === 'ATIVOS' ? listaAtual.filter(isPendente8h) : [];

  // No modo TV os pinados sempre vão em cima
  const ativosTV = [
    ...ativosExibidos.filter(isPendente8h),
    ...ativosExibidos.filter(a => !isPendente8h(a)),
  ];

  const fetchDados = async () => {
    try {
      const [r1, r2] = await Promise.all([api.get('/acessos-mina/ativos'), api.get('/acessos-mina/historico')]);
      setAtivos(r1.data);
      setHistorico(r2.data);
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDados(); const id = setInterval(fetchDados, 5000); return () => clearInterval(id); }, []);

  useEffect(() => { const id = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(id); }, []);

  useEffect(() => { tvPausadoRef.current = tvPausado; }, [tvPausado]);

  // Auto-rotação TV suave
  useEffect(() => {
    if (!modoApresentacao) {
      if (tvAnimRef.current) cancelAnimationFrame(tvAnimRef.current);
      return;
    }

    const el = tvScrollRef.current;
    if (!el) return;

    let lastTime: number | null = null;
    let pauseUntil = 0;

    const step = (ts: number) => {
      if (lastTime === null) lastTime = ts;
      const dt = ts - lastTime;
      lastTime = ts;

      if (!tvPausadoRef.current) {
        if (ts >= pauseUntil) {
          const delta = (TV_SCROLL_SPEED * dt) / 1000;
          el.scrollTop += tvDirRef.current * delta;

          const maxScroll = el.scrollHeight - el.clientHeight;

          if (tvDirRef.current === 1 && el.scrollTop >= maxScroll - 1) {
            el.scrollTop = maxScroll;
            tvDirRef.current = -1;
            pauseUntil = ts + TV_PAUSE_MS;
          } else if (tvDirRef.current === -1 && el.scrollTop <= 1) {
            el.scrollTop = 0;
            tvDirRef.current = 1;
            pauseUntil = ts + TV_PAUSE_MS;
          }
        }
      }

      tvAnimRef.current = requestAnimationFrame(step);
    };

    tvAnimRef.current = requestAnimationFrame(step);
    return () => { if (tvAnimRef.current) cancelAnimationFrame(tvAnimRef.current); };
  }, [modoApresentacao]);

  const pendencias   = ativosExibidos.filter(a => a.materiais?.length > 0).length;
  const hoje         = new Date().toLocaleDateString();
  const entradasHoje = ativosExibidos.filter(a => new Date(a.data_hora_entrada).toLocaleDateString() === hoje).length +
                       historicoExibido.filter(h => new Date(h.data_hora_entrada).toLocaleDateString() === hoje).length;
  const saidasHoje   = historicoExibido.filter(h => h.data_hora_saida && new Date(h.data_hora_saida).toLocaleDateString() === hoje).length;
  const abrirPainel = (acesso: any) => { setAcessoSelecionado(acesso); setPainelAberto(true); };

  if (modoApresentacao) {
    return (
      <div className="h-full overflow-hidden bg-[#0a061a] text-white flex flex-col">

        {/* Header TV */}
        <header className="flex-shrink-0 flex items-center justify-between px-8 py-3 border-b border-white/10 bg-[#110A2B]">
          <div>
            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">CMOC | CASA DA LANTERNA</p>
            <h1 className="text-lg font-black tracking-tight text-white">DASHBOARD DE PERMANÊNCIA NA MINA</h1>
          </div>

          {/* KPIs TV compactos */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{ativosExibidos.length}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">Na Mina</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{ativosExibidos.filter(a => { const h = Math.floor((Date.now() - new Date(a.data_hora_entrada).getTime()) / 3600000); return h < 7; }).length}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">&lt;7h30</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-rose-400">{ativosExibidos.filter(a => { const h = Math.floor((Date.now() - new Date(a.data_hora_entrada).getTime()) / 3600000); return h >= 7; }).length}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">Excedido</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white font-mono">{clock.toLocaleTimeString('pt-BR')}</p>
              <p className="text-[9px] text-slate-400">{clock.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
            </div>
          </div>
        </header>

        {/* Grid TV — flex-1 para ocupar espaço disponível e usar scroll suave */}
        <div 
          ref={tvScrollRef} 
          className="flex-1 px-6 pt-4 pb-2 overflow-y-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          <style>{`.tv-scroll-area::-webkit-scrollbar { display: none; }`}</style>
          <div
            className="tv-scroll-area grid gap-2.5"
            style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
          >
            {ativosTV.map(acesso => (
              <ColaboradorCardCompacto key={acesso.acesso_id} acesso={acesso} onExibirMais={() => abrirPainel(acesso)} isPendente8h={isPendente8h(acesso)} />
            ))}
          </div>
        </div>

        {/* Rodapé TV */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-t border-white/10 bg-[#110A2B]">
          <span className="text-xs text-slate-400">
            {ativosExibidos.length} colaboradores na mina
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setTvPausado(p => !p)}
              className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs font-bold">
              {tvPausado ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {tvPausado ? 'RETOMAR' : 'PAUSAR'}
            </button>
            <button
              onClick={() => { setModoApresentacao(false); setTvPausado(false); tvDirRef.current = 1; }}
              className="px-4 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 rounded-xl font-bold text-xs transition-colors"
            >
              SAIR DA TV
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
          </div>
        </div>

        {painelAberto && <ColaboradorSidePanel acesso={acessoSelecionado} onClose={() => setPainelAberto(false)} />}
      </div>
    );
  }

  // ── MODO NORMAL ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 w-full h-full overflow-y-auto flex flex-col bg-slate-100">

      {/* Container do Topo Roxo */}
      <div className="w-full pb-8" style={{ background: 'linear-gradient(180deg, #110A2B 0%, #0a061a 100%)' }}>
        <div className="px-8 pt-5 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Crachá de Acesso à Mina</h1>
            <p className="text-indigo-300/60 text-xs mt-0.5">Monitoramento em tempo real — mina subterrânea</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setModoApresentacao(true)}
              className="flex items-center gap-2 px-3 py-2 font-bold text-[11px] uppercase tracking-widest text-white/50 hover:text-white transition-colors">
              <Monitor className="w-4 h-4" /> MODO TV
            </button>
            <button onClick={() => setModoTeste(t => !t)}
              className={clsx('flex items-center gap-2 px-3 py-2 font-bold text-[11px] uppercase tracking-widest transition-colors',
                modoTeste ? 'text-amber-400' : 'text-white/50 hover:text-white')}>
              <FlaskConical className="w-4 h-4" />
              {modoTeste ? 'TESTE ATIVO' : 'MODO TESTE'}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Na Mina Agora',  value: ativosExibidos.length,  unit: 'col.', icon: Users,            color: 'text-indigo-400' },
            { label: 'Entradas Hoje',  value: entradasHoje,           unit: 'ac.',  icon: ArrowRightToLine,  color: 'text-sky-400' },
            { label: 'Saídas Hoje',    value: saidasHoje,             unit: 'ac.',  icon: ArrowLeftToLine,   color: 'text-emerald-400' },
            { label: 'Pendências',     value: pendencias,             unit: 'mat.', icon: AlertTriangle,     color: 'text-rose-400' },
          ].map(({ label, value, unit, icon: Icon, color }) => (
            <div key={label} className="flex flex-col py-1">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Icon className={`w-4.5 h-4.5 ${color}`} />
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.2em]">{label}</p>
              </div>
              <div className="flex items-baseline gap-2 pl-7">
                <span className="text-[2.5rem] font-light text-white leading-none tracking-tight">{value}</span>
                <span className="text-[13px] font-medium text-white/30">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* Área branca */}
      <div className="bg-slate-100 rounded-t-3xl flex-1 w-full flex flex-col min-h-[500px] -mt-6">
        <div className="max-w-[1400px] mx-auto w-full px-6 py-5">

          {modoTeste && (
            <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-xs font-medium">
              <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
              Modo Teste ativo — dados fictícios para demonstração.
            </div>
          )}

          {/* Abas + pesquisa */}
          <div className="flex items-center justify-between mb-4 bg-white p-2.5 rounded-xl shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-6 px-4">
              <button onClick={() => setAba('ATIVOS')}
                className={clsx('font-bold text-xs uppercase tracking-wider transition-colors', aba === 'ATIVOS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600')}>
                ATIVOS NA MINA
              </button>
              <button onClick={() => setAba('HISTORICO')}
                className={clsx('font-bold text-xs uppercase tracking-wider transition-colors', aba === 'HISTORICO' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600')}>
                HISTÓRICO
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Pesquisar..." className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-44" />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                <Filter className="w-3.5 h-3.5" /> Filtros
              </button>
            </div>
          </div>

          {/* Grid — todos de uma vez, sem paginação */}
          {listaAtual.length > 0 ? (
            <>
              {/* Banner de alerta para pendentes > 8h */}
              {pinados.length > 0 && (
                <div className="mb-3 flex items-center gap-3 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-lg animate-pulse">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-black text-sm uppercase tracking-wide">
                    {pinados.length} COLABORADOR{pinados.length > 1 ? 'ES' : ''} COM MATERIAL PENDENTE HÁ MAIS DE 8 HORAS!
                  </span>
                </div>
              )}

              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                {listaAtual.map(acesso => (
                  <ColaboradorCardCompacto key={acesso.acesso_id} acesso={acesso} onExibirMais={() => abrirPainel(acesso)} isPendente8h={isPendente8h(acesso)} />
                ))}
              </div>
              
              <div className="flex items-center justify-center mt-6 mb-4 px-1 text-xs text-slate-400">
                <span>Exibindo todos os {listaAtual.length} colaborador{listaAtual.length !== 1 ? 'es' : ''}</span>
              </div>
            </>
          ) : (
            !loading && (
              <div className="py-16 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-3">
                  <Users className="w-7 h-7 text-slate-400" />
                </div>
                <h2 className="text-lg font-black text-slate-800 mb-1">Nenhum colaborador na mina</h2>
                <p className="text-slate-500 text-sm">Não existem acessos ativos no momento.</p>
              </div>
            )
          )}

        </div>
      </div>

      {painelAberto && <ColaboradorSidePanel acesso={acessoSelecionado} onClose={() => setPainelAberto(false)} />}
    </div>
  );
};
