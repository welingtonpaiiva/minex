import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Boxes, Users, Plus, Edit2, Wifi, Search, AlertTriangle, CheckCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Material, Colaborador, Categoria, Usuario } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { NfcReaderModal } from '../components/NfcReaderModal';

interface CadastroProps {
  user: Usuario | null;
}

export const Cadastro: React.FC<CadastroProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'materiais' | 'colaboradores'>('materiais');

  // Listas de Dados
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Modais de Criação/Edição
  const [modalMaterial, setModalMaterial] = useState<Partial<Material> | null>(null);
  const [modalColaborador, setModalColaborador] = useState<Partial<Colaborador> | null>(null);
  const [modalNfcColaboradorId, setModalNfcColaboradorId] = useState<number | null>(null);

  useEffect(() => {
    carregarDados();
  }, [activeTab, busca]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (activeTab === 'materiais') {
        const res = await api.get('/materiais', { params: { busca } });
        setMateriais(res.data);
        const catRes = await api.get('/materiais/categorias');
        setCategorias(catRes.data);
      } else {
        const res = await api.get('/colaboradores', { params: { busca } });
        setColaboradores(res.data);
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  // Salvar Material
  const handleSalvarMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMaterial?.nome || !modalMaterial?.codigo_interno) {
      setMensagem({ tipo: 'erro', texto: 'Nome e Código Interno são obrigatórios' });
      soundFX.playError();
      return;
    }

    try {
      if (modalMaterial.id) {
        await api.put(`/materiais/${modalMaterial.id}`, modalMaterial);
        setMensagem({ tipo: 'sucesso', texto: 'MATERIAL ATUALIZADO COM SUCESSO' });
      } else {
        await api.post('/materiais', modalMaterial);
        setMensagem({ tipo: 'sucesso', texto: 'MATERIAL CADASTRADO COM SUCESSO' });
      }
      soundFX.playSuccess();
      setModalMaterial(null);
      carregarDados();
    } catch (err: any) {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: err.response?.data?.error || 'Erro ao salvar material' });
    }
  };

  // Excluir Material
  const handleExcluirMaterial = async (mat: Material) => {
    if (mat.status === 'EM_USO') {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: 'Não é possível excluir um material que está em uso no momento.' });
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o material "${mat.nome}" (${mat.codigo_interno})?`)) {
      return;
    }

    try {
      await api.delete(`/materiais/${mat.id}`);
      soundFX.playSuccess();
      setMensagem({ tipo: 'sucesso', texto: `Material ${mat.codigo_interno} excluído com sucesso!` });
      carregarDados();
    } catch (err: any) {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: err.response?.data?.error || 'Erro ao excluir material' });
    }
  };

  // Salvar Colaborador
  const handleSalvarColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalColaborador?.nome || !modalColaborador?.matricula) {
      setMensagem({ tipo: 'erro', texto: 'Nome e Matrícula são obrigatórios' });
      soundFX.playError();
      return;
    }

    try {
      if (modalColaborador.id) {
        await api.put(`/colaboradores/${modalColaborador.id}`, modalColaborador);
        setMensagem({ tipo: 'sucesso', texto: 'COLABORADOR ATUALIZADO COM SUCESSO' });
      } else {
        await api.post('/colaboradores', modalColaborador);
        setMensagem({ tipo: 'sucesso', texto: 'COLABORADOR CADASTRADO COM SUCESSO' });
      }
      soundFX.playSuccess();
      setModalColaborador(null);
      carregarDados();
    } catch (err: any) {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: err.response?.data?.error || 'Erro ao salvar colaborador' });
    }
  };

  // Associar NFC ao Colaborador
  const handleAssociarNfc = async (nfcId: string) => {
    if (!modalNfcColaboradorId && !modalColaborador) return;

    try {
      if (modalColaborador) {
        setModalColaborador({ ...modalColaborador, nfc_id: nfcId });
        setModalNfcColaboradorId(null);
        setMensagem({ tipo: 'sucesso', texto: `NFC CAPTURADO: ${nfcId}` });
        soundFX.playSuccess();
        return;
      }

      if (modalNfcColaboradorId) {
        await api.patch(`/colaboradores/${modalNfcColaboradorId}/nfc`, { nfc_id: nfcId });
        soundFX.playSuccess();
        setMensagem({ tipo: 'sucesso', texto: 'CARTÃO NFC ASSOCIADO COM SUCESSO' });
        setModalNfcColaboradorId(null);
        carregarDados();
      }
    } catch (err: any) {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: err.response?.data?.error || 'Erro ao associar NFC' });
    }
  };

  // Alternar Ativo/Inativo do Colaborador
  const handleToggleStatusColaborador = async (colab: Colaborador) => {
    const novoStatus = colab.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await api.put(`/colaboradores/${colab.id}`, { status: novoStatus });
      soundFX.playSuccess();
      setMensagem({ tipo: 'sucesso', texto: `COLABORADOR ${colab.nome} ALTERADO PARA ${novoStatus}` });
      carregarDados();
    } catch (err: any) {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: err.response?.data?.error || 'Erro ao alterar status' });
    }
  };

  // Enviar Material para Manutenção
  const handleAlternarManutencao = async (mat: Material) => {
    const novoStatus = mat.status === 'MANUTENCAO' ? 'DISPONIVEL' : 'MANUTENCAO';
    try {
      await api.patch(`/materiais/${mat.id}/status`, {
        status: novoStatus,
        observacao: novoStatus === 'MANUTENCAO' ? 'Enviado para manutenção via cadastro' : 'Retornado da manutenção'
      });
      soundFX.playSuccess();
      setMensagem({ tipo: 'sucesso', texto: `MATERIAL ${mat.codigo_interno} ALTERADO PARA ${novoStatus}` });
      carregarDados();
    } catch (err: any) {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: err.response?.data?.error || 'Erro ao alterar status' });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans select-none overflow-y-auto min-h-screen">
      <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6 flex-1">
        
        {/* NOTIFICAÇÃO ALERTA */}
        {mensagem && (
          <div
            className={`p-4 rounded-2xl font-bold text-xs flex justify-between items-center shrink-0 border shadow-sm ${
              mensagem.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-center gap-3">
              {mensagem.tipo === 'sucesso' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{mensagem.texto}</span>
            </div>
            <button onClick={() => setMensagem(null)} className="text-xs font-bold underline cursor-pointer">OK</button>
          </div>
        )}

        {/* ABAS & BARRA DE PESQUISA & BOTÃO NOVO (PADRÃO SITE) */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          
          {/* ABAS PRINCIPAIS (MATERIAIS VS COLABORADORES) */}
          <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('materiais');
                setBusca('');
              }}
              className={`px-5 py-2.5 rounded-lg font-extrabold text-xs uppercase flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'materiais'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>MATERIAIS</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('colaboradores');
                setBusca('');
              }}
              className={`px-5 py-2.5 rounded-lg font-extrabold text-xs uppercase flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'colaboradores'
                  ? 'bg-[#331274] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>COLABORADORES</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Pesquisar ${activeTab === 'materiais' ? 'material por código ou nome...' : 'colaborador por nome, matrícula ou NFC...'}`}
              className="w-full py-2.5 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>

          {user?.nivel_acesso !== 'CONSULTA' && (
            <button
              onClick={() => {
                if (activeTab === 'materiais') {
                  setModalMaterial({ nome: '', codigo_interno: '', codigo_barras: '', status: 'DISPONIVEL' });
                } else {
                  setModalColaborador({ nome: '', matricula: '', status: 'ATIVO' });
                }
              }}
              className="bg-[#331274] hover:bg-[#43208C] text-white font-extrabold px-5 py-2.5 rounded-xl uppercase text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>NOVO {activeTab === 'materiais' ? 'MATERIAL' : 'COLABORADOR'}</span>
            </button>
          )}
        </div>

        {/* MODAL LEITOR NFC */}
        <NfcReaderModal
          isOpen={modalNfcColaboradorId !== null}
          onClose={() => setModalNfcColaboradorId(null)}
          onNfcRead={handleAssociarNfc}
          title="GRAVAR CRACHÁ NFC"
          subtitle="Aproxime o novo cartão NFC para vincular ao colaborador"
        />

        {/* TABELA DE MATERIAIS */}
        {activeTab === 'materiais' && (
          <div className="flex-1 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                    <th className="py-3.5 px-4">CÓDIGO INTERNO</th>
                    <th className="py-3.5 px-4">CÓDIGO BARRAS</th>
                    <th className="py-3.5 px-4">MATERIAL</th>
                    <th className="py-3.5 px-4">CATEGORIA</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4">POSSE ATUAL</th>
                    <th className="py-3.5 px-4 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {materiais.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500 font-bold uppercase">
                        Nenhum material encontrado.
                      </td>
                    </tr>
                  ) : (
                    materiais.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
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
                        <td className="text-center py-3.5 px-4">
                          <div className="flex justify-center gap-2">
                            {user?.nivel_acesso === 'ADMINISTRADOR' && (
                              <>
                                <button
                                  onClick={() => setModalMaterial(item)}
                                  className="bg-slate-100 hover:bg-slate-200 text-[#331274] p-2 rounded-xl border border-slate-200 cursor-pointer transition-all shadow-sm"
                                  title="Editar Material"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {item.status !== 'EM_USO' && (
                                  <button
                                    onClick={() => handleExcluirMaterial(item)}
                                    className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded-xl border border-red-200 hover:border-red-600 cursor-pointer transition-colors shadow-sm"
                                    title="Excluir Material"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                            {item.status !== 'EM_USO' && (
                              <button
                                onClick={() => handleAlternarManutencao(item)}
                                className={`p-2 rounded-xl border cursor-pointer transition-colors shadow-sm ${
                                  item.status === 'MANUTENCAO'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }`}
                                title={item.status === 'MANUTENCAO' ? 'Retornar da Manutenção' : 'Enviar para Manutenção'}
                              >
                                <ShieldAlert className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABELA DE COLABORADORES */}
        {activeTab === 'colaboradores' && (
          <div className="flex-1 overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                    <th className="py-3.5 px-4">MATRÍCULA</th>
                    <th className="py-3.5 px-4">NOME DO COLABORADOR</th>
                    <th className="py-3.5 px-4">SETOR</th>
                    <th className="py-3.5 px-4">CARGO</th>
                    <th className="py-3.5 px-4">CARTÃO NFC</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {colaboradores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500 font-bold uppercase">
                        Nenhum colaborador encontrado.
                      </td>
                    </tr>
                  ) : (
                    colaboradores.map((item) => (
                      <tr key={item.id} className={`transition-colors ${item.status === 'INATIVO' ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50'}`}>
                        <td className="font-mono font-extrabold text-[#331274] py-3.5 px-4">{item.matricula}</td>
                        <td className="font-bold text-slate-900 py-3.5 px-4">{item.nome}</td>
                        <td className="text-slate-600 font-medium py-3.5 px-4">{item.setor || '-'}</td>
                        <td className="text-slate-600 font-medium py-3.5 px-4">{item.cargo || '-'}</td>
                        <td className="font-mono text-slate-800 font-bold py-3.5 px-4">
                          {item.nfc_id ? (
                            <div className="flex items-center gap-1.5">
                              <Wifi className="w-3.5 h-3.5 text-[#331274]" />
                              <span>{item.nfc_id}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-normal">NENHUM</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={item.status} size="sm" />
                        </td>
                        <td className="text-center py-3.5 px-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => setModalNfcColaboradorId(item.id)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-300 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                              title="Gravar / Alterar NFC"
                            >
                              <Wifi className="w-3.5 h-3.5" />
                              <span>GRAVAR NFC</span>
                            </button>
                            <button
                              onClick={() => setModalColaborador(item)}
                              className="bg-slate-100 hover:bg-slate-200 text-[#331274] p-2 rounded-xl border border-slate-200 cursor-pointer transition-all shadow-sm"
                              title="Editar Colaborador"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatusColaborador(item)}
                              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl border cursor-pointer shadow-sm transition-all ${
                                item.status === 'ATIVO'
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {item.status === 'ATIVO' ? 'INATIVAR' : 'ATIVAR'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL CRIAR/EDITAR MATERIAL */}
        {modalMaterial && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 w-full max-w-lg p-6 sm:p-8 rounded-2xl shadow-2xl">
              <h3 className="text-xl font-extrabold text-[#331274] uppercase tracking-tight mb-5 font-['Outfit']">
                {modalMaterial.id ? 'EDITAR MATERIAL' : 'CADASTRAR NOVO MATERIAL'}
              </h3>
              <form onSubmit={handleSalvarMaterial} className="space-y-4 font-sans">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">NOME DO MATERIAL:</label>
                  <input
                    type="text"
                    value={modalMaterial.nome || ''}
                    onChange={(e) => setModalMaterial({ ...modalMaterial, nome: e.target.value })}
                    placeholder="Ex: Lanterna de Capacete LED"
                    required
                    className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">CÓDIGO INTERNO:</label>
                    <input
                      type="text"
                      value={modalMaterial.codigo_interno || ''}
                      onChange={(e) =>
                        setModalMaterial({
                          ...modalMaterial,
                          codigo_interno: e.target.value,
                          codigo_barras: modalMaterial.codigo_barras || e.target.value
                        })
                      }
                      placeholder="Ex: LAT-001"
                      disabled={!!modalMaterial.id}
                      required
                      className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-[#331274] placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">CÓDIGO DE BARRAS:</label>
                    <input
                      type="text"
                      value={modalMaterial.codigo_barras || ''}
                      onChange={(e) => setModalMaterial({ ...modalMaterial, codigo_barras: e.target.value })}
                      placeholder="Ex: LAT-001"
                      disabled={!!modalMaterial.id}
                      className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-[#331274] placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">CATEGORIA:</label>
                  <select
                    value={modalMaterial.categoria_id || ''}
                    onChange={(e) => setModalMaterial({ ...modalMaterial, categoria_id: parseInt(e.target.value) })}
                    className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                  >
                    <option value="">Selecione a categoria...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">OBSERVAÇÃO:</label>
                  <textarea
                    value={modalMaterial.observacao || ''}
                    onChange={(e) => setModalMaterial({ ...modalMaterial, observacao: e.target.value })}
                    placeholder="Observações técnicas..."
                    rows={2}
                    className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="submit"
                    className="flex-1 bg-[#331274] hover:bg-[#43208C] text-white font-extrabold py-3.5 uppercase rounded-xl cursor-pointer shadow-md transition-all text-xs tracking-wider"
                  >
                    SALVAR
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalMaterial(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 uppercase rounded-xl border border-slate-300 cursor-pointer shadow-sm transition-all text-xs"
                  >
                    CANCELAR
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CRIAR/EDITAR COLABORADOR */}
        {modalColaborador && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 w-full max-w-lg p-6 sm:p-8 rounded-2xl shadow-2xl">
              <h3 className="text-xl font-extrabold text-[#331274] uppercase tracking-tight mb-5 font-['Outfit']">
                {modalColaborador.id ? 'EDITAR COLABORADOR' : 'CADASTRAR NOVO COLABORADOR'}
              </h3>
              <form onSubmit={handleSalvarColaborador} className="space-y-4 font-sans">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">NOME COMPLETO:</label>
                  <input
                    type="text"
                    value={modalColaborador.nome || ''}
                    onChange={(e) => setModalColaborador({ ...modalColaborador, nome: e.target.value })}
                    placeholder="Ex: ENZO DE OLIVEIRA FIRMO"
                    required
                    className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">MATRÍCULA:</label>
                  <input
                    type="text"
                    value={modalColaborador.matricula || ''}
                    onChange={(e) => setModalColaborador({ ...modalColaborador, matricula: e.target.value })}
                    placeholder="Ex: 99300922"
                    disabled={!!modalColaborador.id}
                    required
                    className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-[#331274] placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">SETOR:</label>
                    <input
                      type="text"
                      value={modalColaborador.setor || ''}
                      onChange={(e) => setModalColaborador({ ...modalColaborador, setor: e.target.value })}
                      placeholder="Ex: OPERAÇÃO"
                      className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">CARGO:</label>
                    <input
                      type="text"
                      value={modalColaborador.cargo || ''}
                      onChange={(e) => setModalColaborador({ ...modalColaborador, cargo: e.target.value })}
                      placeholder="Ex: Operador de LHD"
                      className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">CÓDIGO CARTÃO NFC:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={modalColaborador.nfc_id || ''}
                      onChange={(e) => setModalColaborador({ ...modalColaborador, nfc_id: e.target.value })}
                      placeholder="Sem cartão vinculado"
                      className="flex-1 py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-[#331274] placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setModalNfcColaboradorId(modalColaborador.id || 999)}
                      className="bg-[#331274] hover:bg-[#43208C] text-white font-extrabold px-4 py-3 text-xs uppercase rounded-xl cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
                    >
                      <Wifi className="w-4 h-4 text-amber-400" />
                      <span>LER CARTÃO</span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="submit"
                    className="flex-1 bg-[#331274] hover:bg-[#43208C] text-white font-extrabold py-3.5 uppercase rounded-xl cursor-pointer shadow-md transition-all text-xs tracking-wider"
                  >
                    SALVAR
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalColaborador(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 uppercase rounded-xl border border-slate-300 cursor-pointer shadow-sm transition-all text-xs"
                  >
                    CANCELAR
                  </button>
                </div>
              </form>
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
