import { Colaborador } from '../types';
import { NfcReaderModal } from './NfcReaderModal';

export function ReturnNfcConfirmation({ isOpen, person, onClose, onConfirm }: {
  isOpen: boolean; person: { id: number; nome: string } | null;
  onClose: () => void; onConfirm: (nfcId: string) => Promise<void>;
}) {
  return <NfcReaderModal isOpen={isOpen && !!person} onClose={onClose} nfcOnly
    title="CONFIRMAR DEVOLUÇÃO — LEIA O CRACHÁ NFC"
    subtitle={'Confira os itens selecionados e aproxime novamente o crachá de ' + (person?.nome || '') + ' para concluir a devolução.'}
    onNfcRead={async (code: string, found?: Colaborador) => {
      if (!found || found.id !== person?.id) throw new Error('Este crachá pertence a outro colaborador. Informe o NFC de ' + person?.nome + '.');
      await onConfirm(code);
    }}/>;
}
