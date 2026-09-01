import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Boxes, Users, Plus, Edit2, History, Wifi, Search, AlertTriangle, CheckCircle, ShieldAlert, Trash2 } from 'lucide-react';
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
          <h2 className="text-xl font-extrabold text-blue-700 uppercase tracking-wider font-mono">
            CADASTRO GERAL DO SISTEMA
          </h2>
        </div>

        {/* Abas Principais (Materiais vs Colaboradores) */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab('materiais');
              setBusca('');
            }}
            className={`px-6 py-2.5 rounded font-extrabold text-sm uppercase flex items-center gap-2 border cursor-pointer ${
              activeTab === 'materiais'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <Boxes className="w-5 h-5" />
            <span>MATERIAIS</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('colaboradores');
              setBusca('');
            }}
            className={`px-6 py-2.5 rounded font-extrabold text-sm uppercase flex items-center gap-2 border cursor-pointer ${
              activeTab === 'colaboradores'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>COLABORADORES</span>
          </button>
        </div>
      </div>

      {/* Notificação Alerta */}
      {mensagem && (
        <div
          className={`mb-4 p-3 rounded font-bold text-sm flex justify-between items-center shrink-0 border-2 shadow-sm ${
            mensagem.tipo === 'sucesso'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
              : 'bg-red-50 border-red-500 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {mensagem.tipo === 'sucesso' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span>{mensagem.texto}</span>
          </div>
          <button onClick={() => setMensagem(null)} className="text-xs underline cursor-pointer">OK</button>
        </div>
      )}

      {/* Barra de Pesquisa & Botão Novo */}
      <div className="flex items-center justify-between gap-4 mb-4 shrink-0 bg-white p-3 rounded border border-slate-300 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Pesquisar ${activeTab === 'materiais' ? 'material por código/nome...' : 'colaborador por nome/matrícula/NFC...'}`}
            className="input-industrial text-sm py-2 pl-10"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-2.5 rounded border border-blue-500 uppercase text-sm flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>NOVO {activeTab === 'materiais' ? 'MATERIAL' : 'COLABORADOR'}</span>
          </button>
        )}
      </div>

      {/* Modal Leitor NFC de Associar Crachá */}
      <NfcReaderModal
        isOpen={modalNfcColaboradorId !== null}
        onClose={() => setModalNfcColaboradorId(null)}
        onNfcRead={handleAssociarNfc}
        title="GRAVAR CRACHÁ NFC"
        subtitle="Aproxime o novo cartão NFC para vincular ao colaborador"
      />

      {/* TABELA DE MATERIAIS */}
      {activeTab === 'materiais' && (
        <div className="flex-1 overflow-auto border border-slate-300 bg-white rounded-sm shadow-sm">
          <table className="table-industrial">
            <thead>
              <tr>
                <th>CÓDIGO INTERNO</th>
                <th>CÓDIGO BARRAS</th>
                <th>NOME DO MATERIAL</th>
                <th>CATEGORIA</th>
                <th>STATUS</th>
                <th>RESPONSÁVEL ATUAL</th>
                <th className="text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {materiais.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-bold uppercase">
                    Nenhum material encontrado.
                  </td>
                </tr>
              ) : (
                materiais.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono font-bold text-amber-700">{item.codigo_interno}</td>
                    <td className="font-mono text-slate-600">{item.codigo_barras}</td>
                    <td className="font-bold text-slate-900">{item.nome}</td>
                    <td className="text-slate-600">{item.categoria_nome || 'Geral'}</td>
                    <td>
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td className="text-slate-700">
                      {item.colaborador_nome ? (
                        <div>
                          <div className="font-bold text-emerald-700">{item.colaborador_nome}</div>
                          <div className="text-[10px] font-mono text-slate-500">MAT: {item.colaborador_matricula}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        {user?.nivel_acesso === 'ADMINISTRADOR' && (
                          <>
                            <button
                              onClick={() => setModalMaterial(item)}
                              className="bg-slate-100 hover:bg-slate-200 text-blue-700 p-1.5 rounded border border-slate-300 cursor-pointer shadow-sm"
                              title="Editar Material"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {item.status !== 'EM_USO' && (
                              <button
                                onClick={() => handleExcluirMaterial(item)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded border border-red-300 cursor-pointer shadow-sm"
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
                            className={`p-1.5 rounded border cursor-pointer shadow-sm ${
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
      )}

      {/* TABELA DE COLABORADORES */}
      {activeTab === 'colaboradores' && (
        <div className="flex-1 overflow-auto border border-slate-300 bg-white rounded-sm shadow-sm">
          <table className="table-industrial">
            <thead>
              <tr>
                <th>MATRÍCULA</th>
                <th>NOME DO COLABORADOR</th>
                <th>SETOR</th>
                <th>CARGO</th>
                <th>CARTÃO NFC</th>
                <th>STATUS</th>
                <th className="text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-bold uppercase">
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              ) : (
                colaboradores.map((item) => (
                  <tr key={item.id} className={item.status === 'INATIVO' ? 'opacity-60 bg-slate-100' : ''}>
                    <td className="font-mono font-bold text-blue-700">{item.matricula}</td>
                    <td className="font-bold text-slate-900">{item.nome}</td>
                    <td className="text-slate-600">{item.setor || '-'}</td>
                    <td className="text-slate-600">{item.cargo || '-'}</td>
                    <td className="font-mono text-amber-700">
                      {item.nfc_id ? (
                        <div className="flex items-center gap-1">
                          <Wifi className="w-3.5 h-3.5 text-amber-600" />
                          <span>{item.nfc_id}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">NENHUM</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setModalNfcColaboradorId(item.id)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1 text-xs font-bold rounded border border-amber-300 cursor-pointer flex items-center gap-1 shadow-sm"
                          title="Gravar / Alterar NFC"
                        >
                          <Wifi className="w-3.5 h-3.5" />
                          <span>GRAVAR NFC</span>
                        </button>
                        <button
                          onClick={() => setModalColaborador(item)}
                          className="bg-slate-100 hover:bg-slate-200 text-blue-700 p-1.5 rounded border border-slate-300 cursor-pointer shadow-sm"
                          title="Editar Colaborador"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatusColaborador(item)}
                          className={`px-2 py-1 text-xs font-bold rounded border cursor-pointer shadow-sm ${
                            item.status === 'ATIVO'
                              ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
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
      )}

      {/* MODAL CRIAR/EDITAR MATERIAL */}
      {modalMaterial && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-blue-500 w-full max-w-lg p-6 rounded shadow-2xl">
            <h3 className="text-xl font-extrabold text-blue-700 uppercase tracking-wider mb-4 font-mono">
              {modalMaterial.id ? 'EDITAR MATERIAL' : 'CADASTRAR NOVO MATERIAL'}
            </h3>
            <form onSubmit={handleSalvarMaterial} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NOME DO MATERIAL:</label>
                <input
                  type="text"
                  value={modalMaterial.nome || ''}
                  onChange={(e) => setModalMaterial({ ...modalMaterial, nome: e.target.value })}
                  placeholder="Ex: Lanterna de Capacete LED"
                  required
                  className="input-industrial text-sm py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CÓDIGO INTERNO:</label>
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
                    className="input-industrial text-sm py-2 text-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CÓDIGO DE BARRAS:</label>
                  <input
                    type="text"
                    value={modalMaterial.codigo_barras || ''}
                    onChange={(e) => setModalMaterial({ ...modalMaterial, codigo_barras: e.target.value })}
                    placeholder="Ex: LAT-001"
                    disabled={!!modalMaterial.id}
                    className="input-industrial text-sm py-2 text-amber-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CATEGORIA:</label>
                <select
                  value={modalMaterial.categoria_id || ''}
                  onChange={(e) => setModalMaterial({ ...modalMaterial, categoria_id: parseInt(e.target.value) })}
                  className="input-industrial text-sm py-2"
                >
                  <option value="">Selecione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">OBSERVAÇÃO:</label>
                <textarea
                  value={modalMaterial.observacao || ''}
                  onChange={(e) => setModalMaterial({ ...modalMaterial, observacao: e.target.value })}
                  placeholder="Observações técnicas..."
                  rows={2}
                  className="input-industrial text-sm py-2 font-sans font-normal"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 uppercase rounded border border-blue-500 cursor-pointer shadow-md"
                >
                  SALVAR
                </button>
                <button
                  type="button"
                  onClick={() => setModalMaterial(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3 uppercase rounded border border-slate-300 cursor-pointer shadow-sm"
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
          <div className="bg-white border-2 border-blue-500 w-full max-w-lg p-6 rounded shadow-2xl">
            <h3 className="text-xl font-extrabold text-blue-700 uppercase tracking-wider mb-4 font-mono">
              {modalColaborador.id ? 'EDITAR COLABORADOR' : 'CADASTRAR NOVO COLABORADOR'}
            </h3>
            <form onSubmit={handleSalvarColaborador} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NOME COMPLETO:</label>
                <input
                  type="text"
                  value={modalColaborador.nome || ''}
                  onChange={(e) => setModalColaborador({ ...modalColaborador, nome: e.target.value })}
                  placeholder="Ex: ENZO DE OLIVEIRA FIRMO"
                  required
                  className="input-industrial text-sm py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">MATRÍCULA:</label>
                <input
                  type="text"
                  value={modalColaborador.matricula || ''}
                  onChange={(e) => setModalColaborador({ ...modalColaborador, matricula: e.target.value })}
                  placeholder="Ex: 99300922"
                  disabled={!!modalColaborador.id}
                  required
                  className="input-industrial text-sm py-2 text-blue-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">SETOR:</label>
                  <input
                    type="text"
                    value={modalColaborador.setor || ''}
                    onChange={(e) => setModalColaborador({ ...modalColaborador, setor: e.target.value })}
                    placeholder="Ex: OPERAÇÃO"
                    className="input-industrial text-sm py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CARGO:</label>
                  <input
                    type="text"
                    value={modalColaborador.cargo || ''}
                    onChange={(e) => setModalColaborador({ ...modalColaborador, cargo: e.target.value })}
                    placeholder="Ex: Operador de LHD"
                    className="input-industrial text-sm py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CÓDIGO CARTÃO NFC:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modalColaborador.nfc_id || ''}
                    onChange={(e) => setModalColaborador({ ...modalColaborador, nfc_id: e.target.value })}
                    placeholder="Sem cartão vinculado"
                    className="input-industrial text-sm py-2 font-mono text-amber-700 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setModalNfcColaboradorId(modalColaborador.id || 999)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 text-xs uppercase rounded cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                  >
                    <Wifi className="w-4 h-4" />
                    <span>LER CARTÃO</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 uppercase rounded border border-blue-500 cursor-pointer shadow-md"
                >
                  SALVAR
                </button>
                <button
                  type="button"
                  onClick={() => setModalColaborador(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3 uppercase rounded border border-slate-300 cursor-pointer shadow-sm"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
