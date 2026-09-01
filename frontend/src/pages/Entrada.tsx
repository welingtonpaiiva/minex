import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Barcode, CheckCircle2, AlertTriangle, Wifi, RotateCcw, PackageCheck } from 'lucide-react';
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
        setMensagemErro(`NENHUM MATERIAL EM USO PARA ESTE COLABORADOR (${colab.nome})`);
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

  // Confirmar Devolução no Backend (Transação Atômica)
  const handleConfirmarEntrada = async () => {
    if (!colaborador) return;

    const selecionados = emprestimosTemp.filter((e) => e.devolvido);
    if (selecionados.length === 0) {
      soundFX.playError();
      setMensagemErro('Selecione ou escaneie pelo menos 1 material para confirmar a devolução.');
      return;
    }

    setLoading(true);
    setMensagemErro('');

    try {
      const materiaisCodigos = selecionados.map((m) => m.codigo_interno);
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
    <div className="flex-1 flex flex-col bg-slate-100 p-4 overflow-hidden select-none">
      {/* Cabeçalho da Tela de Entrada */}
      <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-300 mb-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded border border-slate-300 font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>VOLTAR</span>
          </button>
          <h2 className="text-xl font-extrabold text-emerald-700 uppercase tracking-wider font-mono flex items-center gap-2">
            ENTRADA DE MATERIAL (DEVOLUÇÃO)
          </h2>
        </div>

        {/* Indicador do Colaborador */}
        {colaborador ? (
          <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 px-4 py-1.5 rounded flex items-center gap-3 shadow-sm">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="font-extrabold text-sm uppercase leading-none">{colaborador.nome}</div>
              <div className="text-[10px] font-mono text-emerald-700">MAT: {colaborador.matricula}</div>
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

      {/* Alerta de Turno Excedido no Colaborador */}
      {colaborador && itensExcedidosCount > 0 && (
        <div className="mb-4 bg-red-50 border-2 border-red-500 text-red-900 p-3 rounded font-bold text-sm flex items-center justify-between shrink-0 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <div className="font-extrabold uppercase text-red-950">
                ⚠️ ATENÇÃO: TURNO EXCEDIDO (+8 HORAS DE POSSE)
              </div>
              <div className="text-xs text-red-800 font-normal">
                Este colaborador possui {itensExcedidosCount} equipamento(s) retirados há mais de 8 horas!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Erro */}
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
        title="ENTRADA — APROXIME O CRACHÁ"
        subtitle="Aproxime o cartão NFC para buscar os materiais sob posse do colaborador"
      />

      {/* Conteúdo Principal */}
      {step === 'SUCCESS' && resumoSucesso ? (
        <div className="flex-1 bg-white border-4 border-emerald-500 rounded p-6 flex flex-col items-center justify-center text-center shadow-lg">
          <CheckCircle2 className="w-20 h-20 text-emerald-600 mb-4 animate-bounce" />
          <h2 className="text-3xl font-black text-emerald-700 uppercase tracking-widest font-mono mb-2">
            ENTRADA REGISTRADA COM SUCESSO!
          </h2>
          <p className="text-lg text-slate-800 font-bold mb-6">
            {resumoSucesso.materiaisCount} material(is) devolvidos por {resumoSucesso.colaborador?.nome}
          </p>

          <div className="bg-slate-50 p-4 rounded border border-slate-300 w-full max-w-lg mb-8 text-left font-mono text-sm shadow-inner">
            <div className="text-emerald-700 font-bold border-b border-slate-300 pb-2 mb-2">ITENS RETORNADOS AO ESTOQUE:</div>
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
              NOVA ENTRADA
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-8 py-4 uppercase text-lg rounded cursor-pointer border border-slate-300 shadow-sm"
            >
              MENU PRINCIPAL
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          {/* Painel Esquerdo: Scanner Input */}
          <div className="w-full md:w-1/3 bg-white p-4 rounded border border-slate-300 flex flex-col shrink-0 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Barcode className="w-5 h-5 text-emerald-600" />
              1. LEITURA DE DEVOLUÇÃO
            </h3>

            <form onSubmit={handleMaterialScan} className="mb-4">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                ESCANEAR MATERIAL DEVOLVIDO:
              </label>
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Ex: LAT-001"
                disabled={!colaborador}
                className="input-industrial border-emerald-500 text-emerald-700"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Escaneie o código para marcar automaticamente como DEVOLVIDO
              </span>
            </form>

            {colaborador && (
              <div className="bg-slate-50 p-4 rounded border border-slate-300 mt-auto shadow-inner">
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">COLABORADOR:</div>
                <div className="text-lg font-black text-slate-900 uppercase leading-snug">{colaborador.nome}</div>
                <div className="text-xs text-slate-600 font-mono mt-1">MATRÍCULA: <span className="text-emerald-700 font-bold">{colaborador.matricula}</span></div>
                <div className="text-xs text-amber-700 font-mono font-bold mt-2">
                  EMPRÉSTIMOS PENDENTES: {emprestimosTemp.length - devolvidosCount} DE {emprestimosTemp.length}
                </div>
              </div>
            )}
          </div>

          {/* Painel Direito: Tabela de Materiais sob Posse do Colaborador */}
          <div className="flex-1 bg-white p-4 rounded border border-slate-300 flex flex-col min-h-0 shadow-sm">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                2. MATERIAIS EM POSSE DO COLABORADOR ({emprestimosTemp.length})
              </h3>
              <div className="text-xs font-bold font-mono text-emerald-700">
                MARCADOS PARA DEVOLUÇÃO: {devolvidosCount}
              </div>
            </div>

            <div className="flex-1 overflow-auto border border-slate-300 bg-white mb-4 rounded-sm">
              <table className="table-industrial">
                <thead>
                  <tr>
                    <th>CÓDIGO</th>
                    <th>MATERIAL</th>
                    <th>DATA DA SAÍDA / POSSE</th>
                    <th className="text-center">STATUS DEVOLUÇÃO</th>
                    <th className="text-center">AÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {emprestimosTemp.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 font-bold uppercase">
                        Aproxime o crachá do colaborador para carregar seus empréstimos ativos.
                      </td>
                    </tr>
                  ) : (
                    emprestimosTemp.map((item, index) => {
                      const uso = calcularHorasEmUso(item.data_hora_saida);
                      return (
                        <tr
                          key={item.emprestimo_id}
                          className={
                            item.devolvido
                              ? 'bg-emerald-50 border-l-4 border-l-emerald-600'
                              : uso.excedeu
                              ? 'bg-red-50 border-l-4 border-l-red-600'
                              : ''
                          }
                        >
                          <td className="font-mono font-bold text-amber-700">{item.codigo_interno}</td>
                          <td className="font-bold text-slate-900">{item.material_nome}</td>
                          <td>
                            <div className="font-mono text-xs text-slate-600">{item.data_hora_saida}</div>
                            {uso.excedeu && (
                              <span className="bg-red-100 text-red-800 border border-red-400 px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase inline-flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                TURNO EXCEDIDO (+{uso.horas}h)
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            {item.devolvido ? (
                              <span className="bg-emerald-600 text-white px-3 py-1 text-xs font-extrabold rounded font-mono uppercase shadow-sm">
                                ✓ DEVOLVIDO
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-amber-700 border border-amber-400 px-3 py-1 text-xs font-bold rounded font-mono uppercase">
                                PENDENTE
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => toggleDevolucaoItem(index)}
                              className={`px-3 py-1.5 text-xs font-bold rounded border cursor-pointer ${
                                item.devolvido
                                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                  : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
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

            {/* Botão Gigante de Confirmação da Entrada */}
            <button
              onClick={handleConfirmarEntrada}
              disabled={!colaborador || devolvidosCount === 0 || loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-4 px-6 uppercase tracking-wider text-xl rounded border-2 border-emerald-500 disabled:border-slate-300 cursor-pointer shadow-md active:scale-[0.99] shrink-0"
            >
              {loading ? 'PROCESSANDO ENTRADA...' : `CONFIRMAR ENTRADA (${devolvidosCount} MATERIAIS)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

