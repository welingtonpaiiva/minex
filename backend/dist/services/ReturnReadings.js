"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReturnNfc = validateReturnNfc;
exports.validateReturnBarcode = validateReturnBarcode;
exports.validateReturnBarcodes = validateReturnBarcodes;
const db_1 = require("../config/db");
const OperationalService_1 = require("./OperationalService");
const normalizeNfc = (value) => value.replace(/^0+/, '') || '0';
async function validateReturnNfc(collaboratorId, reading) {
    const code = (0, OperationalService_1.text)(reading, 'Leitura do crachá NFC');
    const person = await (0, db_1.queryOne)('SELECT id, nfc_id FROM colaboradores WHERE id = ?' + db_1.lockRow, [(0, OperationalService_1.id)(collaboratorId)]);
    if (!person?.nfc_id || normalizeNfc(code) !== normalizeNfc(person.nfc_id)) {
        throw new Error('Leia o crachá NFC vinculado ao colaborador desta devolução. Matrícula não substitui a leitura do crachá.');
    }
    return code;
}
async function validateReturnBarcode(materialId, reading) {
    const code = (0, OperationalService_1.text)(reading, 'Leitura do código de barras');
    const material = await (0, db_1.queryOne)('SELECT codigo_barras FROM materiais WHERE id = ?' + db_1.lockRow, [(0, OperationalService_1.id)(materialId)]);
    if (!material?.codigo_barras || material.codigo_barras !== code)
        throw new Error('Leia o código de barras do material que está sendo devolvido.');
    return code;
}
async function validateReturnBarcodes(readings) {
    if (!Array.isArray(readings) || !readings.length || readings.length > 100)
        throw new Error('Leia os códigos de barras dos materiais recebidos.');
    for (const reading of readings) {
        const code = (0, OperationalService_1.text)(reading, 'Leitura do código de barras');
        if (!await (0, db_1.queryOne)('SELECT id FROM materiais WHERE codigo_barras = ?' + db_1.lockRow, [code])) {
            throw new Error('Código de barras não cadastrado. O código interno não substitui a leitura da etiqueta.');
        }
    }
}
