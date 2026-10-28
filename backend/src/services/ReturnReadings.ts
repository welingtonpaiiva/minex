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

export async function validateReturnBarcode(materialId: number, reading: unknown) {
  const code = text(reading, 'Leitura do código de barras');
  const material = await queryOne('SELECT codigo_barras FROM materiais WHERE id = ?' + lockRow, [id(materialId)]);
  if (!material?.codigo_barras || material.codigo_barras !== code) throw new Error('Leia o código de barras do material que está sendo devolvido.');
  return code;
}

export async function validateReturnBarcodes(readings: unknown) {
  if (!Array.isArray(readings) || !readings.length || readings.length > 100) throw new Error('Leia os códigos de barras dos materiais recebidos.');
  for (const reading of readings) {
    const code = text(reading, 'Leitura do código de barras');
    if (!await queryOne('SELECT id FROM materiais WHERE codigo_barras = ?' + lockRow, [code])) {
      throw new Error('Código de barras não cadastrado. O código interno não substitui a leitura da etiqueta.');
    }
  }
}
