import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History as HistoryIcon, Search, Filter, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Movimentacao } from '../types';

export const Historico: React.FC = () => {
  const navigate = useNavigate();

  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarHistorico();
  }, [tipo, busca, dataInicio, dataFim]);

  const carregarHistorico = async () => {
    setLoading(true);
    try {
      const res = await api.get('/historico', {
        params: {
          busca,
          tipo: tipo !== 'TODOS' ? tipo : undefined,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          limit: 200
        }
      });
      setMovimentacoes(res.data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLimparFiltros = () => {
    setBusca('');
    setTipo('TODOS');
    setDataInicio('');
    setDataFim('');
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans select-none overflow-y-auto min-h-screen">
      <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6 flex-1">
        
        {/* PAINEL DE FILTROS & CONTADOR */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs font-bold text-slate-600 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
            EXIBINDO ÚLTIMOS {movimentacoes.length} REGISTROS
          </div>
        </div>

        {/* PAINEL DE FILTROS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por material, código, colaborador..."
              className="w-full py-3 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          <div>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all shadow-sm"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="SAIDA">Somente SAÍDAS</option>
              <option value="ENTRADA">Somente ENTRADAS</option>
              <option value="MANUTENCAO">Somente MANUTENÇÃO</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-1/2 py-3 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#331274] transition-all shadow-sm"
              title="Data Inicial"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-1/2 py-3 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#331274] transition-all shadow-sm"
              title="Data Final"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={carregarHistorico}
              disabled={loading}
              className="flex-1 bg-[#331274] hover:bg-[#43208C] text-white font-extrabold text-xs uppercase rounded-xl border border-[#331274] cursor-pointer flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'CARREGANDO' : 'FILTRAR'}</span>
            </button>
            <button
              onClick={handleLimparFiltros}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 text-xs uppercase rounded-xl border border-slate-300 cursor-pointer transition-all shadow-sm"
            >
              LIMPAR
            </button>
          </div>
        </div>

        {/* TABELA DE MOVIMENTAÇÕES */}
        <div className="flex-1 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                  <th className="py-3 px-4">DATA / HORA</th>
                  <th className="py-3 px-4">TIPO</th>
                  <th className="py-3 px-4">CÓDIGO ITEM</th>
                  <th className="py-3 px-4">MATERIAL</th>
                  <th className="py-3 px-4">COLABORADOR</th>
                  <th className="py-3 px-4">MATRÍCULA</th>
                  <th className="py-3 px-4">OPERADOR BALCÃO</th>
                  <th className="py-3 px-4">OBSERVAÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {movimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500 font-bold uppercase">
                      Nenhuma movimentação registrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  movimentacoes.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="font-mono text-xs text-slate-700 font-bold py-3.5 px-4">{log.data_hora}</td>
                      <td className="py-3.5 px-4">
                        {log.tipo === 'SAIDA' ? (
                          <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 text-xs font-extrabold rounded-lg uppercase">
                            SAÍDA
                          </span>
                        ) : log.tipo === 'ENTRADA' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-extrabold rounded-lg uppercase">
                            ENTRADA
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 text-xs font-extrabold rounded-lg uppercase">
                            MANUTENÇÃO
                          </span>
                        )}
                      </td>
                      <td className="font-mono font-extrabold text-[#331274] py-3.5 px-4">{log.material_codigo}</td>
                      <td className="font-bold text-slate-900 py-3.5 px-4">{log.material_nome}</td>
                      <td className="font-bold text-slate-900 uppercase py-3.5 px-4">{log.colaborador_nome}</td>
                      <td className="font-mono text-[#331274] text-xs font-bold py-3.5 px-4">{log.colaborador_matricula}</td>
                      <td className="text-slate-600 text-xs font-medium py-3.5 px-4">{log.operador_nome}</td>
                      <td className="text-slate-500 text-xs italic py-3.5 px-4">{log.observacao || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RODAPÉ INSTITUCIONAL */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-sans shrink-0">
          <p>© {new Date().getFullYear()} Casa da Lanterna | Controle de Materiais de Mineração</p>
          <p><span className="opacity-40 mx-1.5">|</span> <span className="font-semibold text-slate-700">Dev by WP & EF</span></p>
        </div>

      </div>
    </div>
  );
};
