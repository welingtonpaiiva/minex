import React, { useState, useEffect } from 'react';
import { Wifi, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Colaborador } from '../types';
import { NfcReaderModal } from './NfcReaderModal';

interface ColaboradorModalProps {
  isOpen: boolean;
  colaboradorInicial: Partial<Colaborador> | null;
  onClose: () => void;
  onSave: (savedColaborador: Colaborador) => void;
}

export const ColaboradorModal: React.FC<ColaboradorModalProps> = ({
  isOpen,
  colaboradorInicial,
  onClose,
  onSave
}) => {
  const [colaborador, setColaborador] = useState<Partial<Colaborador> | null>(null);
  const [lerNfcAtivo, setLerNfcAtivo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && colaboradorInicial) {
      setColaborador({ ...colaboradorInicial });
      setMensagem(null);
    }
  }, [isOpen, colaboradorInicial]);

  if (!isOpen || !colaborador) return null;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaborador.nome || !colaborador.matricula) {
      setMensagem({ tipo: 'erro', texto: 'Nome e Matrícula são obrigatórios' });
      soundFX.playError();
      return;
    }

    setLoading(true);
    try {
      let savedColab: Colaborador;
      if (colaborador.id) {
        const res = await api.put(`/colaboradores/${colaborador.id}`, colaborador);
        savedColab = res.data;
      } else {
        const res = await api.post('/colaboradores', colaborador);
        savedColab = res.data;
      }
      soundFX.playSuccess();
      onSave(savedColab);
    } catch (err: any) {
      soundFX.playError();
      setMensagem({ tipo: 'erro', texto: err.response?.data?.error || 'Erro ao salvar colaborador' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssociarNfc = (nfcId: string) => {
    setColaborador({ ...colaborador, nfc_id: nfcId });
    setLerNfcAtivo(false);
    setMensagem({ tipo: 'sucesso', texto: `NFC LIDO COM SUCESSO: ${nfcId}` });
    soundFX.playSuccess();
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 w-full max-w-lg p-6 sm:p-8 rounded-2xl shadow-2xl relative">
          
          {/* NOTIFICAÇÃO ALERTA INTERNA */}
          {mensagem && (
            <div
              className={`mb-4 p-3 rounded-xl font-bold text-xs flex justify-between items-center border shadow-sm ${
                mensagem.tipo === 'sucesso'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-center gap-2">
                {mensagem.tipo === 'sucesso' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{mensagem.texto}</span>
              </div>
              <button onClick={() => setMensagem(null)} className="text-xs font-bold underline cursor-pointer">OK</button>
            </div>
          )}

          <h3 className="text-xl font-extrabold text-[#331274] uppercase tracking-tight mb-5 font-['Outfit']">
            {colaborador.id ? 'EDITAR COLABORADOR' : 'CADASTRAR NOVO COLABORADOR'}
          </h3>

          <form onSubmit={handleSalvar} className="space-y-4 font-sans">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">NOME COMPLETO:</label>
              <input
                type="text"
                value={colaborador.nome || ''}
                onChange={(e) => setColaborador({ ...colaborador, nome: e.target.value })}
                placeholder="Ex: ENZO DE OLIVEIRA FIRMO"
                required
                className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">MATRÍCULA:</label>
              <input
                type="text"
                value={colaborador.matricula || ''}
                onChange={(e) => setColaborador({ ...colaborador, matricula: e.target.value })}
                placeholder="Ex: 99300922"
                disabled={!!colaborador.id}
                required
                className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-[#331274] placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">SETOR:</label>
                <input
                  type="text"
                  value={colaborador.setor || ''}
                  onChange={(e) => setColaborador({ ...colaborador, setor: e.target.value })}
                  placeholder="Ex: OPERAÇÃO"
                  className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5 font-['Outfit']">CARGO:</label>
                <input
                  type="text"
                  value={colaborador.cargo || ''}
                  onChange={(e) => setColaborador({ ...colaborador, cargo: e.target.value })}
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
                  value={colaborador.nfc_id || 'Sem cartão vinculado'}
                  readOnly
                  className="flex-1 py-3 px-4 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-500 focus:outline-none transition-all cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setLerNfcAtivo(true)}
                  className="bg-[#331274] hover:bg-[#43208C] text-white font-extrabold px-4 py-3 text-xs uppercase rounded-xl cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
                >
                  <Wifi className="w-4 h-4 text-amber-400" />
                  <span>{lerNfcAtivo ? 'AGUARDANDO CRACHÁ...' : 'LER NFC'}</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#331274] hover:bg-[#43208C] text-white font-extrabold py-3.5 uppercase rounded-xl cursor-pointer shadow-md transition-all text-xs tracking-wider disabled:opacity-70"
              >
                {loading ? 'SALVANDO...' : 'SALVAR'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 uppercase rounded-xl border border-slate-300 cursor-pointer shadow-sm transition-all text-xs"
              >
                CANCELAR
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL LEITOR NFC (INTERNO) */}
      <NfcReaderModal
        isOpen={lerNfcAtivo}
        onClose={() => setLerNfcAtivo(false)}
        onNfcRead={handleAssociarNfc}
        title="GRAVAR CRACHÁ NFC"
        subtitle="Aproxime o cartão NFC para vincular ao colaborador"
      />
    </>
  );
};
