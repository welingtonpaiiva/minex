import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History as HistoryIcon, Search, Calendar, Filter, RefreshCw } from 'lucide-react';
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
    <div className="flex-1 flex flex-col bg-slate-100 p-4 overflow-hidden select-none">
      {/* Topo / Voltar */}
      <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-300 mb-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded border border-slate-300 font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>VOLTAR</span>
          </button>
          <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-amber-600" />
            HISTÓRICO PERMANENTE DE MOVIMENTAÇÕES
          </h2>
        </div>

        <div className="text-xs font-mono text-slate-500 font-semibold">
          EXIBINDO ÚLTIMOS {movimentacoes.length} REGISTROS (ORDEM CRONOLÓGICA INVERSA)
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 shrink-0 bg-white p-3 rounded border border-slate-300 shadow-sm">
        <div className="md:col-span-2 relative">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por material, código, colaborador ou operador..."
            className="input-industrial text-sm py-2 pl-10"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="input-industrial text-sm py-2"
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
            className="input-industrial text-xs py-2 text-slate-700"
            title="Data Inicial"
          />
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="input-industrial text-xs py-2 text-slate-700"
            title="Data Final"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={carregarHistorico}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs uppercase rounded border border-amber-400 cursor-pointer flex items-center justify-center gap-1 shadow-sm"
          >
            <Filter className="w-4 h-4" />
            <span>FILTRAR</span>
          </button>
          <button
            onClick={handleLimparFiltros}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 text-xs uppercase rounded border border-slate-300 cursor-pointer shadow-sm"
          >
            LIMPAR
          </button>
        </div>
      </div>

      {/* Tabela Permanente de Movimentações */}
      <div className="flex-1 overflow-auto border border-slate-300 bg-white rounded-sm shadow-sm">
        <table className="table-industrial">
          <thead>
            <tr>
              <th>DATA / HORA</th>
              <th>TIPO</th>
              <th>CÓDIGO ITEM</th>
              <th>MATERIAL</th>
              <th>COLABORADOR</th>
              <th>MATRÍCULA</th>
              <th>OPERADOR BALCÃO</th>
              <th>OBSERVAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400 font-bold uppercase">
                  Nenhuma movimentação registrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              movimentacoes.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono text-xs text-slate-700 font-bold">{log.data_hora}</td>
                  <td>
                    {log.tipo === 'SAIDA' ? (
                      <span className="bg-red-100 text-red-700 border border-red-300 px-2.5 py-0.5 text-[11px] font-extrabold rounded font-mono uppercase">
                        SAÍDA
                      </span>
                    ) : log.tipo === 'ENTRADA' ? (
                      <span className="bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-extrabold rounded font-mono uppercase">
                        ENTRADA
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-[11px] font-extrabold rounded font-mono uppercase">
                        MANUTENÇÃO
                      </span>
                    )}
                  </td>
                  <td className="font-mono font-bold text-amber-700">{log.material_codigo}</td>
                  <td className="font-bold text-slate-900">{log.material_nome}</td>
                  <td className="font-bold text-slate-900 uppercase">{log.colaborador_nome}</td>
                  <td className="font-mono text-blue-700 text-xs font-bold">{log.colaborador_matricula}</td>
                  <td className="text-slate-600 text-xs font-mono">{log.operador_nome}</td>
                  <td className="text-slate-500 text-xs italic">{log.observacao || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
