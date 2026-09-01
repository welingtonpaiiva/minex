import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, AlertTriangle, ShieldCheck, RefreshCw, ArrowRight, AlertOctagon } from 'lucide-react';
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

  const alertasFiltrados = (data?.alertas || []).filter((item) => {
    if (filtroNivel === 'TODOS') return item.nivel_alerta !== 'NORMAL';
    return item.nivel_alerta === filtroNivel;
  });

  return (
    <div className="bg-white rounded border border-slate-300 p-4 shadow-sm flex flex-col gap-4">
      {/* Cabeçalho do Painel */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded text-amber-600 border border-amber-200">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
              DASHBOARD INDUSTRIAL — MONITORAMENTO DE TURNO (8h)
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Acompanhamento em tempo real de equipamentos em posse por turno subterrâneo
            </p>
          </div>
        </div>

        <button
          onClick={() => carregarAlertas()}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded border border-slate-300 font-bold text-xs flex items-center gap-2 cursor-pointer font-mono shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>ATUALIZAR</span>
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-300 text-red-700 p-2 text-xs font-bold rounded font-mono">
          {erro}
        </div>
      )}

      {/* Cards Superiores de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Total em Posse */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 flex justify-between items-center shadow-inner">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase font-mono">TOTAL EM POSSE</div>
            <div className="text-2xl font-black text-slate-900 font-mono">{data?.totalEmUso ?? 0}</div>
          </div>
          <Clock className="w-8 h-8 text-slate-400 opacity-60" />
        </div>

        {/* Normal */}
        <div className="bg-emerald-50 border border-emerald-300 rounded p-3 flex justify-between items-center shadow-sm">
          <div>
            <div className="text-[10px] font-bold text-emerald-800 uppercase font-mono">NORMAL (&lt; 7.5h)</div>
            <div className="text-2xl font-black text-emerald-700 font-mono">{data?.normalCount ?? 0}</div>
          </div>
          <ShieldCheck className="w-8 h-8 text-emerald-500 opacity-80" />
        </div>

        {/* Atenção */}
        <div
          onClick={() => setFiltroNivel('ATENCAO')}
          className={`border rounded p-3 flex justify-between items-center cursor-pointer transition-all shadow-sm ${
            filtroNivel === 'ATENCAO'
              ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400'
              : 'bg-amber-50 border-amber-300 hover:bg-amber-100'
          }`}
        >
          <div>
            <div className="text-[10px] font-bold text-amber-900 uppercase font-mono">FIM DE TURNO (7.5h - 8.5h)</div>
            <div className="text-2xl font-black text-amber-800 font-mono">{data?.atencaoCount ?? 0}</div>
          </div>
          <AlertTriangle className="w-8 h-8 text-amber-600 opacity-80" />
        </div>

        {/* Crítico */}
        <div
          onClick={() => setFiltroNivel('CRITICO')}
          className={`border rounded p-3 flex justify-between items-center cursor-pointer transition-all shadow-sm ${
            data && data.criticoCount > 0 ? 'animate-pulse' : ''
          } ${
            filtroNivel === 'CRITICO'
              ? 'bg-red-100 border-red-600 ring-2 ring-red-500'
              : 'bg-red-50 border-red-300 hover:bg-red-100'
          }`}
        >
          <div>
            <div className="text-[10px] font-bold text-red-900 uppercase font-mono">TURNO EXCEDIDO (&gt; 8.5h)</div>
            <div className="text-2xl font-black text-red-700 font-mono">{data?.criticoCount ?? 0}</div>
          </div>
          <AlertOctagon className="w-8 h-8 text-red-600 opacity-90" />
        </div>
      </div>

      {/* Seção da Tabela com Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFiltroNivel('TODOS')}
              className={`px-3 py-1 text-xs font-bold rounded font-mono uppercase cursor-pointer border ${
                filtroNivel === 'TODOS'
                  ? 'bg-slate-800 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              EXIBIR ALERTAS ({ (data?.atencaoCount || 0) + (data?.criticoCount || 0) })
            </button>
            <button
              onClick={() => setFiltroNivel('CRITICO')}
              className={`px-3 py-1 text-xs font-bold rounded font-mono uppercase cursor-pointer border ${
                filtroNivel === 'CRITICO'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
              }`}
            >
              🔴 CRÍTICOS ({data?.criticoCount || 0})
            </button>
            <button
              onClick={() => setFiltroNivel('ATENCAO')}
              className={`px-3 py-1 text-xs font-bold rounded font-mono uppercase cursor-pointer border ${
                filtroNivel === 'ATENCAO'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              🟡 ATENÇÃO ({data?.atencaoCount || 0})
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            Atualização automática a cada 30s
          </span>
        </div>

        {/* Tabela de Alertas de Turno */}
        <div className="overflow-x-auto border border-slate-300 rounded max-h-72">
          <table className="table-industrial text-xs">
            <thead>
              <tr>
                <th>STATUS</th>
                <th>EQUIPAMENTO</th>
                <th>COLABORADOR POSSUIDOR</th>
                <th>SAÍDA REGISTRADA</th>
                <th>TEMPO EM POSSE</th>
                <th className="text-center">AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {alertasFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400 font-bold uppercase font-mono">
                    ✓ Nenhum equipamento na categoria selecionada no momento.
                  </td>
                </tr>
              ) : (
                alertasFiltrados.map((item) => (
                  <tr
                    key={item.emprestimo_id}
                    className={
                      item.nivel_alerta === 'CRITICO'
                        ? 'bg-red-50 border-l-4 border-l-red-600'
                        : 'bg-amber-50 border-l-4 border-l-amber-500'
                    }
                  >
                    <td>
                      {item.nivel_alerta === 'CRITICO' ? (
                        <span className="bg-red-600 text-white px-2 py-0.5 rounded font-black font-mono text-[10px] uppercase inline-flex items-center gap-1 shadow-sm animate-pulse">
                          <AlertOctagon className="w-3 h-3" />
                          🔴 TURNO EXCEDIDO
                        </span>
                      ) : (
                        <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-bold font-mono text-[10px] uppercase inline-flex items-center gap-1 shadow-sm">
                          <AlertTriangle className="w-3 h-3" />
                          🟡 FIM DE TURNO
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="font-mono font-bold text-slate-900">{item.codigo_interno}</div>
                      <div className="text-slate-600 text-[11px]">{item.material_nome}</div>
                    </td>
                    <td>
                      <div className="font-bold text-slate-900 uppercase">{item.colaborador_nome}</div>
                      <div className="font-mono text-[10px] text-slate-600">
                        MAT: <span className="font-bold text-slate-800">{item.colaborador_matricula}</span> | {item.setor || '-'}
                      </div>
                    </td>
                    <td className="font-mono text-[11px] text-slate-700">
                      {item.data_hora_saida}
                    </td>
                    <td>
                      <div className="font-mono font-black text-sm text-red-700">{item.tempo_formatado}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.mensagem_alerta}</div>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => navigate('/entrada')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-extrabold text-[11px] uppercase font-mono inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>DEVOLVER</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
