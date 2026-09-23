import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Barcode, Trash2, CheckCircle2, AlertTriangle, Wifi, ArrowRight, Package, Plus, Briefcase, Trash } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Colaborador, Material, SaidaStep, Kit } from '../types';
import { NfcReaderModal } from '../components/NfcReaderModal';
import { ColaboradorModal } from '../components/ColaboradorModal';
import { motion } from 'framer-motion';

export const Saida: React.FC = () => {
  const navigate = useNavigate();

  // Estados
  const [activeTab, setActiveTab] = useState<'NORMAL' | 'KITS'>('NORMAL');
  
  // Estados - Saída Normal
  const [step, setStep] = useState<SaidaStep>('WAITING_NFC');
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [carrinho, setCarrinho] = useState<Material[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNfcModal, setShowNfcModal] = useState(true);
  const [showColaboradorModal, setShowColaboradorModal] = useState(false);
  const [unknownNfcId, setUnknownNfcId] = useState('');
  const [resumoSucesso, setResumoSucesso] = useState<any>(null);

  // Estados - Aba de Kits
  const [kits, setKits] = useState<Kit[]>([]);
  const [nomeKit, setNomeKit] = useState('');
  const [carrinhoKit, setCarrinhoKit] = useState<Material[]>([]);
  const [kitBarcodeInput, setKitBarcodeInput] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const kitBarcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchKits = async () => {
    try {
      const res = await api.get('/kits');
      setKits(res.data);
    } catch (err) {
      console.error('Erro ao buscar kits', err);
    }
  };

  useEffect(() => {
    fetchKits();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'NORMAL' && step === 'SCANNING_ITEMS' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    } else if (activeTab === 'KITS' && kitBarcodeInputRef.current) {
      kitBarcodeInputRef.current.focus();
    }
  }, [step, carrinho, activeTab, carrinhoKit]);

  // --- HANDLERS: MODO NORMAL ---

  // Esconder botão de voltar durante o escaneamento
  useEffect(() => {
    const btn = document.getElementById('btn-voltar-home');
    if (btn) {
      if (step === 'SCANNING_ITEMS') {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
      }
    }
    return () => {
      if (btn) btn.style.display = '';
    };
  }, [step]);
  const handleNfcRead = async (nfcId: string) => {
    setMensagemErro('');
    try {
      const res = await api.get(`/colaboradores/nfc/${nfcId}`);
      const colab: Colaborador = res.data;

      if (colab.status === 'INATIVO') {
        soundFX.playError();
        setMensagemErro(`COLABORADOR INATIVO: ${colab.nome} (${colab.matricula}). Saída bloqueada.`);
        return;
      }

      soundFX.playSuccess();
      setColaborador(colab);
      setShowNfcModal(false);
      setStep('SCANNING_ITEMS');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setUnknownNfcId(nfcId);
        setShowNfcModal(false);
        setShowColaboradorModal(true);
      } else {
        soundFX.playError();
        setMensagemErro(err.response?.data?.error || 'COLABORADOR NÃO ENCONTRADO PARA ESTE CARTÃO NFC');
      }
    }
  };

  const handleMaterialScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const codigo = barcodeInput.trim();
    setBarcodeInput('');
    setMensagemErro('');

    // Verificar se já está na lista temporária
    if (carrinho.some((item) => item.codigo_barras === codigo )) {
      soundFX.playError();
      setMensagemErro(`MATERIAL JÁ ADICIONADO NA LISTA: ${codigo}`);
      return;
    }

    try {
      const res = await api.get(`/materiais/codigo/${codigo}`);
      const mat: Material = res.data;

      if (mat.status === 'EM_USO') {
        soundFX.playError();
        const resp = mat.colaborador_nome ? ` por ${mat.colaborador_nome}` : '';
        setMensagemErro(`MATERIAL JÁ ESTÁ EM USO (${mat.nome})${resp}`);
        return;
      }
      if (mat.status === 'MANUTENCAO') {
        soundFX.playError();
        setMensagemErro(`MATERIAL EM MANUTENÇÃO (${mat.nome}). Saída não permitida.`);
        return;
      }
      if (mat.status !== 'DISPONIVEL') {
        soundFX.playError();
        setMensagemErro(`MATERIAL INDISPONÍVEL (${mat.nome})`);
        return;
      }

      soundFX.playScan();
      setCarrinho((prev) => [...prev, mat]);
    } catch (err: any) {
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || `MATERIAL NÃO CADASTRADO: ${codigo}`);
    }
  };

  const handleRemoverDoCarrinho = (index: number) => {
    setCarrinho((prev) => prev.filter((_, i) => i !== index));
    soundFX.playScan();
  };

  const handleConfirmarSaida = async () => {
    if (!colaborador || carrinho.length === 0) return;
    setLoading(true);
    setMensagemErro('');

    try {
      const materiaisCodigos = carrinho.map((m) => m.codigo_barras);
      const res = await api.post('/emprestimos/saida', {
        colaboradorId: colaborador.id,
        materiaisCodigos
      });
      soundFX.playSuccess();
      setResumoSucesso(res.data);
      setStep('SUCCESS');
    } catch (err: any) {
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || 'Erro ao registrar saída de materiais. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAtribuirKit = async (kitId: number) => {
    if (!colaborador) return;
    setLoading(true);
    setMensagemErro('');

    try {
      const res = await api.post('/kits/atribuir', {
        colaboradorId: colaborador.id,
        kitId
      });
      soundFX.playSuccess();
      setResumoSucesso(res.data);
      setStep('SUCCESS');
    } catch (err: any) {
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || 'Erro ao atribuir kit.');
    } finally {
      setLoading(false);
    }
  };

  const handleReiniciar = () => {
    setColaborador(null);
    setCarrinho([]);
    setBarcodeInput('');
    setMensagemErro('');
    setResumoSucesso(null);
    setShowNfcModal(true);
    setStep('WAITING_NFC');
  };

  // --- HANDLERS: MODO KITS ---

  const handleMaterialKitScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitBarcodeInput.trim()) return;

    const codigo = kitBarcodeInput.trim();
    setKitBarcodeInput('');
    setMensagemErro('');

    if (carrinhoKit.some((item) => item.codigo_barras === codigo || item.codigo_interno === codigo)) {
      soundFX.playError();
      setMensagemErro(`MATERIAL JÁ ADICIONADO NO KIT: ${codigo}`);
      return;
    }

    try {
      const res = await api.get(`/materiais/codigo/${codigo}`);
      const mat: Material = res.data;

      if (mat.status !== 'DISPONIVEL') {
        soundFX.playError();
        setMensagemErro(`MATERIAL NÃO ESTÁ DISPONÍVEL (${mat.codigo_interno} - Status: ${mat.status})`);
        return;
      }

      soundFX.playScan();
      setCarrinhoKit((prev) => [...prev, mat]);
    } catch (err: any) {
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || `MATERIAL NÃO ENCONTRADO: ${codigo}`);
    }
  };

  const handleRemoverDoCarrinhoKit = (index: number) => {
    setCarrinhoKit((prev) => prev.filter((_, i) => i !== index));
    soundFX.playScan();
  };

  const handleSalvarKit = async () => {
    if (!nomeKit.trim() || carrinhoKit.length === 0) return;
    setLoading(true);
    setMensagemErro('');

    try {
      await api.post('/kits', {
        nome: nomeKit,
        materiais: carrinhoKit.map(m => m.codigo_barras)
      });
      soundFX.playSuccess();
      setNomeKit('');
      setCarrinhoKit([]);
      fetchKits();
    } catch (err: any) {
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || 'Erro ao criar kit.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirKit = async (id: number) => {
    if (!confirm('Deseja realmente excluir este kit e liberar os itens?')) return;
    try {
      await api.delete(`/kits/${id}`);
      fetchKits();
    } catch (err: any) {
      setMensagemErro('Erro ao excluir kit');
    }
  };


  return (
    <div className="flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans select-none overflow-y-auto min-h-screen">
      <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6 flex-1">
        
        {/* TABS E STATUS DO CRACHÁ */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          
          <div className="flex bg-slate-200 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab('NORMAL');
                if (step === 'WAITING_NFC') setShowNfcModal(true);
              }}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'NORMAL' ? 'bg-white text-[#331274] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              SAÍDA NORMAL
            </button>
            <button
              onClick={() => {
                setActiveTab('KITS');
                setShowNfcModal(false);
              }}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'KITS' ? 'bg-white text-[#331274] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              PRÉ-MONTAR KITS
            </button>
          </div>

          {activeTab === 'NORMAL' && (
            <div className="flex justify-end">
              {colaborador ? (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm uppercase leading-none font-['Outfit']">{colaborador.nome}</div>
                    <div className="text-xs font-semibold text-emerald-700 mt-0.5">MAT: {colaborador.matricula}</div>
                  </div>
                  <button
                    onClick={handleReiniciar}
                    className="ml-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                  >
                    TROCAR
                  </button>
                </div>
              ) : step !== 'SUCCESS' && (
                <button
                  onClick={() => setShowNfcModal(true)}
                  className="bg-[#331274] hover:bg-[#43208C] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 cursor-pointer shadow-md transition-all"
                >
                  <Wifi className="w-4 h-4 text-emerald-200 animate-pulse" />
                  <span>APROXIMAR CRACHÁ NFC</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* MENSAGEM DE ERRO GERAL */}
        {mensagemErro && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl font-bold text-xs flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{mensagemErro}</span>
            </div>
            <button onClick={() => setMensagemErro('')} className="text-xs font-bold underline cursor-pointer">OK</button>
          </div>
        )}

        {/* ABA: SAÍDA NORMAL */}
        {activeTab === 'NORMAL' && (
          <>
            <NfcReaderModal
              isOpen={showNfcModal && step === 'WAITING_NFC'}
              onClose={() => setShowNfcModal(false)}
              onNfcRead={handleNfcRead}
              title="SAÍDA — APROXIME O CRACHÁ"
              subtitle="Aproxime o cartão NFC do colaborador para iniciar a saída de materiais"
            />

        {/* MODAL CADASTRO RÁPIDO */}
        <ColaboradorModal
          isOpen={showColaboradorModal}
          colaboradorInicial={{ nfc_id: unknownNfcId, status: 'ATIVO' }}
          onClose={() => {
            setShowColaboradorModal(false);
            setUnknownNfcId('');
            setShowNfcModal(true);
          }}
          onSave={(colab) => {
            setShowColaboradorModal(false);
            setUnknownNfcId('');
            soundFX.playSuccess();
            setColaborador(colab);
            setStep('SCANNING_ITEMS');
          }}
        />

            {step === 'SUCCESS' && resumoSucesso ? (
              <div className="flex-1 bg-white border border-emerald-300 rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-lg">
                <CheckCircle2 className="w-20 h-20 text-emerald-600 mb-4 animate-bounce" />
                <h2 className="text-3xl font-extrabold text-emerald-800 uppercase tracking-tight font-['Outfit'] mb-2">
                  SAÍDA REGISTRADA COM SUCESSO!
                </h2>
                <p className="text-lg text-slate-700 font-bold mb-6">
                  {resumoSucesso.materiaisCount} material(is) vinculados a {resumoSucesso.colaborador?.nome}
                </p>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 w-full max-w-lg mb-8 text-left text-xs font-sans shadow-inner">
                  <div className="text-[#331274] font-extrabold border-b border-slate-200 pb-2 mb-3 uppercase tracking-wider">
                    ITENS REGISTRADOS EM POSSE:
                  </div>
                  {resumoSucesso.materiais?.map((item: any) => (
                    <div key={item.id} className="flex justify-between py-1.5 border-b border-slate-200 font-semibold">
                      <span className="text-[#331274] font-mono font-extrabold">{item.codigo_barras}</span>
                      <span className="text-slate-700">{item.nome}</span>
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  <button onClick={handleReiniciar} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-8 py-3.5 text-sm uppercase rounded-xl cursor-pointer shadow-md transition-all">
                    NOVA SAÍDA
                  </button>
                  <button onClick={() => navigate('/')} className="bg-[#331274] hover:bg-[#43208C] text-white font-extrabold px-8 py-3.5 text-sm uppercase rounded-xl cursor-pointer shadow-md transition-all">
                    VOLTAR AO MENU
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
                {/* PAINEL ESQUERDO: SCANNER E KITS */}
                <div className="w-full md:w-1/3 flex flex-col gap-6 shrink-0">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col shadow-sm">
                    <h3 className="text-sm font-extrabold text-[#331274] uppercase tracking-wider mb-4 flex items-center gap-2 font-['Outfit']">
                      <Barcode className="w-5 h-5 text-[#331274]" />
                      1. LEITURA INDIVIDUAL
                    </h3>

                    <form onSubmit={handleMaterialScan} className="mb-2">
                      <label className="block text-xs font-extrabold text-slate-700 uppercase mb-2">
                        ESCANEAR OU DIGITAR CÓDIGO DO MATERIAL:
                      </label>
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        placeholder="Ex: LAT-001"
                        disabled={!colaborador}
                        className="w-full py-3.5 px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all shadow-sm disabled:opacity-50"
                      />
                      <span className="text-[11px] text-slate-500 font-medium mt-1.5 block">
                        Pressione ENTER ou utilize o leitor
                      </span>
                    </form>
                  </div>

                  {/* KITS DISPONÍVEIS */}
                  {colaborador && kits.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl shadow-sm flex flex-col gap-3">
                      <h3 className="text-sm font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
                        <Briefcase className="w-5 h-5 text-indigo-700" />
                        ATRIBUIR KIT PRÉ-MONTADO
                      </h3>
                      <p className="text-xs text-indigo-700 mb-2">Você pode atribuir um kit inteiro ao colaborador de uma só vez.</p>
                      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                        {kits.map(kit => (
                          <div key={kit.id} className="bg-white border border-indigo-200 p-3 rounded-xl flex items-center justify-between">
                            <div>
                              <div className="font-bold text-sm text-[#331274]">{kit.nome}</div>
                              <div className="text-xs text-slate-500">{kit.materiais?.length} itens</div>
                            </div>
                            <button
                              onClick={() => handleAtribuirKit(kit.id)}
                              disabled={loading || carrinho.length > 0}
                              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer transition-colors"
                            >
                              ATRIBUIR
                            </button>
                          </div>
                        ))}
                      </div>
                      {carrinho.length > 0 && (
                        <p className="text-[10px] text-amber-700 font-bold">
                          * Esvazie a lista individual ao lado para atribuir um kit.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* PAINEL DIREITO: LISTA TEMPORÁRIA (CARRINHO) */}
                <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col min-h-0 shadow-sm">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="text-sm font-extrabold text-[#331274] uppercase tracking-wider font-['Outfit']">
                      2. ITENS SELECIONADOS PARA SAÍDA ({carrinho.length})
                    </h3>
                    {carrinho.length > 0 && (
                      <button onClick={() => setCarrinho([])} className="text-xs text-red-600 hover:text-red-700 font-bold uppercase cursor-pointer">
                        LIMPAR LISTA
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto border border-slate-200 bg-white mb-5 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                          <th className="py-3 px-4">CÓDIGO</th>
                          <th className="py-3 px-4">MATERIAL</th>
                          <th className="py-3 px-4 text-center">AÇÃO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                        {carrinho.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-12 text-slate-500 font-bold uppercase">
                              Nenhum material adicionado. Escaneie os equipamentos ou atribua um Kit.
                            </td>
                          </tr>
                        ) : (
                          carrinho.map((item, index) => (
                            <tr key={`${item.id}-${index}`} className="hover:bg-slate-50">
                              <td className="font-mono font-extrabold text-[#331274] py-3.5 px-4">{item.codigo_barras}</td>
                              <td className="font-bold text-slate-900 py-3.5 px-4">{item.nome}</td>
                              <td className="text-center py-3.5 px-4">
                                <button onClick={() => handleRemoverDoCarrinho(index)} className="bg-red-50 text-red-600 p-2 rounded-lg border border-red-200">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleConfirmarSaida}
                    disabled={!colaborador || carrinho.length === 0 || loading}
                    className="w-full bg-[#331274] hover:bg-[#43208C] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-4 px-6 uppercase tracking-wider text-sm rounded-xl cursor-pointer shadow-md transition-all shrink-0 flex items-center justify-center gap-2"
                  >
                    <span>{loading ? 'PROCESSANDO SAÍDA...' : `CONFIRMAR SAÍDA (${carrinho.length} MATERIAIS)`}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ABA: PRÉ-MONTAR KITS */}
        {activeTab === 'KITS' && (
          <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
            {/* CRIAR KIT */}
            <div className="w-full md:w-1/2 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col shadow-sm">
              <h3 className="text-lg font-extrabold text-[#331274] uppercase tracking-wider mb-6 flex items-center gap-2 font-['Outfit']">
                <Plus className="w-6 h-6 text-[#331274]" />
                MONTAR NOVO KIT
              </h3>

              <div className="mb-4">
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-2">NOME DO KIT:</label>
                <input
                  type="text"
                  value={nomeKit}
                  onChange={(e) => setNomeKit(e.target.value.toUpperCase())}
                  placeholder="Ex: KIT MANUTENÇÃO ELÉTRICA 01"
                  className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#331274] focus:ring-2"
                />
              </div>

              <form onSubmit={handleMaterialKitScan} className="mb-6">
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-2">BIPAR MATERIAIS DO KIT:</label>
                <input
                  ref={kitBarcodeInputRef}
                  type="text"
                  value={kitBarcodeInput}
                  onChange={(e) => setKitBarcodeInput(e.target.value)}
                  placeholder="Código de Barras do Material"
                  className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#331274] focus:ring-2"
                />
              </form>

              <div className="flex-1 overflow-auto border border-slate-200 bg-slate-50 rounded-xl p-2 mb-4">
                {carrinhoKit.length === 0 ? (
                  <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase">
                    Nenhum material neste kit
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {carrinhoKit.map((item, index) => (
                      <div key={item.id} className="bg-white border border-slate-200 p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="font-mono font-extrabold text-[#331274] mr-2">{item.codigo_barras}</span>
                          <span className="text-sm font-semibold">{item.nome}</span>
                        </div>
                        <button onClick={() => handleRemoverDoCarrinhoKit(index)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              <button
                onClick={handleSalvarKit}
                disabled={!nomeKit.trim() || carrinhoKit.length === 0 || loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold py-3.5 px-6 uppercase tracking-wider text-sm rounded-xl cursor-pointer transition-all"
              >
                SALVAR KIT E DISPONIBILIZAR
              </button>
            </div>

            {/* LISTA DE KITS EXISTENTES */}
            <div className="w-full md:w-1/2 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col shadow-inner overflow-hidden">
              <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2 font-['Outfit']">
                <Briefcase className="w-6 h-6 text-slate-700" />
                KITS DISPONÍVEIS ({kits.length})
              </h3>

              <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
                {kits.length === 0 ? (
                  <div className="text-center py-10 text-sm font-bold text-slate-400 uppercase">
                    Não há kits montados no momento.
                  </div>
                ) : (
                  kits.map(kit => (
                    <div key={kit.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-extrabold text-base text-[#331274]">{kit.nome}</div>
                        <button
                          onClick={() => handleExcluirKit(kit.id)}
                          className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition-colors"
                          title="Desmontar Kit"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs font-bold text-slate-500 mb-2 uppercase">ITENS ({kit.materiais?.length}):</div>
                      <div className="flex flex-col gap-1">
                        {kit.materiais?.map(m => (
                          <div key={m.id} className="text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            <span className="font-mono font-bold text-[#331274]">{m.codigo_barras}</span> - {m.nome}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* RODAPÉ INSTITUCIONAL */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center text-xs text-slate-500 gap-2 font-sans shrink-0 text-center">
          <p>© {new Date().getFullYear()} Casa da Lanterna | Controle de Materiais de Mineração</p>
          <p><span className="opacity-40 mx-1.5">|</span> <span className="font-semibold text-slate-700">Dev by WP & EF</span></p>
        </div>

      </div>
    </div>
  );
};
