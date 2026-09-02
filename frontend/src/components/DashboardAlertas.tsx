import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  UserCheck, 
  ShieldCheck, 
  AlertOctagon, 
  ShieldAlert,
  CheckCircle2,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  FlaskConical,
  XCircle,
  Clock,
  Maximize2,
  Minimize2,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { ResumoAlertasTurno, NivelAlertaTurno, AlertaTurnoItem } from '../types';

// Gerador de Dados Simulados para Modo Teste / Demonstração em TV
const NOMES_SIMULADOS = [
  'RODRIGO ALVES DA SILVA',
  'CARLOS EDUARDO PEREIRA',
  'LUCAS MENDES SANTOS',
  'FERNANDO HENRIQUE COSTA',
  'GABRIEL OLIVEIRA ROCHA',
  'GUILHERME MARTINS FARIAS',
  'MARCELO ANTONIO SILVA',
  'JOÃO PEDRO DE SOUZA',
  'THIAGO BARBOSA DIAS',
  'RAFAEL LIMA CARDOSO',
  'PAULO HENRIQUE NOGUEIRA',
  'ANDRÉ LUIZ MONTEIRO',
  'MATHEUS TEIXEIRA CAMPOS',
  'BRUNO MATOS ARAÚJO',
  'DIEGO RAMOS FERREIRA',
  'MARCOS VINICIUS CASTRO',
  'FELIPE AUGUSTO DUARTE',
  'LEONARDO GOMES ALMEIDA',
  'VITOR HUGO CARVALHO',
  'SAMUEL BORGES RIBEIRO',
  'DANIEL MOREIRA FREITAS',
  'RENATO CAVALCANTE LOPES',
  'LEANDRO MACHADO VIEIRA',
  'ALEXANDRE CORREA PINTO',
  'GUSTAVO MENEZES REIS'
];

const EQUIPAMENTOS_SIMULADOS = [
  'Lanterna de Capacete LED Subterrânea #104',
  'Lanterna de Capacete LED Subterrânea #108',
  'Auto-Resgatador Subterrâneo M-20 #045',
  'Detector Multi-Gás RAE 4-Gases #012',
  'Lanterna de Capacete LED Subterrânea #203',
  'Rádio Comunicador Intrinsecamente Seguro #08',
  'Medidor de O2 e Monóxido de Carbono #19',
  'Lanterna de Capacete LED Subterrânea #155'
];

