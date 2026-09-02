import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  UserCheck, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  ArrowRight,
  HardHat,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { ResumoAlertasTurno, NivelAlertaTurno } from '../types';

export const DashboardAlertas: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ResumoAlertasTurno | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [erro, setErro] = useState<string>('');
  const [filtroNivel, setFiltroNivel] = useState<'TODOS' | NivelAlertaTurno>('TODOS');

  const hasAudioPlayedRef = useRef<boolean>(false);

  const carregarAlertas = useCallback(async () => {
    try {
      setLoading((prev) => (data === null ? true : prev));
      const res = await api.get('/emprestimos/alertas-turno');
      const resumo: ResumoAlertasTurno = res.data;
      setData(resumo);
      setErro('');

      if (resumo.criticoCount > 0 && !hasAudioPlayedRef.current) {
        soundFX.playError();
        hasAudioPlayedRef.current = true;
      } else if (resumo.criticoCount === 0) {
        hasAudioPlayedRef.current = false;
      }
    } catch (err: any) {
      setErro('Erro ao atualizar painel de alertas de turno');
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    carregarAlertas();
    const interval = setInterval(carregarAlertas, 30000);
    return () => clearInterval(interval);
  }, [carregarAlertas]);

  const todosAlertasOrdenados = [...(data?.alertas || [])].sort(
    (a, b) => (b.minutos_em_uso || 0) - (a.minutos_em_uso || 0)
  );

  const alertasFiltrados = todosAlertasOrdenados.filter((item) => {
    if (filtroNivel === 'TODOS') return true;
    return item.nivel_alerta === filtroNivel;
  });

  const countExcederam7h30 = todosAlertasOrdenados.filter(
    (item) => (item.minutos_em_uso || 0) >= 450
  ).length;

  return (
    <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-5 font-sans">
      
      {/* 1. CABEÇALHO DO DASHBOARD — CARDS QUADRADOS (rounded-lg) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        
        {/* Esquerda: Botão Voltar + Título */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-[#331274] hover:bg-[#43208C] rounded-lg shadow-sm transition-all cursor-pointer group"
            title="Voltar à página anterior"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>VOLTAR AO MENU</span>
          </button>

          <div className="h-6 w-[2px] bg-slate-200 hidden sm:block" />

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
              Dashboard de Permanência Subterrânea
            </h1>
            <p className="text-xs font-semibold text-slate-600">
              Supervisão em tempo real dos colaboradores ativos na mina
            </p>
          </div>
        </div>

        {/* Direita: Botão Atualizar */}
        <button
          onClick={() => carregarAlertas()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#331274] hover:bg-[#43208C] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'ATUALIZANDO...' : 'ATUALIZAR DADOS'}</span>
        </button>
      </div>

      {/* ERRO */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 text-xs font-bold rounded-lg flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0 text-red-600" />
          <span>{erro}</span>
        </div>
      )}

      {/* BANNER ALERTA SEM EMOJI */}
      {countExcederam7h30 > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-extrabold uppercase font-['Outfit'] text-amber-950">
                ATENÇÃO: {countExcederam7h30} COLABORADOR(ES) EXCEDERAM O TEMPO PADRÃO DE TURNO (&gt; 7h30MIN)
              </p>
              <p className="text-xs font-semibold text-amber-900/90 mt-0.5">
                Oriente a baixa de turno e devolução de materiais no guichê da Casa da Lanterna.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. CARDS DE KPI MAIS QUADRADOS COM CONTORNOS LEVES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: TOTAL NA MINA */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#331274]/30 transition-all duration-200 cursor-pointer flex flex-col justify-between relative group">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              TOTAL NA MINA
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#331274]/10 text-[#331274] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
              {data?.totalEmUso || 0}
            </span>
            <p className="text-xs font-semibold text-slate-600 mt-1">Colaboradores ativos</p>
          </div>
        </div>

        {/* CARD 2: DENTRO DO TURNO */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#331274]/30 transition-all duration-200 cursor-pointer flex flex-col justify-between relative group">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              DENTRO DO TURNO
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
              {(data?.totalEmUso || 0) - (data?.atencaoCount || 0) - (data?.criticoCount || 0)}
            </span>
            <p className="text-xs font-semibold text-slate-600 mt-1">Tempo normal (&lt;7h30)</p>
          </div>
        </div>

        {/* CARD 3: ALERTA (>7h30) — CONTORNO LEVE SEM AMARELO FORTE */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#331274]/30 transition-all duration-200 cursor-pointer flex flex-col justify-between relative group">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              ALERTA (&gt;7h30)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
              {data?.atencaoCount || 0}
            </span>
            <p className="text-xs font-semibold text-slate-600 mt-1">Turno próximo do limite</p>
          </div>
        </div>

        {/* CARD 4: CRÍTICO (>8h30) — CONTORNO LEVE SEM VERMELHO FORTE */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#331274]/30 transition-all duration-200 cursor-pointer flex flex-col justify-between relative group">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              CRÍTICO (&gt;8h30)
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
              {data?.criticoCount || 0}
            </span>
            <p className="text-xs font-semibold text-slate-600 mt-1">Turno excedido</p>
          </div>
        </div>

      </div>


      {/* 3. BARRA DE FILTROS LIMPA SEM EMOJIS */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
        
        <div className="p-4 flex flex-wrap items-center justify-between gap-4">
          
          {/* Botões de Filtro */}
          <div className="bg-slate-100 p-1 rounded-lg flex flex-wrap items-center gap-2 border border-slate-200">
            <button
              onClick={() => setFiltroNivel('TODOS')}
              className={`px-4 py-2 text-xs font-extrabold rounded transition-all cursor-pointer uppercase ${
                filtroNivel === 'TODOS'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              TODOS NA MINA ({data?.totalEmUso || 0})
            </button>

            <button
              onClick={() => setFiltroNivel('ATENCAO')}
              className={`px-4 py-2 text-xs font-extrabold rounded transition-all cursor-pointer uppercase ${
                filtroNivel === 'ATENCAO'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              ALERTA 7h30+ ({data?.atencaoCount || 0})
            </button>

            <button
              onClick={() => setFiltroNivel('CRITICO')}
              className={`px-4 py-2 text-xs font-extrabold rounded transition-all cursor-pointer uppercase ${
                filtroNivel === 'CRITICO'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              CRÍTICOS 8h30+ ({data?.criticoCount || 0})
            </button>
          </div>

          <span className="text-xs text-slate-600 font-bold">
            * Ordenado do maior tempo para o menor tempo na mina
          </span>
        </div>

        {/* 4. TABELA LIMPA COM BORDAS DISCRETAS E SEM EMOJIS */}
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  <th className="py-3 px-4">ALERTA / STATUS</th>
                  <th className="py-3 px-4">COLABORADOR NA MINA</th>
                  <th className="py-3 px-4">EQUIPAMENTO EM POSSE</th>
                  <th className="py-3 px-4">ENTRADA NA MINA</th>
                  <th className="py-3 px-4">TEMPO DE PERMANÊNCIA</th>
                  <th className="py-3 px-4 text-center">AÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {alertasFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-4 text-center bg-slate-50">
                      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 text-[#331274] border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-800 font-['Outfit']">
                          Nenhum colaborador registrado no filtro selecionado.
                        </h4>
                        <p className="text-xs font-semibold text-slate-600 mt-1">
                          Todos os colaboradores finalizaram o turno ou estão dentro do horário normal de operação.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  alertasFiltrados.map((item) => {
                    const minutos = item.minutos_em_uso || 0;
                    const isExcedeu7h30 = minutos >= 450;
                    const isExcedeu8h30 = minutos >= 510;

                    return (
                      <tr
                        key={item.emprestimo_id}
                        className={`transition-colors ${
                          isExcedeu8h30
                            ? 'bg-red-50/60 border-l-4 border-l-red-600 font-bold'
                            : isExcedeu7h30
                            ? 'bg-amber-50/60 border-l-4 border-l-amber-500 font-bold'
                            : 'bg-white hover:bg-slate-50 border-l-4 border-l-emerald-500'
                        }`}
                      >
                        {/* STATUS / ALERTA SEM EMOJI */}
                        <td className="py-3.5 px-4">
                          {isExcedeu8h30 ? (
                            <span className="bg-red-600 text-white px-2.5 py-1 rounded font-bold text-xs uppercase inline-flex items-center gap-1.5 shadow-sm">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              <span>TURNO EXCEDIDO (&gt;8h30)</span>
                            </span>
                          ) : isExcedeu7h30 ? (
                            <span className="bg-amber-500 text-slate-950 px-2.5 py-1 rounded font-bold text-xs uppercase inline-flex items-center gap-1.5 shadow-sm">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>ALERTA (&gt;7h30MIN)</span>
                            </span>
                          ) : (
                            <span className="bg-emerald-600 text-white px-2.5 py-1 rounded font-bold text-xs uppercase inline-flex items-center gap-1.5 shadow-sm">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>DENTRO DO TURNO</span>
                            </span>
                          )}
                        </td>

                        {/* COLABORADOR */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 uppercase text-xs sm:text-sm">{item.colaborador_nome}</div>
                          <div className="text-xs text-slate-600 font-semibold">
                            MATRÍCULA: <span className="text-slate-900 font-bold">{item.colaborador_matricula}</span> | {item.setor || 'SUBTERRÂNEO'}
                          </div>
                        </td>

                        {/* EQUIPAMENTO */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{item.codigo_interno}</div>
                          <div className="text-xs text-slate-600 font-medium">{item.material_nome}</div>
                        </td>

                        {/* DATA/HORA SAÍDA */}
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-800 font-bold">
                          {item.data_hora_saida}
                        </td>

                        {/* TEMPO DE PERMANÊNCIA */}
                        <td className="py-3.5 px-4">
                          <div
                            className={`font-mono font-bold text-sm inline-block px-2.5 py-1 rounded ${
                              isExcedeu8h30
                                ? 'bg-red-100 text-red-800'
                                : isExcedeu7h30
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {item.tempo_formatado}
                          </div>
                        </td>

                        {/* AÇÃO */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => navigate('/entrada')}
                            className="bg-[#331274] hover:bg-[#43208C] text-white px-3.5 py-1.5 rounded font-bold text-xs uppercase inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                          >
                            <span>REGISTRAR ENTRADA</span>
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
      </div>
    </div>
  );
};
