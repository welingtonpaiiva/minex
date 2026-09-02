import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, AlertTriangle, ShieldCheck, RefreshCw, ArrowRight, AlertOctagon, UserCheck } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { ResumoAlertasTurno, AlertaTurnoItem, NivelAlertaTurno } from '../types';

export const DashboardAlertas: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ResumoAlertasTurno | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [erro, setErro] = useState<string>('');
  const [filtroNivel, setFiltroNivel] = useState<'TODOS' | NivelAlertaTurno>('TODOS');

  // Guardar estado de audio tocado para não repetir sem parar
  const hasAudioPlayedRef = useRef<boolean>(false);

  const carregarAlertas = useCallback(async () => {
    try {
      setLoading((prev) => (data === null ? true : prev));
      const res = await api.get('/emprestimos/alertas-turno');
      const resumo: ResumoAlertasTurno = res.data;
      setData(resumo);
      setErro('');

      // Emitir alerta sonoro discreto se houver itens críticos
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
    // Polling a cada 30 segundos
    const interval = setInterval(carregarAlertas, 30000);
    return () => clearInterval(interval);
  }, [carregarAlertas]);

  // ORDENAÇÃO: Colaboradores há MAIS tempo na mina primeiro (minutos_em_uso decrescente)
  const todosAlertasOrdenados = [...(data?.alertas || [])].sort(
    (a, b) => (b.minutos_em_uso || 0) - (a.minutos_em_uso || 0)
  );

  // Filtragem
  const alertasFiltrados = todosAlertasOrdenados.filter((item) => {
    if (filtroNivel === 'TODOS') return true;
    return item.nivel_alerta === filtroNivel;
  });

  // Contagem de pessoas que excederam 7h30min (450 min)
  const countExcederam7h30 = todosAlertasOrdenados.filter(
    (item) => (item.minutos_em_uso || 0) >= 450
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho do Painel */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700 border border-amber-300">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
              DASHBOARD DE COLABORADORES NA MINA
            </h3>
            <p className="text-xs text-slate-600 font-mono">
              Ordenado por tempo de permanência subterrânea (Maior tempo no topo)
            </p>
          </div>
        </div>

        <button
          onClick={() => carregarAlertas()}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg border border-slate-300 font-bold text-xs flex items-center gap-2 cursor-pointer font-mono shadow-sm disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>ATUALIZAR DADOS</span>
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-300 text-red-700 p-3 text-xs font-bold rounded-lg font-mono">
          {erro}
        </div>
      )}

      {/* BANNER CHAMATIVO DE ALERTA PARA > 7h30min */}
      {countExcederam7h30 > 0 && (
        <div className="bg-amber-500 text-slate-950 p-4 rounded-xl border-2 border-amber-600 shadow-md flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-950 text-amber-400 rounded-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <div className="font-black font-mono text-sm sm:text-base uppercase tracking-wider">
                ⚠️ ALERTA DE PERMANÊNCIA EXCEDIDA (MAIS DE 07H30MIN NA MINA)
              </div>
              <div className="text-xs sm:text-sm font-semibold font-mono">
                Atenção: Há <span className="underline font-black text-slate-950 text-base">{countExcederam7h30}</span> colaborador(es) que ultrapassaram 7h30min de turno subterrâneo!
              </div>
            </div>
          </div>
          <button
            onClick={() => setFiltroNivel('ATENCAO')}
            className="bg-slate-950 hover:bg-slate-900 text-amber-400 font-mono font-bold px-4 py-2 rounded-lg text-xs uppercase cursor-pointer border border-amber-400 flex-shrink-0"
          >
            VER ALERTAS
          </button>
        </div>
      )}

      {/* Cards Superiores de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total na Mina */}
        <div
          onClick={() => setFiltroNivel('TODOS')}
          className={`border rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all shadow-sm ${
            filtroNivel === 'TODOS' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-slate-600 uppercase font-mono">TOTAL NA MINA</div>
            <div className="text-3xl font-black text-slate-900 font-mono">{data?.totalEmUso ?? 0}</div>
          </div>
          <UserCheck className="w-9 h-9 text-blue-600 opacity-80" />
        </div>

        {/* Normal (< 7.5h) */}
        <div
          onClick={() => setFiltroNivel('NORMAL')}
          className={`border rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all shadow-sm ${
            filtroNivel === 'NORMAL' ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-400' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-emerald-900 uppercase font-mono">NORMAL (&lt; 7h30min)</div>
            <div className="text-3xl font-black text-emerald-700 font-mono">{data?.normalCount ?? 0}</div>
          </div>
          <ShieldCheck className="w-9 h-9 text-emerald-600 opacity-80" />
        </div>

        {/* Atenção (7.5h - 8.5h) */}
        <div
          onClick={() => setFiltroNivel('ATENCAO')}
          className={`border rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all shadow-sm ${
            filtroNivel === 'ATENCAO'
              ? 'bg-amber-200 border-amber-600 ring-2 ring-amber-500'
              : 'bg-amber-50 border-amber-300 hover:bg-amber-100'
          } ${ (data?.atencaoCount || 0) > 0 ? 'animate-pulse' : '' }`}
        >
          <div>
            <div className="text-xs font-bold text-amber-950 uppercase font-mono">FIM DE TURNO (7h30 - 8h30)</div>
            <div className="text-3xl font-black text-amber-900 font-mono">{data?.atencaoCount ?? 0}</div>
          </div>
          <AlertTriangle className="w-9 h-9 text-amber-600 opacity-90" />
        </div>

        {/* Crítico (> 8.5h) */}
        <div
          onClick={() => setFiltroNivel('CRITICO')}
          className={`border rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all shadow-sm ${
            filtroNivel === 'CRITICO'
              ? 'bg-red-200 border-red-600 ring-2 ring-red-500'
              : 'bg-red-50 border-red-300 hover:bg-red-100'
          } ${ (data?.criticoCount || 0) > 0 ? 'animate-pulse' : '' }`}
        >
          <div>
            <div className="text-xs font-bold text-red-950 uppercase font-mono">EXCEDIDO (&gt; 8h30min)</div>
            <div className="text-3xl font-black text-red-700 font-mono">{data?.criticoCount ?? 0}</div>
          </div>
          <AlertOctagon className="w-9 h-9 text-red-600 opacity-90" />
        </div>
      </div>

      {/* Seção da Tabela com Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroNivel('TODOS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg font-mono uppercase cursor-pointer border transition-all ${
                filtroNivel === 'TODOS'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              TODOS NA MINA ({data?.totalEmUso || 0})
            </button>
            <button
              onClick={() => setFiltroNivel('ATENCAO')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg font-mono uppercase cursor-pointer border transition-all ${
                filtroNivel === 'ATENCAO'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              ⚠️ ALERTA 7h30+ ({data?.atencaoCount || 0})
            </button>
            <button
              onClick={() => setFiltroNivel('CRITICO')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg font-mono uppercase cursor-pointer border transition-all ${
                filtroNivel === 'CRITICO'
                  ? 'bg-red-600 text-white border-red-700 shadow-sm'
                  : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
              }`}
            >
              🔴 CRÍTICOS 8h30+ ({data?.criticoCount || 0})
            </button>
          </div>

          <span className="text-xs font-mono text-slate-500 font-medium">
            * Ordenado do maior tempo para o menor tempo na mina
          </span>
        </div>

        {/* Tabela de Colaboradores e Equipamentos */}
        <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-inner max-h-[500px]">
          <table className="table-industrial text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-mono uppercase border-b border-slate-300">
                <th className="py-3 px-4 text-left">ALERTA / STATUS</th>
                <th className="py-3 px-4 text-left">COLABORADOR NA MINA</th>
                <th className="py-3 px-4 text-left">EQUIPAMENTO EM POSSE</th>
                <th className="py-3 px-4 text-left">ENTRADA NA MINA (SAÍDA)</th>
                <th className="py-3 px-4 text-left">TEMPO DE PERMANÊNCIA</th>
                <th className="py-3 px-4 text-center">AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {alertasFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 font-bold uppercase font-mono bg-slate-50">
                    ✓ Nenhum colaborador registrado no filtro selecionado no momento.
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
                          ? 'bg-red-100 border-l-8 border-l-red-600 font-bold'
                          : isExcedeu7h30
                          ? 'bg-amber-100 border-l-8 border-l-amber-500 font-bold'
                          : 'bg-white hover:bg-slate-50 border-l-4 border-l-emerald-500'
                      }`}
                    >
                      {/* STATUS / ALERTA */}
                      <td className="py-3 px-4">
                        {isExcedeu8h30 ? (
                          <span className="bg-red-600 text-white px-2.5 py-1 rounded-md font-black font-mono text-xs uppercase inline-flex items-center gap-1.5 shadow-md animate-pulse">
                            <AlertOctagon className="w-4 h-4" />
                            🔴 TURNO EXCEDIDO (&gt;8h30)
                          </span>
                        ) : isExcedeu7h30 ? (
                          <span className="bg-amber-500 text-slate-950 px-2.5 py-1 rounded-md font-black font-mono text-xs uppercase inline-flex items-center gap-1.5 shadow-md animate-bounce">
                            <AlertTriangle className="w-4 h-4" />
                            ⚠️ ALERTA (&gt;7h30MIN)
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-md font-bold font-mono text-xs uppercase inline-flex items-center gap-1 shadow-sm">
                            <ShieldCheck className="w-4 h-4" />
                            ✓ DENTRO DO TURNO
                          </span>
                        )}
                      </td>

                      {/* COLABORADOR */}
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 uppercase text-sm sm:text-base">{item.colaborador_nome}</div>
                        <div className="font-mono text-xs text-slate-600">
                          MATRÍCULA: <span className="font-bold text-slate-900">{item.colaborador_matricula}</span> | {item.setor || 'SUBTERRÂNEO'}
                        </div>
                      </td>

                      {/* EQUIPAMENTO */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-black text-slate-900 text-sm">{item.codigo_interno}</div>
                        <div className="text-slate-700 text-xs font-semibold">{item.material_nome}</div>
                      </td>

                      {/* DATA/HORA SAÍDA */}
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-800">
                        {item.data_hora_saida}
                      </td>

                      {/* TEMPO DE PERMANÊNCIA (DESTACADO SE > 7h30min) */}
                      <td className="py-3 px-4">
                        <div
                          className={`font-mono font-black text-base sm:text-lg inline-block px-2.5 py-0.5 rounded ${
                            isExcedeu8h30
                              ? 'bg-red-700 text-white shadow-md animate-pulse'
                              : isExcedeu7h30
                              ? 'bg-amber-600 text-slate-950 shadow-sm'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.tempo_formatado}
                        </div>
                        <div className="text-xs font-mono text-slate-600 mt-0.5">{item.mensagem_alerta}</div>
                      </td>

                      {/* AÇÃO */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => navigate('/entrada')}
                          className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2 rounded-lg font-black text-xs uppercase font-mono inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <span>REGISTRAR ENTRADA</span>
                          <ArrowRight className="w-4 h-4" />
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
  );
};
