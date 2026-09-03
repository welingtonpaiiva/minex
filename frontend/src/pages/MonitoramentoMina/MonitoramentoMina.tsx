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

const MOCK_ATIVOS = [
  { acesso_id:'T01', nome:'CARLOS EDUARDO SILVA', matricula:'1234', cargo:'Operador de Mina', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(2.5), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea', codigo_interno:'LAN-001' }] },
  { acesso_id:'T02', nome:'MARCOS ANTONIO FERREIRA', matricula:'5678', cargo:'Técnico de Segurança', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(4.1), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T03', nome:'ANA PAULA RODRIGUES', matricula:'9012', cargo:'Geóloga Sr.', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(1.2), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Detector Multi-Gás', codigo_interno:'DET-012' },{ nome:'Rádio Comunicador IS', codigo_interno:'RAD-003' }] },
  { acesso_id:'T04', nome:'ROBERTO SOUZA LIMA', matricula:'3456', cargo:'Mecânico Industrial', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(7.3), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12', codigo_interno:'FER-089' }] },
  { acesso_id:'T05', nome:'ANTONIO CARLOS FERNANDES DE OLIVEIRA', matricula:'7890', cargo:'Supervisor de Operações', setor:'OPERAÇÃO', status:'ATIVO', data_hora_entrada:h(8.1), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T06', nome:'GUILHERME HENRIQUE MARTINS DA SILVA', matricula:'2345', cargo:'Eletricista', setor:'ELÉTRICA', status:'ATIVO', data_hora_entrada:h(3.7), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Multímetro Intrínseco', codigo_interno:'ELT-045' }] },
  { acesso_id:'T07', nome:'FERNANDA CRISTINA ALVES', matricula:'6789', cargo:'Técnica de Geologia', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(2.0), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T08', nome:'PAULO ROBERTO MENDES', matricula:'1122', cargo:'Técnico de Gases', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(5.5), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Medidor O2 e CO', codigo_interno:'GAS-007' }] },
  { acesso_id:'T09', nome:'LUCAS GABRIEL PEREIRA', matricula:'3344', cargo:'Operador de Equipamentos', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(0.8), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea', codigo_interno:'LAN-022' }] },
  { acesso_id:'T10', nome:'FERNANDA AUGUSTO RODRIGUES PEREIRA', matricula:'5566', cargo:'Técnico de Instrumentação', setor:'INSTRUMENTAÇÃO', status:'ATIVO', data_hora_entrada:h(6.2), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T11', nome:'RAFAEL SOUZA BARBOSA', matricula:'7788', cargo:'Técnico de Manutenção', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(3.3), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Auto-Resgatador Subterrâneo', codigo_interno:'RES-011' }] },
  { acesso_id:'T12', nome:'CAMILA SANTOS OLIVEIRA', matricula:'9900', cargo:'Técnica de Drenagem', setor:'DRENAGEM', status:'ATIVO', data_hora_entrada:h(1.9), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T13', nome:'DIEGO LIMA CARVALHO', matricula:'1133', cargo:'Técnico de Bombeamento', setor:'BOMBEAMENTO', status:'ATIVO', data_hora_entrada:h(7.8), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea', codigo_interno:'LAN-033' }] },
  { acesso_id:'T14', nome:'MARIANA COSTA FERREIRA', matricula:'2244', cargo:'Técnica de Comunicação', setor:'COMUNICAÇÃO', status:'ATIVO', data_hora_entrada:h(4.4), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Rádio Comunicador IS', codigo_interno:'RAD-014' }] },
  { acesso_id:'T15', nome:'THIAGO MENDONÇA ALVES', matricula:'3355', cargo:'Operador de Mina', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(2.6), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T16', nome:'PATRICIA ROCHA SANTOS', matricula:'4466', cargo:'Geóloga', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(5.0), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Detector Multi-Gás', codigo_interno:'DET-021' }] },
  { acesso_id:'T17', nome:'ANDERSON VIEIRA GOMES', matricula:'5577', cargo:'Mecânico Industrial', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(8.5), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12', codigo_interno:'FER-102' }] },
  { acesso_id:'T18', nome:'JESSICA NUNES RODRIGUES', matricula:'6688', cargo:'Técnica de Segurança', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(1.5), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T19', nome:'FELIPE CARDOSO MELO', matricula:'7799', cargo:'Eletricista', setor:'ELÉTRICA', status:'ATIVO', data_hora_entrada:h(3.1), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Medidor O2 e CO', codigo_interno:'GAS-015' }] },
  { acesso_id:'T20', nome:'BEATRIZ ALBUQUERQUE LIMA', matricula:'8811', cargo:'Supervisora de Operações', setor:'OPERAÇÃO', status:'ATIVO', data_hora_entrada:h(9.0), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T21', nome:'RODRIGO FONSECA TEIXEIRA', matricula:'9922', cargo:'Técnico de Gases', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(2.2), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Auto-Resgatador Subterrâneo', codigo_interno:'RES-022' }] },
  { acesso_id:'T22', nome:'SIMONE APARECIDA BORGES', matricula:'1044', cargo:'Técnica de Instrumentação', setor:'INSTRUMENTAÇÃO', status:'ATIVO', data_hora_entrada:h(4.8), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T23', nome:'MAURICIO HENRIQUE PINTO', matricula:'2155', cargo:'Operador de Equipamentos', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(6.7), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Lanterna de Capacete LED Subterrânea', codigo_interno:'LAN-044' }] },
  { acesso_id:'T24', nome:'VANESSA LOPES DA CUNHA', matricula:'3266', cargo:'Técnica de Drenagem', setor:'DRENAGEM', status:'ATIVO', data_hora_entrada:h(1.0), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T25', nome:'ALEXANDRE MIRANDA BARBOSA', matricula:'4377', cargo:'Técnico de Manutenção', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(7.6), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12', codigo_interno:'FER-115' }] },
  { acesso_id:'T26', nome:'RENATA FREITAS SILVA', matricula:'5488', cargo:'Geóloga Sr.', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(3.4), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Detector Multi-Gás', codigo_interno:'DET-033' }] },
  { acesso_id:'T27', nome:'LEANDRO NASCIMENTO COSTA', matricula:'6599', cargo:'Técnico de Bombeamento', setor:'BOMBEAMENTO', status:'ATIVO', data_hora_entrada:h(5.8), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T28', nome:'TATIANE ROSA SOUSA', matricula:'7610', cargo:'Técnica de Comunicação', setor:'COMUNICAÇÃO', status:'ATIVO', data_hora_entrada:h(2.3), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Rádio Comunicador IS', codigo_interno:'RAD-027' }] },
  { acesso_id:'T29', nome:'EDSON MARQUES XAVIER', matricula:'8721', cargo:'Mecânico Industrial', setor:'MANUTENÇÃO', status:'ATIVO', data_hora_entrada:h(8.9), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Chave de Impacto K12', codigo_interno:'FER-128' }] },
  { acesso_id:'T30', nome:'CRISTIANE GONCALVES MOURA', matricula:'9832', cargo:'Operadora de Mina', setor:'EXTRAÇÃO', status:'ATIVO', data_hora_entrada:h(0.5), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T31', nome:'WELLINGTON FIGUEIREDO DIAS', matricula:'1043', cargo:'Técnico de Segurança', setor:'SEGURANÇA', status:'ATIVO', data_hora_entrada:h(4.0), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Medidor O2 e CO', codigo_interno:'GAS-031' }] },
  { acesso_id:'T32', nome:'KARINA MOREIRA AZEVEDO', matricula:'2154', cargo:'Técnica de Geologia', setor:'GEOLOGIA', status:'ATIVO', data_hora_entrada:h(6.5), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T33', nome:'FABIO CUNHA RAMOS', matricula:'3265', cargo:'Eletricista', setor:'ELÉTRICA', status:'ATIVO', data_hora_entrada:h(2.8), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Multímetro Intrínseco', codigo_interno:'ELT-077' }] },
  { acesso_id:'T34', nome:'ADRIANA SALES MONTEIRO', matricula:'4376', cargo:'Supervisora de Operações', setor:'OPERAÇÃO', status:'ATIVO', data_hora_entrada:h(7.4), data_hora_saida:null, foto_url:null, materiais:[] },
  { acesso_id:'T35', nome:'IGOR BATISTA CAVALCANTE', matricula:'5487', cargo:'Técnico de Instrumentação', setor:'INSTRUMENTAÇÃO', status:'ATIVO', data_hora_entrada:h(1.7), data_hora_saida:null, foto_url:null, materiais:[{ nome:'Auto-Resgatador Subterrâneo', codigo_interno:'RES-035' }] },
];

