import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Barcode, CheckCircle2, AlertTriangle, Wifi, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Colaborador, EmprestimoAtivo, EntradaStep } from '../types';
import { NfcReaderModal } from '../components/NfcReaderModal';
import { calcularHorasEmUso } from '../utils/dateUtils';

interface ItemDevolucaoTemp extends EmprestimoAtivo {
  devolvido: boolean;
}

export const Entrada: React.FC = () => {
  const navigate = useNavigate();

  // Máquina de Estados da Entrada
  const [step, setStep] = useState<EntradaStep>('WAITING_NFC');
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [emprestimosTemp, setEmprestimosTemp] = useState<ItemDevolucaoTemp[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNfcModal, setShowNfcModal] = useState(true);
  const [resumoSucesso, setResumoSucesso] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'SCANNING_RETURNS' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [step, emprestimosTemp]);

  // Handler de Leitura NFC
  const handleNfcRead = async (nfcId: string) => {
    setMensagemErro('');
    try {
      // 1. Buscar colaborador
      const colabRes = await api.get(`/colaboradores/nfc/${nfcId}`);
      const colab: Colaborador = colabRes.data;

      // 2. Carregar empréstimos ativos do colaborador
      const empRes = await api.get(`/emprestimos/colaborador/${colab.id}`);
      const emprestimos: EmprestimoAtivo[] = empRes.data;

      if (emprestimos.length === 0) {
        soundFX.playError();
        setMensagemErro(`COLABORADOR RECONHECIDO: ${colab.nome} (MAT: ${colab.matricula}), MAS NÃO POSSUI NENHUM MATERIAL SOB SUA POSSE NO MOMENTO.`);
        return;
      }

      soundFX.playSuccess();
      setColaborador(colab);
      setEmprestimosTemp(emprestimos.map((e) => ({ ...e, devolvido: false })));
      setShowNfcModal(false);
      setStep('SCANNING_RETURNS');
    } catch (err: any) {
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || 'COLABORADOR NÃO ENCONTRADO PARA ESTE CARTÃO NFC');
    }
  };

  // Handler de Escaneamento/Digitação do Material Devolvido
  const handleMaterialScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const codigo = barcodeInput.trim();
    setBarcodeInput('');
    setMensagemErro('');

    // Verificar se o material pertence à lista de posse deste colaborador
    const index = emprestimosTemp.findIndex(
      (item) => item.codigo_barras === codigo || item.codigo_interno === codigo
    );

    if (index === -1) {
      soundFX.playError();
      setMensagemErro(
        `MATERIAL NÃO REGISTRADO PARA ESTE COLABORADOR: O código ${codigo} não consta nos equipamentos emprestados para ${colaborador?.nome}.`
      );
      return;
    }

    if (emprestimosTemp[index].devolvido) {
      soundFX.playError();
      setMensagemErro(`MATERIAL JÁ REGISTRADO COMO DEVOLVIDO: ${codigo}`);
      return;
    }

    // Marcar como devolvido na lista temporária
    soundFX.playScan();
    setEmprestimosTemp((prev) =>
      prev.map((item, i) => (i === index ? { ...item, devolvido: true } : item))
    );
  };

  // Alternar devolução manualmente por clique na tabela
  const toggleDevolucaoItem = (index: number) => {
    soundFX.playScan();
    setEmprestimosTemp((prev) =>
      prev.map((item, i) => (i === index ? { ...item, devolvido: !item.devolvido } : item))
    );
  };

  // Confirmar Devolução no Backend
  const handleConfirmarEntrada = async () => {
    if (!colaborador) return;

    const selecionados = emprestimosTemp.filter((e) => e.devolvido);
    if (selecionados.length === 0) return;

    setLoading(true);
    setMensagemErro('');

    try {
      const materiaisCodigos = selecionados.map((e) => e.codigo_interno);
      const res = await api.post('/emprestimos/entrada', {
        colaboradorId: colaborador.id,
        materiaisCodigos
      });

      soundFX.playSuccess();
      setResumoSucesso(res.data);
      setStep('SUCCESS');
    } catch (err: any) {
      soundFX.playError();
      setMensagemErro(err.response?.data?.error || 'Erro ao registrar devolução. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleReiniciar = () => {
    setColaborador(null);
    setEmprestimosTemp([]);
    setBarcodeInput('');
    setMensagemErro('');
    setResumoSucesso(null);
    setShowNfcModal(true);
    setStep('WAITING_NFC');
  };

  const devolvidosCount = emprestimosTemp.filter((e) => e.devolvido).length;
  const itensExcedidosCount = emprestimosTemp.filter((e) => calcularHorasEmUso(e.data_hora_saida).excedeu).length;

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
                <div className="text-xs font-semibold text-emerald-700 mt-0.5">MAT: {colaborador.matricula}</div>
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
              <Wifi className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>APROXIMAR CRACHÁ NFC</span>
            </button>
          )}
        </div>

        {/* ALERTA DE TURNO EXCEDIDO NO COLABORADOR */}
        {colaborador && itensExcedidosCount > 0 && (
          <div className="bg-red-50 border border-red-300 text-red-900 p-4 rounded-2xl font-bold text-xs flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 animate-bounce" />
              <div>
                <div className="font-extrabold uppercase text-red-950 font-['Outfit']">
                  ⚠️ ATENÇÃO: TURNO EXCEDIDO (+8 HORAS DE POSSE)
                </div>
                <div className="text-xs text-red-800 font-semibold mt-0.5">
                  Este colaborador possui {itensExcedidosCount} equipamento(s) retirados há mais de 8 horas!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ALERTA DE ERRO */}
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
          title="ENTRADA — APROXIME O CRACHÁ"
          subtitle="Aproxime o cartão NFC para buscar os materiais sob posse do colaborador"
        />

        {/* CONTEÚDO PRINCIPAL */}
        {step === 'SUCCESS' && resumoSucesso ? (
          <div className="flex-1 bg-white border border-emerald-300 rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-lg">
            <CheckCircle2 className="w-20 h-20 text-emerald-600 mb-4 animate-bounce" />
            <h2 className="text-3xl font-extrabold text-emerald-800 uppercase tracking-tight font-['Outfit'] mb-2">
              ENTRADA REGISTRADA COM SUCESSO!
            </h2>
            <p className="text-lg text-slate-700 font-bold mb-6">
              {resumoSucesso.materiaisCount} material(is) devolvidos por {resumoSucesso.colaborador?.nome}
            </p>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 w-full max-w-lg mb-8 text-left text-xs font-sans shadow-inner">
              <div className="text-emerald-700 font-extrabold border-b border-slate-200 pb-2 mb-3 uppercase tracking-wider">
                ITENS RETORNADOS AO ESTOQUE:
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
                NOVA ENTRADA
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
            
            {/* PAINEL ESQUERDO: SCANNER INPUT */}
            <div className="w-full md:w-1/3 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col shrink-0 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#331274] uppercase tracking-wider mb-4 flex items-center gap-2 font-['Outfit']">
                <Barcode className="w-5 h-5 text-[#331274]" />
                1. LEITURA DE DEVOLUÇÃO
              </h3>

              <form onSubmit={handleMaterialScan} className="mb-6">
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-2">
                  ESCANEAR MATERIAL DEVOLVIDO:
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
                  Escaneie o código para marcar automaticamente como DEVOLVIDO
                </span>
              </form>

              {colaborador && (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mt-auto shadow-inner">
                  <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">RESPONSÁVEL PELA ENTRADA:</div>
                  <div className="text-base font-extrabold text-[#331274] uppercase font-['Outfit']">{colaborador.nome}</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">MATRÍCULA: <span className="text-slate-900 font-bold">{colaborador.matricula}</span></div>
                  <div className="text-xs text-slate-600 font-semibold">SETOR: {colaborador.setor || '-'}</div>
                  <div className="text-xs text-slate-600 font-semibold">CARGO: {colaborador.cargo || '-'}</div>
                  <div className="text-xs text-[#331274] font-extrabold mt-3 pt-3 border-t border-slate-200">
                    EMPRÉSTIMOS PENDENTES: {emprestimosTemp.length - devolvidosCount} DE {emprestimosTemp.length}
                  </div>
                </div>
              )}
            </div>

            {/* PAINEL DIREITO: TABELA DE MATERIAIS */}
            <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col min-h-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="text-sm font-extrabold text-[#331274] uppercase tracking-wider font-['Outfit']">
                  2. MATERIAIS EM POSSE DO COLABORADOR ({emprestimosTemp.length})
                </h3>
                <div className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  MARCADOS PARA DEVOLUÇÃO: {devolvidosCount}
                </div>
              </div>

              <div className="flex-1 overflow-auto border border-slate-200 bg-white mb-5 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 font-['Outfit']">
                      <th className="py-3 px-4">CÓDIGO</th>
                      <th className="py-3 px-4">MATERIAL</th>
                      <th className="py-3 px-4">DATA DA SAÍDA / POSSE</th>
                      <th className="py-3 px-4 text-center">STATUS DEVOLUÇÃO</th>
                      <th className="py-3 px-4 text-center">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                    {emprestimosTemp.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-500 font-bold uppercase">
                          Aproxime o crachá do colaborador para carregar seus empréstimos ativos.
                        </td>
                      </tr>
                    ) : (
                      emprestimosTemp.map((item, index) => {
                        const uso = calcularHorasEmUso(item.data_hora_saida);
                        return (
                          <tr
                            key={item.emprestimo_id}
                            className={`transition-colors ${
                              item.devolvido
                                ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600'
                                : uso.excedeu
                                ? 'bg-red-50/70 border-l-4 border-l-red-600'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="font-mono font-extrabold text-[#331274] py-3.5 px-4">{item.codigo_interno}</td>
                            <td className="font-bold text-slate-900 py-3.5 px-4">{item.material_nome}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-mono text-xs font-semibold text-slate-700">{item.data_hora_saida}</div>
                              {uso.excedeu && (
                                <span className="bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-flex items-center gap-1 mt-1">
                                  <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                  TURNO EXCEDIDO (+{uso.horas}h)
                                </span>
                              )}
                            </td>
                            <td className="text-center py-3.5 px-4">
                              {item.devolvido ? (
                                <span className="bg-emerald-600 text-white px-3 py-1 text-xs font-extrabold rounded-lg uppercase shadow-sm">
                                  ✓ DEVOLVIDO
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1 text-xs font-bold rounded-lg uppercase">
                                  PENDENTE
                                </span>
                              )}
                            </td>
                            <td className="text-center py-3.5 px-4">
                              <button
                                onClick={() => toggleDevolucaoItem(index)}
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                                  item.devolvido
                                    ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                    : 'bg-[#331274] text-white border-[#331274] hover:bg-[#43208C]'
                                }`}
                              >
                                {item.devolvido ? 'DESMARCAR' : 'MARCAR'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* BOTÃO CONFIRMAR ENTRADA */}
              <button
                onClick={handleConfirmarEntrada}
                disabled={!colaborador || devolvidosCount === 0 || loading}
                className="w-full bg-[#331274] hover:bg-[#43208C] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-4 px-6 uppercase tracking-wider text-sm sm:text-base rounded-xl cursor-pointer shadow-md transition-all shrink-0 flex items-center justify-center gap-2"
              >
                <span>{loading ? 'PROCESSANDO ENTRADA...' : `CONFIRMAR ENTRADA (${devolvidosCount} MATERIAIS)`}</span>
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
