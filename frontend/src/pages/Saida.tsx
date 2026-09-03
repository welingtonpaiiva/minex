import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Barcode, Trash2, CheckCircle2, AlertTriangle, Wifi, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Colaborador, Material, SaidaStep } from '../types';
import { NfcReaderModal } from '../components/NfcReaderModal';
import { motion } from 'framer-motion';

export const Saida: React.FC = () => {
  const navigate = useNavigate();

  // Estados da Máquina de Estados de Saída
  const [step, setStep] = useState<SaidaStep>('WAITING_NFC');
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [carrinho, setCarrinho] = useState<Material[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNfcModal, setShowNfcModal] = useState(true);
  const [resumoSucesso, setResumoSucesso] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Manter foco no campo de código de barras durante a fase SCANNING_ITEMS
  useEffect(() => {
    if (step === 'SCANNING_ITEMS' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [step, carrinho]);

  // Handler de leitura NFC do colaborador
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
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || 'COLABORADOR NÃO ENCONTRADO PARA ESTE CARTÃO NFC');
    }
  };

  // Handler de leitura/digitação do Código de Barras do Material
  const handleMaterialScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const codigo = barcodeInput.trim();
    setBarcodeInput('');
    setMensagemErro('');

    // Verificar se já está na lista temporária
    if (carrinho.some((item) => item.codigo_barras === codigo || item.codigo_interno === codigo)) {
      soundFX.playError();
      setMensagemErro(`MATERIAL JÁ ADICIONADO NA LISTA: ${codigo}`);
      return;
    }

    try {
      const res = await api.get(`/materiais/codigo/${codigo}`);
      const mat: Material = res.data;

      // Validações de Status
      if (mat.status === 'EM_USO') {
        soundFX.playError();
        const resp = mat.colaborador_nome ? ` por ${mat.colaborador_nome}` : '';
        setMensagemErro(`MATERIAL JÁ ESTÁ EM USO (${mat.codigo_interno} - ${mat.nome})${resp}`);
        return;
      }

      if (mat.status === 'MANUTENCAO') {
        soundFX.playError();
        setMensagemErro(`MATERIAL EM MANUTENÇÃO (${mat.codigo_interno} - ${mat.nome}). Saída não permitida.`);
        return;
      }

      if (mat.status !== 'DISPONIVEL') {
        soundFX.playError();
        setMensagemErro(`MATERIAL INDISPONÍVEL (${mat.codigo_interno} - ${mat.nome})`);
        return;
      }

      // Adicionar à lista temporária
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

  // Confirmar Transação de Saída no Backend
  const handleConfirmarSaida = async () => {
    if (!colaborador || carrinho.length === 0) return;

    setLoading(true);
    setMensagemErro('');

    try {
      const materiaisCodigos = carrinho.map((m) => m.codigo_interno);
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

  const handleReiniciar = () => {
    setColaborador(null);
    setCarrinho([]);
    setBarcodeInput('');
    setMensagemErro('');
    setResumoSucesso(null);
    setShowNfcModal(true);
    setStep('WAITING_NFC');
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans select-none overflow-y-auto min-h-screen">
      <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6 flex-1">
        
        {/* STATUS / AÇÃO DO CRACHÁ NFC */}
        <div className="flex justify-end shrink-0">
          {colaborador ? (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-extrabold text-sm uppercase leading-none font-['Outfit']">{colaborador.nome}</div>
                <div className="text-xs font-semibold text-emerald-700 mt-0.5">MAT: {colaborador.matricula} | {colaborador.cargo || 'SUBTERRÂNEO'}</div>
              </div>
              <button
                onClick={() => {
                  setShowNfcModal(true);
                  setStep('WAITING_NFC');
                }}
                className="ml-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
              >
                TROCAR
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNfcModal(true)}
              className="bg-[#331274] hover:bg-[#43208C] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Wifi className="w-4 h-4 text-emerald-200 animate-pulse" />
              <span>APROXIMAR CRACHÁ NFC</span>
            </button>
          )}
        </div>

        {/* MENSAGEM DE ERRO / ALERTA */}
        {mensagemErro && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl font-bold text-xs flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{mensagemErro}</span>
            </div>
            <button onClick={() => setMensagemErro('')} className="text-xs font-bold underline cursor-pointer">OK</button>
          </div>
        )}

        {/* MODAL LEITOR NFC */}
        <NfcReaderModal
          isOpen={showNfcModal}
          onClose={() => setShowNfcModal(false)}
          onNfcRead={handleNfcRead}
          title="SAÍDA — APROXIME O CRACHÁ"
          subtitle="Aproxime o cartão NFC do colaborador para iniciar a saída de materiais"
        />

        {/* CONTEÚDO PRINCIPAL */}
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
                  <span className="text-[#331274] font-mono font-extrabold">{item.codigo_interno}</span>
                  <span className="text-slate-700">{item.nome}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={handleReiniciar}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-8 py-3.5 text-sm uppercase rounded-xl cursor-pointer shadow-md transition-all"
              >
                NOVA SAÍDA
              </button>
              <button
                onClick={() => navigate('/')}
                className="bg-[#331274] hover:bg-[#43208C] text-white font-extrabold px-8 py-3.5 text-sm uppercase rounded-xl cursor-pointer shadow-md transition-all"
              >
                VOLTAR AO MENU
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
            
            {/* PAINEL ESQUERDO: SCANNER INPUT & INFORMACÕES */}
            <div className="w-full md:w-1/3 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col shrink-0 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#331274] uppercase tracking-wider mb-4 flex items-center gap-2 font-['Outfit']">
                <Barcode className="w-5 h-5 text-[#331274]" />
                1. LEITURA DE MATERIAIS
              </h3>

              <form onSubmit={handleMaterialScan} className="mb-6">
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
                  Pressione ENTER ou utilize o leitor de código de barras USB
                </span>
              </form>

              {colaborador && (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mt-auto shadow-inner">
                  <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">RESPONSÁVEL PELA SAÍDA:</div>
                  <div className="text-base font-extrabold text-[#331274] uppercase font-['Outfit']">{colaborador.nome}</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">MATRÍCULA: <span className="text-slate-900 font-bold">{colaborador.matricula}</span></div>
                  <div className="text-xs text-slate-600 font-semibold">SETOR: {colaborador.setor || '-'}</div>
                  <div className="text-xs text-slate-600 font-semibold">CARGO: {colaborador.cargo || '-'}</div>
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
                  <button
                    onClick={() => setCarrinho([])}
                    className="text-xs text-red-600 hover:text-red-700 font-bold uppercase cursor-pointer"
                  >
                    LIMPAR LISTA
                  </button>
                )}
              </div>

              {/* TABELA DE MATERIAIS */}
              <div className="flex-1 overflow-auto border border-slate-200 bg-white mb-5 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                      <th className="py-3 px-4">CÓDIGO</th>
                      <th className="py-3 px-4">MATERIAL</th>
                      <th className="py-3 px-4">CATEGORIA</th>
                      <th className="py-3 px-4 text-center">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                    {carrinho.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-500 font-bold uppercase">
                          Nenhum material adicionado. Aproxime o crachá e escaneie os equipamentos.
                        </td>
                      </tr>
                    ) : (
                      carrinho.map((item, index) => (
                        <tr key={`${item.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                          <td className="font-mono font-extrabold text-[#331274] py-3.5 px-4">{item.codigo_interno}</td>
                          <td className="font-bold text-slate-900 py-3.5 px-4">{item.nome}</td>
                          <td className="text-slate-600 font-medium py-3.5 px-4">{item.categoria_nome || 'Geral'}</td>
                          <td className="text-center py-3.5 px-4">
                            <button
                              onClick={() => handleRemoverDoCarrinho(index)}
                              className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded-lg border border-red-200 hover:border-red-600 cursor-pointer transition-colors shadow-sm"
                              title="Remover Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* BOTÃO CONFIRMAR SAÍDA */}
              <button
                onClick={handleConfirmarSaida}
                disabled={!colaborador || carrinho.length === 0 || loading}
                className="w-full bg-[#331274] hover:bg-[#43208C] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-4 px-6 uppercase tracking-wider text-sm sm:text-base rounded-xl cursor-pointer shadow-md transition-all shrink-0 flex items-center justify-center gap-2"
              >
                <span>{loading ? 'PROCESSANDO SAÍDA...' : `CONFIRMAR SAÍDA (${carrinho.length} MATERIAIS)`}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
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