const MOCK_HISTORICO = [
  { acesso_id:'H01', nome:'JULIANA COSTA MENDES', matricula:'7890', cargo:'Supervisora', setor:'OPERAÇÃO', status:'ENCERRADO', data_hora_entrada:h(9), data_hora_saida:new Date(now - 1.5*3600000).toISOString(), foto_url:null, materiais:[] },
  { acesso_id:'H02', nome:'CARLOS MENEZES PORTO', matricula:'2211', cargo:'Operador de Mina', setor:'EXTRAÇÃO', status:'ENCERRADO', data_hora_entrada:h(10), data_hora_saida:new Date(now - 0.5*3600000).toISOString(), foto_url:null, materiais:[] },
];

const PAGE_SIZE = 25;
const TV_INTERVAL_MS = 15000; // 15 segundos por página no Modo TV

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
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [paginaTV, setPaginaTV] = useState(0);
  const [tvPausado, setTvPausado] = useState(false);
  const [clock, setClock] = useState(new Date());
  const tvTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ativosExibidos  = modoTeste ? MOCK_ATIVOS    : ativos;
  const historicoExibido = modoTeste ? MOCK_HISTORICO : historico;

  const listaAtual = aba === 'ATIVOS' ? ativosExibidos : historicoExibido;
  const totalPaginas = Math.max(1, Math.ceil(listaAtual.length / PAGE_SIZE));
  const paginaSegura  = Math.min(paginaAtual, totalPaginas - 1);
  const cardsDaPagina = listaAtual.slice(paginaSegura * PAGE_SIZE, (paginaSegura + 1) * PAGE_SIZE);

  // Paginação TV
  const totalPaginasTV = Math.max(1, Math.ceil(ativosExibidos.length / PAGE_SIZE));
  const cardsTV = ativosExibidos.slice(paginaTV * PAGE_SIZE, (paginaTV + 1) * PAGE_SIZE);

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

  // Auto-rotação TV
  useEffect(() => {
    if (!modoApresentacao || tvPausado) { if (tvTimerRef.current) clearInterval(tvTimerRef.current); return; }
    tvTimerRef.current = setInterval(() => {
      setPaginaTV(p => (p + 1) % totalPaginasTV);
    }, TV_INTERVAL_MS);
    return () => { if (tvTimerRef.current) clearInterval(tvTimerRef.current); };
  }, [modoApresentacao, tvPausado, totalPaginasTV]);

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

        {/* Grid TV — flex-1 para ocupar espaço disponível */}
        <div className="flex-1 px-6 pt-4 pb-2 overflow-hidden">
          <div
            className="grid gap-2.5 h-full"
            style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gridTemplateRows: 'repeat(5, minmax(0, 1fr))' }}
          >
            {cardsTV.map(acesso => (
              <ColaboradorCardCompacto key={acesso.acesso_id} acesso={acesso} onExibirMais={() => abrirPainel(acesso)} />
            ))}
          </div>
        </div>

        {/* Rodapé TV */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-t border-white/10 bg-[#110A2B]">
          <span className="text-xs text-slate-400">
            Exibindo {cardsTV.length} de {ativosExibidos.length} colaboradores
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setPaginaTV(p => (p - 1 + totalPaginasTV) % totalPaginasTV)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white">{paginaTV + 1} / {totalPaginasTV}</span>
            <button onClick={() => setPaginaTV(p => (p + 1) % totalPaginasTV)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setTvPausado(p => !p)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              {tvPausado ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setModoApresentacao(false); setPaginaTV(0); setTvPausado(false); }}
              className="px-4 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 rounded-xl font-bold text-xs transition-colors"
            >
              SAIR DA TV
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
            <Radio className="w-3 h-3 animate-pulse" /> AO VIVO
          </div>
        </div>

        {painelAberto && <ColaboradorSidePanel acesso={acessoSelecionado} onClose={() => setPainelAberto(false)} />}
      </div>
    );
  }

  // ── MODO NORMAL ────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto flex flex-col" style={{ background: 'linear-gradient(180deg, #110A2B 0%, #0a061a 100%)' }}>

      {/* Topo roxo */}
      <div className="px-8 pt-5 pb-4 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Crachá de Acesso à Mina</h1>
            <p className="text-indigo-300/60 text-xs mt-0.5">Monitoramento em tempo real — mina subterrânea</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setModoApresentacao(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-xs text-white transition-colors">
              <Monitor className="w-3.5 h-3.5" /> MODO TV
            </button>
            <button onClick={() => { setModoTeste(t => !t); setPaginaAtual(0); }}
              className={clsx('flex items-center gap-2 px-3 py-2 border rounded-xl font-bold text-xs transition-all',
                modoTeste ? 'bg-amber-400 text-amber-900 border-amber-300' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white')}>
              <FlaskConical className="w-3.5 h-3.5" />
              {modoTeste ? 'TESTE ATIVO' : 'MODO TESTE'}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Na Mina Agora',  value: ativosExibidos.length,  unit: 'col.', icon: Users,            color: 'bg-indigo-500/20 text-indigo-300' },
            { label: 'Entradas Hoje',  value: entradasHoje,           unit: 'ac.',  icon: ArrowRightToLine,  color: 'bg-sky-500/20 text-sky-300' },
            { label: 'Saídas Hoje',    value: saidasHoje,             unit: 'ac.',  icon: ArrowLeftToLine,   color: 'bg-emerald-500/20 text-emerald-300' },
            { label: 'Pendências',     value: pendencias,             unit: 'mat.', icon: AlertTriangle,     color: 'bg-rose-500/20 text-rose-300' },
          ].map(({ label, value, unit, icon: Icon, color }) => (
            <div key={label} className="bg-white/8 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{label}</p>
                <div className="flex items-end gap-0.5">
                  <span className="text-2xl font-black text-white leading-none">{value}</span>
                  <span className="text-[10px] text-white/30 pb-0.5">{unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área branca */}
      <div className="bg-slate-100 rounded-t-3xl flex-1 flex flex-col min-h-0">
        <div className="max-w-[1400px] mx-auto px-6 py-5">

          {modoTeste && (
            <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-xs font-medium">
              <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
              Modo Teste ativo — dados fictícios para demonstração.
            </div>
          )}

          {/* Abas + pesquisa */}
          <div className="flex items-center justify-between mb-4 bg-white p-2.5 rounded-xl shadow-sm border border-slate-200/60">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button onClick={() => { setAba('ATIVOS'); setPaginaAtual(0); }}
                className={clsx('px-4 py-1.5 rounded-md font-bold text-xs transition-all', aba === 'ATIVOS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                ATIVOS NA MINA
              </button>
              <button onClick={() => { setAba('HISTORICO'); setPaginaAtual(0); }}
                className={clsx('px-4 py-1.5 rounded-md font-bold text-xs transition-all', aba === 'HISTORICO' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
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

          {/* Grid 5×5 */}
          {cardsDaPagina.length > 0 ? (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gridAutoRows: '1fr' }}>
                {cardsDaPagina.map(acesso => (
                  <ColaboradorCardCompacto key={acesso.acesso_id} acesso={acesso} onExibirMais={() => abrirPainel(acesso)} />
                ))}
              </div>
              
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between px-1 mt-3 text-xs text-slate-500 select-none">
                  <span className="font-medium">Exibindo {Math.min(PAGE_SIZE, listaAtual.length - paginaSegura * PAGE_SIZE)} de {listaAtual.length} colaboradores</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPaginaAtual(Math.max(0, paginaSegura - 1))} disabled={paginaSegura === 0}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: totalPaginas }).map((_, i) => (
                      <button key={i} onClick={() => setPaginaAtual(i)}
                        className={clsx('w-7 h-7 rounded-lg text-xs font-bold transition-colors', i === paginaSegura ? 'bg-[#331274] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setPaginaAtual(Math.min(totalPaginas - 1, paginaSegura + 1))} disabled={paginaSegura === totalPaginas - 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 font-medium text-emerald-600">
                    <Radio className="w-3 h-3 animate-pulse" /> TRANSMISSÃO AO VIVO
                  </div>
                </div>
              )}
              {totalPaginas === 1 && (
                <div className="flex items-center justify-between mt-3 px-1 text-xs text-slate-400">
                  <span>Exibindo {cardsDaPagina.length} colaborador{cardsDaPagina.length !== 1 ? 'es' : ''}</span>
                  <div className="flex items-center gap-1 text-emerald-600 font-medium">
                    <Radio className="w-3 h-3 animate-pulse" /> TRANSMISSÃO AO VIVO
                  </div>
                </div>
              )}
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
