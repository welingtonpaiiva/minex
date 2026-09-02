import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Boxes, User, Clock, Search, ShieldAlert, CheckCircle, RefreshCw, FileText, AlertTriangle, PackageCheck, Wrench } from 'lucide-react';
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
    <div className="flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans select-none overflow-y-auto min-h-screen">
      <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6 flex-1">
        
        {/* 1. ALERTA DE TURNO EXCEDIDO */}
        {emprestimosExcedidos.length > 0 && (
          <div className="bg-red-50 border border-red-300 text-red-950 p-4 rounded-2xl font-bold text-xs flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 animate-pulse" />
              <div>
                <div className="font-extrabold uppercase text-red-950 font-['Outfit']">
                  ⚠️ ATENÇÃO: TURNO EXCEDIDO ({emprestimosExcedidos.length} EQUIPAMENTO{emprestimosExcedidos.length > 1 ? 'S' : ''})
                </div>
                <div className="text-xs text-red-800 font-semibold mt-0.5">
                  Materiais em posse de colaboradores ultrapassaram o tempo limite do turno (8 horas).
                </div>
              </div>
            </div>
            {tab !== 'em_uso' && (
              <button
                onClick={() => setTab('em_uso')}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl uppercase shadow-sm transition-all cursor-pointer"
              >
                VER MATERIAIS EXCEDIDOS
              </button>
            )}
          </div>
        )}

        {/* 2. CARDS DE KPIS DA OPERAÇÃO (ROUNDED-2XL) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">TOTAL MATERIAIS</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-[#331274] mt-1">{resumo.total}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#331274]/10 text-[#331274] flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">DISPONÍVEIS / GUARDADOS</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-emerald-700 mt-1">{resumo.disponiveis}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">EM USO NA MINA</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-[#331274] mt-1">{resumo.emUso}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#331274]/10 text-[#331274] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">EM MANUTENÇÃO</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-amber-700 mt-1">{resumo.manutencao}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3. BARRA DE FILTROS, ABAS E PESQUISA */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          
          {/* SUB-ABAS DO ESTOQUE */}
          <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTab('todos')}
              className={`px-4 py-2 rounded-lg font-extrabold text-xs uppercase transition-all cursor-pointer ${
                tab === 'todos'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              TODOS OS MATERIAIS ({resumo.total})
            </button>
            <button
              onClick={() => setTab('em_uso')}
              className={`px-4 py-2 rounded-lg font-extrabold text-xs uppercase transition-all cursor-pointer ${
                tab === 'em_uso'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              MATERIAIS EM USO ({resumo.emUso})
            </button>
            <button
              onClick={() => setTab('manutencao')}
              className={`px-4 py-2 rounded-lg font-extrabold text-xs uppercase transition-all cursor-pointer ${
                tab === 'manutencao'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              EM MANUTENÇÃO ({resumo.manutencao})
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por código, material ou colaborador..."
              className="w-full py-2.5 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>

          {tab !== 'em_uso' && (
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="py-2.5 px-4 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all max-w-xs shadow-sm"
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
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#331274] hover:bg-[#43208C] text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>ATUALIZAR DADOS</span>
          </button>
        </div>

        {/* 4. TABELA MATERIAIS EM USO */}
        {tab === 'em_uso' ? (
          <div className="flex-1 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                    <th className="py-3.5 px-4">CÓDIGO ITEM</th>
                    <th className="py-3.5 px-4">EQUIPAMENTO / MATERIAL</th>
                    <th className="py-3.5 px-4">COLABORADOR RESPONSÁVEL</th>
                    <th className="py-3.5 px-4">MATRÍCULA</th>
                    <th className="py-3.5 px-4">SETOR / CARGO</th>
                    <th className="py-3.5 px-4">DATA DA SAÍDA</th>
                    <th className="py-3.5 px-4">TEMPO EM POSSE</th>
                    <th className="py-3.5 px-4">OPERADOR SAÍDA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {emprestimosAtivos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500 font-bold uppercase">
                        Nenhum material está atualmente em uso na mina.
                      </td>
                    </tr>
                  ) : (
                    emprestimosAtivos.map((emp) => {
                      const uso = calcularHorasEmUso(emp.data_hora_saida);
                      return (
                        <tr key={emp.emprestimo_id} className={`transition-colors ${uso.excedeu ? 'bg-red-50/80 border-l-4 border-l-red-600 font-bold' : 'hover:bg-slate-50'}`}>
                          <td className="font-mono font-extrabold text-[#331274] py-3.5 px-4">{emp.codigo_interno}</td>
                          <td className="font-bold text-slate-900 py-3.5 px-4">{emp.material_nome}</td>
                          <td className="font-extrabold text-slate-900 uppercase py-3.5 px-4">{emp.colaborador_nome}</td>
                          <td className="font-mono text-[#331274] font-bold py-3.5 px-4">{emp.colaborador_matricula}</td>
                          <td className="text-slate-600 text-xs font-medium py-3.5 px-4">
                            {emp.setor || '-'} / {emp.cargo || '-'}
                          </td>
                          <td className="font-mono text-slate-700 text-xs font-semibold py-3.5 px-4">{emp.data_hora_saida}</td>
                          <td className="py-3.5 px-4">
                            {uso.excedeu ? (
                              <span className="bg-red-600 text-white px-2.5 py-1 rounded-md text-xs font-black uppercase inline-flex items-center gap-1 shadow-sm">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                TURNO EXCEDIDO (+{uso.horas}h)
                              </span>
                            ) : (
                              <span className="font-mono text-slate-800 font-bold text-xs">
                                {uso.horas}h {uso.diffMinutos % 60}m (OK)
                              </span>
                            )}
                          </td>
                          <td className="text-slate-600 text-xs font-semibold py-3.5 px-4">{emp.operador_saida_nome || 'OPERADOR'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TABELA TODOS OU MANUTENÇÃO */
          <div className="flex-1 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                    <th className="py-3.5 px-4">CÓDIGO INTERNO</th>
                    <th className="py-3.5 px-4">CÓDIGO BARRAS</th>
                    <th className="py-3.5 px-4">MATERIAL</th>
                    <th className="py-3.5 px-4">CATEGORIA</th>
                    <th className="py-3.5 px-4">STATUS ATUAL</th>
                    <th className="py-3.5 px-4">RESPONSÁVEL / POSSE</th>
                    <th className="py-3.5 px-4">SAÍDA REGISTRADA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {materiais.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500 font-bold uppercase">
                        Nenhum material encontrado no estoque.
                      </td>
                    </tr>
                  ) : (
                    materiais.map((item) => {
                      const uso = item.status === 'EM_USO' ? calcularHorasEmUso(item.data_hora_saida) : null;
                      return (
                        <tr key={item.id} className={`transition-colors ${uso?.excedeu ? 'bg-red-50/80 border-l-4 border-l-red-600 font-bold' : 'hover:bg-slate-50'}`}>
                          <td className="font-mono font-extrabold text-[#331274] py-3.5 px-4">{item.codigo_interno}</td>
                          <td className="font-mono text-slate-600 py-3.5 px-4">{item.codigo_barras}</td>
                          <td className="font-bold text-slate-900 py-3.5 px-4">{item.nome}</td>
                          <td className="text-slate-600 font-medium py-3.5 px-4">{item.categoria_nome || 'Geral'}</td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={item.status} size="sm" />
                          </td>
                          <td className="py-3.5 px-4">
                            {item.colaborador_nome ? (
                              <div>
                                <div className="font-bold text-[#331274] uppercase">{item.colaborador_nome}</div>
                                <div className="text-xs font-mono text-slate-500">MAT: {item.colaborador_matricula}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs font-semibold">- DISPONÍVEL -</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {uso?.excedeu ? (
                              <div>
                                <div className="font-mono text-xs text-slate-700">{item.data_hora_saida}</div>
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1 mt-0.5 shadow-sm">
                                  <AlertTriangle className="w-3 h-3" />
                                  TURNO EXCEDIDO (+{uso.horas}h)
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-xs text-slate-700 font-medium">
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
          </div>
        )}

        {/* RODAPÉ INSTITUCIONAL */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-sans shrink-0">
          <p>© {new Date().getFullYear()} Casa da Lanterna | Controle de Materiais de Mineração</p>
          <p><span className="opacity-40 mx-1.5">|</span> <span className="font-semibold text-slate-700">Dev by WP & EF</span></p>
        </div>

      </div>
    </div>
  );
};
