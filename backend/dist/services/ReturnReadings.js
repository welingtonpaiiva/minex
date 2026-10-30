"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReturnNfc = validateReturnNfc;
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
