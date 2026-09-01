import React, { useState, useEffect } from 'react';
import { Wifi, CreditCard, X, CheckCircle2 } from 'lucide-react';
import { soundFX } from '../services/soundFX';
import { api } from '../services/api';
import { Colaborador } from '../types';

interface NfcReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNfcRead: (nfcId: string) => void;
  title?: string;
  subtitle?: string;
}

export const NfcReaderModal: React.FC<NfcReaderModalProps> = ({
  isOpen,
  onClose,
  onNfcRead,
  title = 'APROXIME O CRACHÁ NFC',
  subtitle = 'Aproxime o cartão do leitor de balcão'
}) => {
  const [readState, setReadState] = useState<{ active: boolean; nfcId: string }>({
    active: false,
    nfcId: ''
  });
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setReadState({ active: false, nfcId: '' });
      setColaborador(null);
      setShowManual(false);
      setManualCode('');
      return;
    }

    let buffer = '';
    let timeoutId: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Se um input ou textarea estiver focado (ex: digitação manual), o elemento cuida
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Enter') {
        const cleanCode = buffer.trim();
        if (cleanCode.length >= 3) {
          triggerRead(cleanCode);
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1) {
        // Leitores RFID/NFC transmitem em alta velocidade (<50ms). Reseta se houver pausa > 400ms.
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          buffer = '';
        }, 400);

        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerRead = async (nfcId: string) => {
    soundFX.playScan();
    let found: Colaborador | null = null;
    try {
      const res = await api.get(`/colaboradores/nfc/${nfcId}`);
      found = res.data;
      setColaborador(found);
    } catch (_) {
      setColaborador(null);
    }

    setReadState({ active: true, nfcId });

    setTimeout(() => {
      onNfcRead(nfcId);
    }, found ? 1100 : 700);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      triggerRead(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-none z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-emerald-500 w-full max-w-md p-6 rounded-lg shadow-2xl relative select-none">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {readState.active ? (
          /* Estado de Leitura Confirmada Instantânea */
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2 border-2 border-emerald-500 shadow-sm animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-emerald-700 uppercase tracking-wide font-mono">
              CRACHÁ IDENTIFICADO!
            </h3>

            {colaborador ? (
              <div className="bg-slate-50 p-4 rounded border border-slate-300 w-full text-left font-sans shadow-sm mt-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">
                  RESPONSÁVEL:
                </div>
                <div className="text-lg font-black text-slate-900 uppercase leading-snug">
                  {colaborador.nome}
                </div>
                <div className="text-xs text-slate-600 font-mono mt-1">
                  MATRÍCULA: <span className="text-emerald-700 font-bold">{colaborador.matricula}</span>
                </div>
                <div className="text-xs text-slate-600 font-mono">
                  SETOR: {colaborador.setor || '-'}
                </div>
                <div className="text-xs text-slate-600 font-mono">
                  CARGO: {colaborador.cargo || '-'}
                </div>
              </div>
            ) : (
              <span className="text-xs font-mono text-slate-500 mt-2 block">
                NFC: {readState.nfcId}
              </span>
            )}
          </div>
        ) : (
          /* Estado Minimalista de Aguardando Leitura */
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 bg-amber-50 text-amber-600 border-2 border-amber-400 rounded-full flex items-center justify-center mb-4 animate-pulse shadow-sm">
              <Wifi className="w-10 h-10 rotate-90" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wider font-mono">
              {title}
            </h2>
            <p className="text-slate-500 text-xs mt-1 mb-6">
              {subtitle}
            </p>

            {/* Opção para digitar código manual se o leitor falhar */}
            {!showManual ? (
              <button
                onClick={() => setShowManual(true)}
                className="mt-3 text-[11px] text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
              >
                Digitar código NFC ou Matrícula manualmente
              </button>
            ) : (
              <form onSubmit={handleManualSubmit} className="w-full mt-3 flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Código NFC ou Matrícula..."
                  autoFocus
                  className="input-industrial flex-1 text-xs py-1.5 font-mono"
                />
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1.5 text-xs uppercase rounded cursor-pointer"
                >
                  OK
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

