import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Boxes, User, Clock, Search, ShieldAlert, CheckCircle, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Material, EmprestimoAtivo, Categoria } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { calcularHorasEmUso } from '../utils/dateUtils';

export const Estoque: React.FC = () => {
  const navigate = useNavigate();

  const [tab, setTab] = useState<'todos' | 'em_uso' | 'manutencao'>('todos');
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [emprestimosAtivos, setEmprestimosAtivos] = useState<EmprestimoAtivo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Resumo de contadores
  const [resumo, setResumo] = useState({
    total: 0,
    disponiveis: 0,
    emUso: 0,
    manutencao: 0
  });

  useEffect(() => {
    carregarEstoque();
  }, [tab, busca, categoriaFiltro]);

  const carregarEstoque = async () => {
    setLoading(true);
    try {
      if (tab === 'em_uso') {
        const res = await api.get('/emprestimos/ativos', { params: { busca } });
        setEmprestimosAtivos(res.data);
      } else {
        const res = await api.get('/materiais', {
          params: {
            busca,
            status: tab === 'manutencao' ? 'MANUTENCAO' : undefined,
            categoria_id: categoriaFiltro ? parseInt(categoriaFiltro) : undefined
          }
        });
        setMateriais(res.data);
      }

      // Carregar estatísticas gerais
      const summaryRes = await api.get('/relatorios/resumo');
      setResumo({
        total: summaryRes.data.totalMateriais,
        disponiveis: summaryRes.data.disponiveis,
        emUso: summaryRes.data.emUso,
        manutencao: summaryRes.data.manutencao
      });

      const catRes = await api.get('/materiais/categorias');
      setCategorias(catRes.data);
    } catch (err: any) {
      console.error('Erro ao carregar estoque:', err);
    } finally {
      setLoading(false);
    }
  };

  // Verificar quais itens em uso ultrapassaram o limite de 8 horas
  const emprestimosExcedidos = (tab === 'em_uso' ? emprestimosAtivos : materiais.filter(m => m.status === 'EM_USO'))
    .filter(item => calcularHorasEmUso(item.data_hora_saida).excedeu);

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
          <h2 className="text-xl font-extrabold text-amber-700 uppercase tracking-wider font-mono">
            CONTROLE DE ESTOQUE E LOCALIZAÇÃO
          </h2>
        </div>

        {/* Sub-Abas do Estoque */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('todos')}
            className={`px-4 py-2 rounded font-extrabold text-xs uppercase cursor-pointer border ${
              tab === 'todos'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            TODOS OS MATERIAIS ({resumo.total})
          </button>
          <button
            onClick={() => setTab('em_uso')}
            className={`px-4 py-2 rounded font-extrabold text-xs uppercase cursor-pointer border ${
              tab === 'em_uso'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            MATERIAIS EM USO ({resumo.emUso})
          </button>
          <button
            onClick={() => setTab('manutencao')}
            className={`px-4 py-2 rounded font-extrabold text-xs uppercase cursor-pointer border ${
              tab === 'manutencao'
                ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            EM MANUTENÇÃO ({resumo.manutencao})
          </button>
        </div>
      </div>

      {/* Alerta de Turno Excedido (>8 horas) */}
      {emprestimosExcedidos.length > 0 && (
        <div className="mb-4 bg-red-50 border-2 border-red-500 text-red-900 p-3 rounded font-bold text-sm flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <div className="font-extrabold uppercase text-red-950 flex items-center gap-2">
                <span>⚠️ ATENÇÃO: TURNO EXCEDIDO ({emprestimosExcedidos.length} EQUIPAMENTO{emprestimosExcedidos.length > 1 ? 'S' : ''})</span>
              </div>
              <div className="text-xs text-red-800 font-normal">
                Materiais em posse de colaboradores ultrapassaram o tempo limite do turno (8 horas).
              </div>
            </div>
          </div>
          {tab !== 'em_uso' && (
            <button
              onClick={() => setTab('em_uso')}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-3 py-1.5 rounded uppercase border border-red-500 cursor-pointer shadow-sm"
            >
              VER MATERIAIS EXCEDIDOS
            </button>
          )}
        </div>
      )}

      {/* Barra de Resumo de Contadores */}
      <div className="grid grid-cols-4 gap-3 mb-4 shrink-0">
        <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between shadow-sm">
          <span className="text-xs font-bold text-slate-600 uppercase">TOTAL MATERIAIS:</span>
          <span className="text-xl font-black font-mono text-slate-900">{resumo.total}</span>
        </div>
        <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between shadow-sm">
          <span className="text-xs font-bold text-slate-600 uppercase">DISPONÍVEIS / GUARDADOS:</span>
          <span className="text-xl font-black font-mono text-slate-800">{resumo.disponiveis}</span>
        </div>
        <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between shadow-sm">
          <span className="text-xs font-bold text-slate-600 uppercase">EM USO NA MINA:</span>
          <span className="text-xl font-black font-mono text-emerald-700">{resumo.emUso}</span>
        </div>
        <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between shadow-sm">
          <span className="text-xs font-bold text-slate-600 uppercase">EM MANUTENÇÃO:</span>
          <span className="text-xl font-black font-mono text-amber-700">{resumo.manutencao}</span>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex items-center gap-3 mb-4 shrink-0 bg-white p-3 rounded border border-slate-300 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por código, material ou colaborador..."
            className="input-industrial text-sm py-2 pl-10"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {tab !== 'em_uso' && (
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="input-industrial text-sm py-2 max-w-xs"
          >
            <option value="">Todas as Categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={carregarEstoque}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded border border-slate-300 font-bold text-xs uppercase flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-4 h-4 text-amber-600" />
          <span>ATUALIZAR</span>
        </button>
      </div>

      {/* VISUALIZAÇÃO: MATERIAIS EM USO ("QUEM ESTÁ COM QUAL MATERIAL?") */}
      {tab === 'em_uso' ? (
        <div className="flex-1 overflow-auto border border-slate-300 bg-white rounded-sm shadow-sm">
          <table className="table-industrial">
            <thead>
              <tr>
                <th>CÓDIGO ITEM</th>
                <th>EQUIPAMENTO / MATERIAL</th>
                <th>COLABORADOR RESPONSÁVEL</th>
                <th>MATRÍCULA</th>
                <th>SETOR / CARGO</th>
                <th>DATA DA SAÍDA</th>
                <th>TEMPO EM POSSE / TURNO</th>
                <th>OPERADOR RESPONSÁVEL</th>
              </tr>
            </thead>
            <tbody>
              {emprestimosAtivos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-bold uppercase">
                    Nenhum material está atualmente em uso na mina.
                  </td>
                </tr>
              ) : (
                emprestimosAtivos.map((emp) => {
                  const uso = calcularHorasEmUso(emp.data_hora_saida);
                  return (
                    <tr key={emp.emprestimo_id} className={uso.excedeu ? 'bg-red-50/80 border-l-4 border-l-red-600' : ''}>
                      <td className="font-mono font-bold text-emerald-700">{emp.codigo_interno}</td>
                      <td className="font-bold text-slate-900">{emp.material_nome}</td>
                      <td className="font-extrabold text-amber-800 uppercase">{emp.colaborador_nome}</td>
                      <td className="font-mono text-blue-700 font-bold">{emp.colaborador_matricula}</td>
                      <td className="text-slate-600 text-xs">
                        {emp.setor || '-'} / {emp.cargo || '-'}
                      </td>
                      <td className="font-mono text-slate-600 text-xs">{emp.data_hora_saida}</td>
                      <td>
                        {uso.excedeu ? (
                          <span className="bg-red-100 text-red-800 border border-red-400 px-2 py-1 rounded text-xs font-extrabold font-mono uppercase inline-flex items-center gap-1 shadow-sm">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            TURNO EXCEDIDO (+{uso.horas}h)
                          </span>
                        ) : (
                          <span className="font-mono text-slate-600 text-xs">
                            {uso.horas}h {uso.diffMinutos % 60}m (OK)
                          </span>
                        )}
                      </td>
                      <td className="text-slate-500 text-xs font-mono">{emp.operador_saida_nome || 'OPERADOR'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* VISUALIZAÇÃO: TODOS OU MANUTENÇÃO */
        <div className="flex-1 overflow-auto border border-slate-300 bg-white rounded-sm shadow-sm">
          <table className="table-industrial">
            <thead>
              <tr>
                <th>CÓDIGO INTERNO</th>
                <th>CÓDIGO BARRAS</th>
                <th>MATERIAL</th>
                <th>CATEGORIA</th>
                <th>STATUS ATUAL</th>
                <th>RESPONSÁVEL / POSSE</th>
                <th>SAÍDA REGISTRADA / TEMPO</th>
              </tr>
            </thead>
            <tbody>
              {materiais.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-bold uppercase">
                    Nenhum material encontrado no estoque.
                  </td>
                </tr>
              ) : (
                materiais.map((item) => {
                  const uso = item.status === 'EM_USO' ? calcularHorasEmUso(item.data_hora_saida) : null;
                  return (
                    <tr key={item.id} className={uso?.excedeu ? 'bg-red-50/80 border-l-4 border-l-red-600' : ''}>
                      <td className="font-mono font-bold text-amber-700">{item.codigo_interno}</td>
                      <td className="font-mono text-slate-600">{item.codigo_barras}</td>
                      <td className="font-bold text-slate-900">{item.nome}</td>
                      <td className="text-slate-600">{item.categoria_nome || 'Geral'}</td>
                      <td>
                        <StatusBadge status={item.status} size="sm" />
                      </td>
                      <td>
                        {item.colaborador_nome ? (
                          <div className="font-bold text-emerald-700 uppercase">
                            {item.colaborador_nome}
                            <div className="text-[10px] font-mono text-slate-500 font-normal">
                              MAT: {item.colaborador_matricula}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">- DISPONÍVEL -</span>
                        )}
                      </td>
                      <td>
                        {uso?.excedeu ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs text-slate-600">{item.data_hora_saida}</div>
                            <span className="bg-red-100 text-red-800 border border-red-400 px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                              TURNO EXCEDIDO (+{uso.horas}h)
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-slate-600">
                            {item.data_hora_saida || '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

