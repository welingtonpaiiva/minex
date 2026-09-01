import React, { useState, useEffect } from 'react';
import { Wifi, CreditCard, X, CheckCircle2 } from 'lucide-react';
import { soundFX } from '../services/soundFX';

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
  const [readState, setReadState] = useState<{ active: boolean; nfcId: string; cardName?: string }>({
    active: false,
    nfcId: ''
  });
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setReadState({ active: false, nfcId: '' });
      setShowManual(false);
      setManualCode('');
      return;
    }

    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        if (buffer.trim().length >= 4) {
          triggerRead(buffer.trim());
          buffer = '';
        }
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerRead = (nfcId: string, cardName?: string) => {
    soundFX.playScan();
    setReadState({ active: true, nfcId, cardName });
    setTimeout(() => {
      onNfcRead(nfcId);
    }, 700);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      triggerRead(manualCode.trim());
    }
  };

  // Cartões NFC de teste rápido para homologação do operador
  const testCards = [
    { nome: 'ENZO FIRMO', nfc: '00270584711361' },
    { nome: 'JOÃO DA SILVA', nfc: '00270584711362' },
    { nome: 'CARLOS SILVA', nfc: '00270584711363' }
  ];

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
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 border-2 border-emerald-500 shadow-sm animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-emerald-700 uppercase tracking-wide font-mono">
              CRACHÁ IDENTIFICADO!
            </h3>
            {readState.cardName && (
              <p className="text-slate-800 font-semibold mt-1 text-sm uppercase">
                {readState.cardName}
              </p>
            )}
            <span className="text-xs font-mono text-slate-500 mt-2">
              NFC: {readState.nfcId}
            </span>
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

            {/* Simulação Rápida / Testes */}
            <div className="w-full bg-slate-50 p-3 rounded border border-slate-200 text-left">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-2">
                Simulação Rápida (Clique para ler):
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {testCards.map((card) => (
                  <button
                    key={card.nfc}
                    onClick={() => triggerRead(card.nfc, card.nome)}
                    className="bg-white hover:bg-emerald-50 hover:border-emerald-400 text-slate-800 p-2 rounded border border-slate-200 text-center text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                  >
                    <div className="text-[11px] truncate">{card.nome.split(' ')[0]}</div>
                    <div className="text-[9px] font-mono text-amber-700 font-normal">{card.nfc.slice(-4)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opção para digitar código manual se o leitor falhar */}
            {!showManual ? (
              <button
                onClick={() => setShowManual(true)}
                className="mt-3 text-[11px] text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
              >
                Digitar código NFC manualmente
              </button>
            ) : (
              <form onSubmit={handleManualSubmit} className="w-full mt-3 flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Código NFC..."
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

