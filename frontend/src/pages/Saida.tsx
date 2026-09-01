import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Barcode, Trash2, CheckCircle2, AlertTriangle, Wifi, CreditCard, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Colaborador, Material, SaidaStep } from '../types';
import { NfcReaderModal } from '../components/NfcReaderModal';

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
    <div className="flex-1 flex flex-col bg-slate-100 p-4 overflow-hidden select-none">
      {/* Cabeçalho da Tela de Saída */}
      <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-300 mb-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded border border-slate-300 font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>VOLTAR</span>
          </button>
          <h2 className="text-xl font-extrabold text-red-600 uppercase tracking-wider font-mono flex items-center gap-2">
            SAÍDA DE MATERIAL
          </h2>
        </div>

        {/* Indicador do Colaborador Identificado */}
        {colaborador ? (
          <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 px-4 py-1.5 rounded flex items-center gap-3 shadow-sm">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="font-extrabold text-sm uppercase leading-none">{colaborador.nome}</div>
              <div className="text-[10px] font-mono text-emerald-700">MAT: {colaborador.matricula} | {colaborador.cargo}</div>
            </div>
            <button
              onClick={() => {
                setShowNfcModal(true);
                setStep('WAITING_NFC');
              }}
              className="ml-2 text-xs font-bold underline hover:text-emerald-950 cursor-pointer"
            >
              TROCAR
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNfcModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded font-extrabold text-xs uppercase flex items-center gap-2 cursor-pointer animate-pulse shadow-sm"
          >
            <Wifi className="w-4 h-4" />
            <span>LER CRACHÁ NFC</span>
          </button>
        )}
      </div>

      {/* Mensagem de Erro / Alerta */}
      {mensagemErro && (
        <div className="mb-4 bg-red-50 border-2 border-red-500 text-red-800 p-3 rounded font-bold text-sm flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{mensagemErro}</span>
          </div>
          <button onClick={() => setMensagemErro('')} className="text-xs underline cursor-pointer">OK</button>
        </div>
      )}

      {/* Modal Leitor NFC */}
      <NfcReaderModal
        isOpen={showNfcModal}
        onClose={() => setShowNfcModal(false)}
        onNfcRead={handleNfcRead}
        title="SAÍDA — APROXIME O CRACHÁ"
        subtitle="Aproxime o cartão NFC do colaborador para iniciar a saída de materiais"
      />

      {/* Conteúdo Principal conforme Estado */}
      {step === 'SUCCESS' && resumoSucesso ? (
        <div className="flex-1 bg-white border-4 border-emerald-500 rounded p-6 flex flex-col items-center justify-center text-center shadow-lg">
          <CheckCircle2 className="w-20 h-20 text-emerald-600 mb-4 animate-bounce" />
          <h2 className="text-3xl font-black text-emerald-700 uppercase tracking-widest font-mono mb-2">
            SAÍDA REGISTRADA COM SUCESSO!
          </h2>
          <p className="text-lg text-slate-800 font-bold mb-6">
            {resumoSucesso.materiaisCount} material(is) vinculados a {resumoSucesso.colaborador?.nome}
          </p>

          <div className="bg-slate-50 p-4 rounded border border-slate-300 w-full max-w-lg mb-8 text-left font-mono text-sm shadow-inner">
            <div className="text-amber-700 font-bold border-b border-slate-300 pb-2 mb-2">ITENS REGISTRADOS EM USO:</div>
            {resumoSucesso.materiais?.map((item: any) => (
              <div key={item.id} className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-900 font-bold">{item.codigo_interno}</span>
                <span className="text-slate-600">{item.nome}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleReiniciar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-8 py-4 uppercase text-lg rounded cursor-pointer border-2 border-emerald-500 shadow-md"
            >
              NOVA SAÍDA
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-8 py-4 uppercase text-lg rounded cursor-pointer border border-slate-300 shadow-sm"
            >
              VOLTAR AO MENU
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          {/* Painel Esquerdo: Scanner Input & Informações do Colaborador */}
          <div className="w-full md:w-1/3 bg-white p-4 rounded border border-slate-300 flex flex-col shrink-0 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Barcode className="w-5 h-5 text-red-600" />
              1. LEITURA DE MATERIAIS
            </h3>

            {/* Input Escanear Código */}
            <form onSubmit={handleMaterialScan} className="mb-4">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                ESCANEAR CÓDIGO DE BARRAS / DIGITAR CÓDIGO:
              </label>
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Ex: LAT-001"
                disabled={!colaborador}
                className="input-industrial border-red-500 text-red-600"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Pressione ENTER ou use o scanner USB HID
              </span>
            </form>

            {/* Detalhes do Colaborador */}
            {colaborador && (
              <div className="bg-slate-50 p-4 rounded border border-slate-300 mt-auto shadow-inner">
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">RESPONSÁVEL PELA SAÍDA:</div>
                <div className="text-lg font-black text-slate-900 uppercase leading-snug">{colaborador.nome}</div>
                <div className="text-xs text-slate-600 font-mono mt-1">MATRÍCULA: <span className="text-emerald-700 font-bold">{colaborador.matricula}</span></div>
                <div className="text-xs text-slate-600 font-mono">SETOR: {colaborador.setor || '-'}</div>
                <div className="text-xs text-slate-600 font-mono">CARGO: {colaborador.cargo || '-'}</div>
              </div>
            )}
          </div>

          {/* Painel Direito: Lista Temporária de Saída (Carrinho) */}
          <div className="flex-1 bg-white p-4 rounded border border-slate-300 flex flex-col min-h-0 shadow-sm">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
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

            {/* Tabela Tradicional Industrial */}
            <div className="flex-1 overflow-auto border border-slate-300 bg-white mb-4 rounded-sm">
              <table className="table-industrial">
                <thead>
                  <tr>
                    <th>CÓDIGO</th>
                    <th>MATERIAL</th>
                    <th>CATEGORIA</th>
                    <th className="text-center">AÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {carrinho.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400 font-bold uppercase">
                        Nenhum material escaneado. Aproxime o crachá e escaneie os equipamentos.
                      </td>
                    </tr>
                  ) : (
                    carrinho.map((item, index) => (
                      <tr key={`${item.id}-${index}`}>
                        <td className="font-mono font-bold text-red-600">{item.codigo_interno}</td>
                        <td className="font-bold text-slate-900">{item.nome}</td>
                        <td className="text-slate-600">{item.categoria_nome || 'Geral'}</td>
                        <td className="text-center">
                          <button
                            onClick={() => handleRemoverDoCarrinho(index)}
                            className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-1.5 rounded border border-red-200 hover:border-red-600 cursor-pointer transition-colors shadow-sm"
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

            {/* Botão Gigante de Confirmação da Saída */}
            <button
              onClick={handleConfirmarSaida}
              disabled={!colaborador || carrinho.length === 0 || loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-4 px-6 uppercase tracking-wider text-xl rounded border-2 border-red-500 disabled:border-slate-300 cursor-pointer shadow-md active:scale-[0.99] shrink-0"
            >
              {loading ? 'PROCESSANDO SAÍDA...' : `CONFIRMAR SAÍDA (${carrinho.length} MATERIAIS)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
