import { queryOne, lockRow } from '../config/db';
import { id, text } from './OperationalService';

const normalizeNfc = (value: string) => value.replace(/^0+/, '') || '0';

export async function validateReturnNfc(collaboratorId: number, reading: unknown) {
  const code = text(reading, 'Leitura do crachá NFC');
  const person = await queryOne('SELECT id, nfc_id FROM colaboradores WHERE id = ?' + lockRow, [id(collaboratorId)]);
  if (!person?.nfc_id || normalizeNfc(code) !== normalizeNfc(person.nfc_id)) {
    throw new Error('Leia o crachá NFC vinculado ao colaborador desta devolução. Matrícula não substitui a leitura do crachá.');
  }
  return code;
}