const GERAR_ALERTAS_TESTE = (): ResumoAlertasTurno => {
  const agora = new Date();
  
  // Variações de tempo na mina (em minutos): de 45 minutos a 9 horas
  const temposMinutos = [
    540, 525, 510, 495, 480, 465, 455, 440, 420, 390,
    360, 330, 300, 270, 240, 210, 180, 150, 120, 90,
    75, 60, 45, 30, 15
  ];

  let normalCount = 0;
  let criticoCount = 0;

  const alertas: AlertaTurnoItem[] = NOMES_SIMULADOS.map((nome, index) => {
    const minutos = temposMinutos[index % temposMinutos.length];
    const dataSaida = new Date(agora.getTime() - minutos * 60 * 1000);
    
    let nivel_alerta: NivelAlertaTurno = 'NORMAL';
    let mensagem_alerta = 'Dentro do turno padrão';
    if (minutos >= 450) { // >= 7h30min = CRÍTICO
      nivel_alerta = 'CRITICO';
      mensagem_alerta = 'Excedeu 7h30 na mina - Crítico';
      criticoCount++;
    } else {
      normalCount++;
    }

    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    const tempo_formatado = `${String(horas).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;

    return {
      emprestimo_id: 9000 + index,
      colaborador_id: 100 + index,
      colaborador_nome: nome,
      colaborador_matricula: String(99300100 + index),
      cargo: index % 2 === 0 ? 'Operador de Subterrâneo' : 'Técnico de Manutenção Mina',
      setor: 'SUBTERRÂNEO',
      material_id: 500 + index,
      material_nome: EQUIPAMENTOS_SIMULADOS[index % EQUIPAMENTOS_SIMULADOS.length],
      codigo_interno: `LAT-${String(101 + index).padStart(3, '0')}`,
      codigo_barras: `LAT-${String(101 + index).padStart(3, '0')}`,
      categoria_nome: 'Lanternas',
      data_hora_saida: dataSaida.toISOString().replace('T', ' ').slice(0, 19),
      minutos_em_uso: minutos,
      horas_em_uso: parseFloat((minutos / 60).toFixed(1)),
      nivel_alerta,
      tempo_formatado,
      mensagem_alerta
    };
  });

  return {
    totalEmUso: alertas.length,
    normalCount,
    atencaoCount: 0,
    criticoCount,
    alertas
  };
};

export const DashboardAlertas: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ResumoAlertasTurno | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [erro, setErro] = useState<string>('');
  const [filtroNivel, setFiltroNivel] = useState<'TODOS' | NivelAlertaTurno>('TODOS');
  
  // Modo Teste / Simulação
  const [isTestMode, setIsTestMode] = useState<boolean>(false);

  // Modo TV Fullscreen (Kiosk)
  const [isTvFullscreen, setIsTvFullscreen] = useState<boolean>(false);

  // Ticker de tempo ao vivo com segundos
  const [now, setNow] = useState<Date>(new Date());

  // Controle de Rolagem Automática para TV (Paginação em Carrossel)
  const [autoPageEnabled, setAutoPageEnabled] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25); // Capacidade expandida para 25 por tela (5x5)
  const [viewMode, setViewMode] = useState<'tabela' | 'grid'>('tabela');
  
  // Progresso em tempo real da barra do carrossel (0 a 100%)
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const hasAudioPlayedRef = useRef<boolean>(false);

  // Escutar evento nativo de fullscreen do navegador
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsTvFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Entrar em Tela Cheia no Modo TV
  const handleEnterTvMode = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setIsTvFullscreen(true);
    setViewMode('grid');
    setItemsPerPage(25); // Capacidade de 25 por tela (5 colunas x 5 linhas)
    setAutoPageEnabled(true);
  };

  // Sair do Modo Tela Cheia
  const handleExitTvMode = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setIsTvFullscreen(false);
  };

  // Ticker de 1 segundo para atualizar cronômetro com segundos ao vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const carregarAlertas = useCallback(async () => {
    if (isTestMode) return;
    try {
      setLoading((prev) => (data === null ? true : prev));
      const res = await api.get('/emprestimos/alertas-turno');
      const resumo: ResumoAlertasTurno = res.data;

      // Normalizar para 2 estados únicos (NORMAL vs CRITICO >= 7h30)
      const alertasNormalizados = (resumo.alertas || []).map((item) => {
        const isCritico = (item.minutos_em_uso || 0) >= 450 || item.nivel_alerta === 'CRITICO' || item.nivel_alerta === 'ATENCAO';
        return {
          ...item,
          nivel_alerta: (isCritico ? 'CRITICO' : 'NORMAL') as NivelAlertaTurno
        };
      });

      const criticoCount = alertasNormalizados.filter(a => a.nivel_alerta === 'CRITICO').length;
      const normalCount = alertasNormalizados.filter(a => a.nivel_alerta === 'NORMAL').length;

      setData({
        ...resumo,
        normalCount,
        atencaoCount: 0,
        criticoCount,
        alertas: alertasNormalizados
      });
      setErro('');

      if (criticoCount > 0 && !hasAudioPlayedRef.current) {
        soundFX.playError();
        hasAudioPlayedRef.current = true;
      } else if (criticoCount === 0) {
        hasAudioPlayedRef.current = false;
      }
    } catch (err: any) {
      setErro('Erro ao atualizar painel de alertas de turno');
    } finally {
      setLoading(false);
    }
  }, [data, isTestMode]);

  useEffect(() => {
    if (isTestMode) {
      setData(GERAR_ALERTAS_TESTE());
      setLoading(false);
    } else {
      carregarAlertas();
    }
  }, [isTestMode, carregarAlertas]);

  useEffect(() => {
    if (!isTestMode) {
      const interval = setInterval(carregarAlertas, 30000);
      return () => clearInterval(interval);
    }
  }, [carregarAlertas, isTestMode]);

  // Alternar Modo Teste
  const toggleModoTeste = () => {
    if (!isTestMode) {
      setIsTestMode(true);
      setData(GERAR_ALERTAS_TESTE());
      soundFX.playSuccess();
    } else {
      setIsTestMode(false);
      carregarAlertas();
    }
  };

  // Lista ordenada por tempo na mina (maior para o menor)
  const todosAlertasOrdenados = [...(data?.alertas || [])].sort(
    (a, b) => (b.minutos_em_uso || 0) - (a.minutos_em_uso || 0)
  );

  const alertasFiltrados = todosAlertasOrdenados.filter((item) => {
    if (filtroNivel === 'TODOS') return true;
    return item.nivel_alerta === filtroNivel;
  });

  // LÓGICA DE DADOS FIXOS VS ROTATIVOS (EXPIRADOS PERMANECEM NO TOPO)
  const expiradosFixos = alertasFiltrados.filter(
    (item) => item.nivel_alerta === 'CRITICO'
  );

  const normaisRotativos = alertasFiltrados.filter(
    (item) => item.nivel_alerta === 'NORMAL'
  );

  const vagasParaNormais = Math.max(1, itemsPerPage - expiradosFixos.length);
  const totalPagesNormais = Math.max(1, Math.ceil(normaisRotativos.length / vagasParaNormais));

  // Efeito de Rolagem Automática: SE TODOS COUBEREM NA TELA (totalPages <= 1), NÃO TROCA DE PÁGINA
  useEffect(() => {
    if (!autoPageEnabled || totalPagesNormais <= 1) {
      setProgressPercent(0);
      return;
    }

    const intervalTime = 100;
    const totalDuration = 10000;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += intervalTime;
      setProgressPercent((elapsed / totalDuration) * 100);

      if (elapsed >= totalDuration) {
        elapsed = 0;
        setCurrentPage((prev) => (prev + 1) % totalPagesNormais);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [autoPageEnabled, totalPagesNormais, currentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filtroNivel, viewMode]);

  const normaisPaginados = normaisRotativos.slice(
    currentPage * vagasParaNormais,
    (currentPage + 1) * vagasParaNormais
  );

  const listaExibidaTela = [...expiradosFixos, ...normaisPaginados].slice(0, itemsPerPage);

  const countCriticos = todosAlertasOrdenados.filter(
    (item) => item.nivel_alerta === 'CRITICO' || (item.minutos_em_uso || 0) >= 450
  ).length;

  // Função para calcular o tempo decorrido com SEGUNDOS ao vivo
  const calcularTempoComSegundos = (dataHoraSaida: string) => {
    if (!dataHoraSaida) return '00h 00m 00s';
    try {
      const parsedDate = new Date(dataHoraSaida.replace(' ', 'T'));
      if (isNaN(parsedDate.getTime())) return '00h 00m 00s';

      const diffMs = Math.max(0, now.getTime() - parsedDate.getTime());
      const horas = Math.floor(diffMs / (1000 * 60 * 60));
      const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diffMs % (1000 * 60)) / 1000);

      return `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
    } catch {
      return '00h 00m 00s';
    }
  };

  // =========================================================================
  // RENDEREIZAÇÃO DEDICADA DO MODO TV FULLSCREEN (CABE 25 COLABORADORES 5x5)
  // =========================================================================
  if (isTvFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F8FAFC] text-slate-900 flex flex-col justify-between p-4 font-sans select-none overflow-hidden">
        
        {/* BARRA DE PROGRESSO DA ROTAÇÃO (APENAS SE HOUVER MAIS DE 1 PÁGINA) */}
        {totalPagesNormais > 1 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200">
            <motion.div
              className="h-full bg-[#331274]"
              style={{ width: `${progressPercent}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>
        )}

        {/* CABEÇALHO CLARO E COMPACTO */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 shrink-0">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="CMOC Logo" className="h-7 object-contain" />
            <div className="h-5 w-[2px] bg-slate-300" />
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight uppercase font-['Outfit'] text-[#331274]">
                DASHBOARD DE PERMANÊNCIA NA MINA
              </h1>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                Monitoramento de Colaboradores Subterrâneos
              </p>
            </div>
          </div>

          {/* RELÓGIO DIGITAL & SAIR DA TV */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono text-sm sm:text-base font-extrabold bg-white text-[#331274] px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <Clock className="w-4 h-4 text-[#331274]" />
              <span>{now.toLocaleTimeString('pt-BR')}</span>
            </div>

            <button
              onClick={handleExitTvMode}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-xl border border-slate-300 cursor-pointer transition-all flex items-center gap-1.5 text-xs font-extrabold uppercase"
              title="Sair da TV"
            >
              <Minimize2 className="w-4 h-4" />
              <span>SAIR DA TV</span>
            </button>
          </div>
        </div>

        {/* 3 CARDS COMPACTOS DE RESUMO */}
        <div className="grid grid-cols-3 gap-3 my-2 shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">TOTAL NA MINA</span>
              <div className="text-2xl font-extrabold font-['Outfit'] text-[#331274] mt-0.5">{data?.totalEmUso || 0}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#331274]/10 text-[#331274] flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider font-['Outfit']">DENTRO DO TURNO (&lt;7h30)</span>
              <div className="text-2xl font-extrabold font-['Outfit'] text-emerald-700 mt-0.5">
                {(data?.totalEmUso || 0) - (data?.criticoCount || 0)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border-2 border-red-500 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-red-700 uppercase tracking-wider font-['Outfit']">TURNO EXCEDIDO (&gt;7h30)</span>
              <div className="text-2xl font-extrabold font-['Outfit'] text-red-600 mt-0.5">{data?.criticoCount || 0}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4 animate-bounce" />
            </div>
          </div>
        </div>

        {/* GRID EXPANDIDO PARA 25 CARDS (5 COLUNAS x 5 LINHAS COM ALTURA DE 105px) */}
        <div className="flex-1 overflow-hidden my-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 auto-rows-[105px] content-start overflow-hidden"
            >
              {listaExibidaTela.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 font-bold uppercase text-base">
                  Nenhum colaborador na mina no momento.
                </div>
              ) : (
                listaExibidaTela.map((item) => {
                  const isCritico = item.nivel_alerta === 'CRITICO';
                  const tempoComSegundos = calcularTempoComSegundos(item.data_hora_saida);

                  return (
                    <div
                      key={item.emprestimo_id}
                      className={`h-[105px] p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCritico
                          ? 'bg-red-50 border-2 border-red-500 shadow-md'
                          : 'bg-white border border-slate-200 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <span className={`font-extrabold uppercase text-xs font-['Outfit'] truncate ${isCritico ? 'text-red-950' : 'text-[#331274]'}`}>
                            {item.colaborador_nome}
                          </span>
                          {isCritico ? (
                            <span className="bg-red-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider">
                              EXCEDIDO
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider">
                              TURNO OK
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] font-medium text-slate-500">
                          Mat: <strong className="text-slate-800 font-mono">{item.colaborador_matricula}</strong>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-700 truncate mt-0.5">
                          {item.material_nome} ({item.codigo_interno})
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between">
                        <span className="text-[8px] text-slate-400 font-bold uppercase font-['Outfit']">TEMPO DE POSSE</span>
                        <span className={`font-mono font-black text-xs tracking-wider ${isCritico ? 'text-red-600' : 'text-slate-900'}`}>
                          {tempoComSegundos}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RODAPÉ DO PAINEL TV */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono shrink-0">
          <div>
            {totalPagesNormais > 1 ? (
              <>PÁGINA <strong className="text-[#331274]">{currentPage + 1} DE {totalPagesNormais}</strong> • EXIBINDO {listaExibidaTela.length} DE {alertasFiltrados.length} COLABORADORES</>
            ) : (
              <>EXIBINDO <strong className="text-[#331274]">TODOS OS {listaExibidaTela.length} COLABORADORES</strong> SIMULTANEAMENTE NA TELA</>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span className="font-bold text-slate-700">TRANSMISSÃO AO VIVO • MODALIDADE TV</span>
          </div>
        </div>

      </div>
    );
  }

  // =========================================================================
  // MODO NORMAL DE INTERFACE (BALCÃO OPERACIONAL COM AÇÕES E BOTÕES)
  // =========================================================================
  return (
    <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6 font-sans">

      {/* BANNER INFORMATIVO MODO TESTE */}
      {isTestMode && (
        <div className="bg-purple-900 border-2 border-amber-400 text-white p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-amber-400 animate-bounce shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-extrabold uppercase font-['Outfit'] tracking-wider text-amber-300">
                🧪 MODO TESTE / SIMULAÇÃO ATIVO (25 COLABORADORES DADOS FAKE)
              </p>
              <p className="text-xs font-medium text-purple-200 mt-0.5">
                Simulando múltiplos colaboradores no subterrâneo para testar carrossel TV, cronômetro e alertas.
              </p>
            </div>
          </div>

          <button
            onClick={toggleModoTeste}
            className="bg-amber-400 hover:bg-amber-300 text-purple-950 font-extrabold px-4 py-2 text-xs uppercase rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all shrink-0"
          >
            <XCircle className="w-4 h-4" />
            <span>SAIR DO MODO TESTE</span>
          </button>
        </div>
      )}

      {/* NOTIFICAÇÃO DE ERRO */}
      {erro && !isTestMode && (
        <div className="bg-red-50 border border-red-300 text-red-900 p-4 text-xs font-bold rounded-2xl flex items-center gap-3 shadow-sm">
          <AlertOctagon className="w-5 h-5 shrink-0 text-red-600" />
          <span>{erro}</span>
        </div>
      )}

      {/* BANNER ALERTA CRÍTICO PRINCIPAL */}
      {countCriticos > 0 && (
        <div className="bg-red-50 border border-red-300 text-red-950 p-5 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-extrabold uppercase font-['Outfit'] text-red-950">
                ATENÇÃO: {countCriticos} COLABORADOR(ES) EXCEDERAM O TEMPO PADRÃO DE TURNO (&gt; 7h30MIN)
              </p>
              <p className="text-xs font-semibold text-red-900/90 mt-0.5">
                Oriente a baixa imediata de turno e devolução de equipamentos no guichê da Casa da Lanterna.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPIS PADRONIZADOS (SOMENTE 2 ESTADOS + TOTAL) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* CARD 1: TOTAL NA MINA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">
              TOTAL NA MINA
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#331274]/10 text-[#331274] flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
              {data?.totalEmUso || 0}
            </span>
            <p className="text-xs font-semibold text-slate-500 mt-1">Colaboradores ativos no subterrâneo</p>
          </div>
        </div>

        {/* CARD 2: DENTRO DO TURNO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">
              DENTRO DO TURNO (&lt;7h30)
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-emerald-700 tracking-tight font-['Outfit']">
              {(data?.totalEmUso || 0) - (data?.criticoCount || 0)}
            </span>
            <p className="text-xs font-semibold text-slate-500 mt-1">Tempo regular de turno</p>
          </div>
        </div>

        {/* CARD 3: CRÍTICO (>7h30) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">
              CRÍTICO / TURNO EXCEDIDO (&gt;7h30)
            </span>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-red-700 tracking-tight font-['Outfit']">
              {data?.criticoCount || 0}
            </span>
            <p className="text-xs font-semibold text-slate-500 mt-1">Excederam 7h30 na mina</p>
          </div>
        </div>

      </div>

      {/* BARRA DE CONTROLE TV, SIMULAÇÃO & FILTROS DE NÍVEL */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        
        {/* FILTROS POR NÍVEL DE ALERTA */}
        <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFiltroNivel('TODOS')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer uppercase ${
              filtroNivel === 'TODOS'
                ? 'bg-[#331274] text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            TODOS ({data?.totalEmUso || 0})
          </button>

          <button
            onClick={() => setFiltroNivel('NORMAL')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer uppercase ${
              filtroNivel === 'NORMAL'
                ? 'bg-[#331274] text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            NORMAIS (&lt;7h30)
          </button>

          <button
            onClick={() => setFiltroNivel('CRITICO')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer uppercase ${
              filtroNivel === 'CRITICO'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            CRÍTICOS 7h30+ ({data?.criticoCount || 0})
          </button>
        </div>

        {/* MODO DE EXIBIÇÃO & CONTROLES DE SIMULAÇÃO E TV */}
        <div className="flex flex-wrap items-center gap-3">

          {/* BOTÃO PRINCIPAL MOSTRAR NA TV (FULLSCREEN KIOSK) */}
          <button
            onClick={handleEnterTvMode}
            className="bg-[#331274] hover:bg-[#43208C] text-white font-extrabold px-5 py-2.5 rounded-xl uppercase text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
            title="Exibir no televisor em tela cheia sem botões de clique (capacidade para 25 por tela)"
          >
            <Maximize2 className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>MOSTRAR NA TV</span>
          </button>

          {/* BOTÃO MODO TESTE / SIMULAÇÃO */}
          <button
            onClick={toggleModoTeste}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold uppercase shadow-sm flex items-center gap-2 cursor-pointer transition-all ${
              isTestMode
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-400'
                : 'bg-purple-100 hover:bg-purple-200 text-[#331274] border border-purple-200'
            }`}
            title="Simular 25 colaboradores com diferentes tempos na mina para testar carrossel TV"
          >
            <FlaskConical className="w-4 h-4 text-[#331274]" />
            <span>{isTestMode ? 'SIMULAÇÃO ATIVA' : 'MODO TESTE'}</span>
          </button>

          {/* ALTERNAR TABELA / GRID MULTI-COLUNA */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setViewMode('tabela')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === 'tabela' ? 'bg-[#331274] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
              title="Exibição em Tabela"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">TABELA</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === 'grid' ? 'bg-[#331274] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
              title="Exibição em Grid Multi-Coluna (Ideal para TV)"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">GRID TV</span>
            </button>
          </div>

          {/* CONTROLE DE ROLAGEM AUTOMÁTICA */}
          {totalPagesNormais > 1 && (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setAutoPageEnabled(!autoPageEnabled)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-white font-extrabold text-[11px] uppercase cursor-pointer shadow-sm transition-all ${
                  autoPageEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 hover:bg-slate-600'
                }`}
                title={autoPageEnabled ? 'Pausar Rolagem Automática' : 'Ativar Rolagem Automática'}
              >
                {autoPageEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{autoPageEnabled ? 'TV: ROLANDO (10s)' : 'TV: PAUSADO'}</span>
              </button>

              <div className="flex items-center gap-1 ml-1 text-slate-700 font-mono">
                <button
                  onClick={() => setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPagesNormais - 1))}
                  className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>PÁG {currentPage + 1}/{totalPagesNormais}</span>
                <button
                  onClick={() => setCurrentPage((prev) => (prev + 1) % totalPagesNormais)}
                  className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* BOTÃO REFRESH */}
          <button
            onClick={() => carregarAlertas()}
            disabled={loading || isTestMode}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#331274] hover:bg-[#43208C] text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'ATUALIZANDO...' : 'ATUALIZAR DADOS'}</span>
          </button>
        </div>
      </div>

      {/* EXIBIÇÃO EM MODO TABELA */}
      {viewMode === 'tabela' ? (
        <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-xs font-extrabold text-slate-800 uppercase tracking-wider font-['Outfit']">
                  <th className="py-3.5 px-4">ALERTA / STATUS</th>
                  <th className="py-3.5 px-4">COLABORADOR NA MINA</th>
                  <th className="py-3.5 px-4">EQUIPAMENTO EM POSSE</th>
                  <th className="py-3.5 px-4">ENTRADA NA MINA</th>
                  <th className="py-3.5 px-4">TEMPO EM TEMPO REAL (SEGUNDOS)</th>
                  <th className="py-3.5 px-4 text-center">AÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {listaExibidaTela.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-4 text-center bg-slate-50 text-slate-500 font-bold uppercase">
                      Nenhum colaborador encontrado para este filtro.
                    </td>
                  </tr>
                ) : (
                  listaExibidaTela.map((item) => {
                    const isCritico = item.nivel_alerta === 'CRITICO';
                    const tempoComSegundos = calcularTempoComSegundos(item.data_hora_saida);

                    return (
                      <tr
                        key={item.emprestimo_id}
                        className={`transition-colors ${
                          isCritico
                            ? 'bg-red-50/80 border-l-4 border-l-red-600 hover:bg-red-100/60 font-bold'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* STATUS BADGE */}
                        <td className="py-3.5 px-4">
                          {isCritico ? (
                            <span className="bg-red-600 text-white font-extrabold px-3 py-1 text-xs rounded-md shadow-sm uppercase font-mono inline-flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              CRÍTICO (&gt;7h30)
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 text-xs rounded-md uppercase font-mono inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              REGULAR
                            </span>
                          )}
                        </td>

                        {/* COLABORADOR */}
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-[#331274] uppercase text-sm font-['Outfit']">
                            {item.colaborador_nome}
                          </div>
                          <div className="text-xs text-slate-500 font-mono font-semibold">
                            MAT: {item.colaborador_matricula} {item.cargo ? `| ${item.cargo}` : ''}
                          </div>
                        </td>

                        {/* EQUIPAMENTO */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{item.material_nome}</div>
                          <div className="text-xs text-[#331274] font-mono font-extrabold">
                            CÓD: {item.codigo_interno}
                          </div>
                        </td>

                        {/* DATA DA SAÍDA */}
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 font-bold">
                          {item.data_hora_saida}
                        </td>

                        {/* TEMPO EM POSSE COM SEGUNDOS AO VIVO */}
                        <td className="py-3.5 px-4 font-mono font-extrabold">
                          <div className={`text-base tracking-wider ${isCritico ? 'text-red-700 font-black' : 'text-slate-800'}`}>
                            {tempoComSegundos}
                          </div>
                        </td>

                        {/* AÇÃO DE DAR BAIXA */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => navigate('/entrada')}
                            className="bg-[#331274] hover:bg-[#43208C] text-white px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                            title="Ir para a tela de Entrada para dar baixa"
                          >
                            <span>DAR BAIXA</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* EXIBIÇÃO EM GRID MULTI-COLUNA DE ALTA DENSIDADE COM TAMANHO FIXO DE CARDS */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[120px] content-start">
          {listaExibidaTela.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 font-bold uppercase">
              Nenhum colaborador encontrado para este filtro.
            </div>
          ) : (
            listaExibidaTela.map((item) => {
              const isCritico = item.nivel_alerta === 'CRITICO';
              const tempoComSegundos = calcularTempoComSegundos(item.data_hora_saida);

              return (
                <div
                  key={item.emprestimo_id}
                  className={`h-[120px] p-4 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${
                    isCritico
                      ? 'bg-red-50/90 border-red-500 border-2'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1 mb-1">
                    <span className="font-extrabold text-[#331274] uppercase text-xs sm:text-sm font-['Outfit'] truncate">
                      {item.colaborador_nome}
                    </span>
                    {isCritico ? (
                      <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded font-mono shrink-0">
                        CRÍTICO
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0">
                        REGULAR
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 text-xs text-slate-700 font-medium mb-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px]">Matrícula:</span>
                      <span className="font-mono font-bold text-[#331274] text-[10px]">{item.colaborador_matricula}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px]">Equipamento:</span>
                      <span className="font-bold text-slate-900 truncate text-[10px] max-w-[140px]">{item.material_nome}</span>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block font-['Outfit'] font-extrabold">TEMPO NA MINA</span>
                      <span className={`font-mono font-black text-xs tracking-wider ${isCritico ? 'text-red-700' : 'text-slate-800'}`}>
                        {tempoComSegundos}
                      </span>
                    </div>

                    <button
                      onClick={() => navigate('/entrada')}
                      className="bg-[#331274] hover:bg-[#43208C] text-white px-2 py-0.5 rounded text-[11px] font-bold uppercase shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>BAIXA</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* RODAPÉ INSTITUCIONAL */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-sans shrink-0">
        <p>© {new Date().getFullYear()} Casa da Lanterna | Controle de Materiais de Mineração</p>
        <p><span className="opacity-40 mx-1.5">|</span> <span className="font-semibold text-slate-700">Dev by WP & EF</span></p>
      </div>

    </div>
  );
};
