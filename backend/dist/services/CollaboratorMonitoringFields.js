"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringFields = monitoringFields;
const OperationalService_1 = require("./OperationalService");
function monitoringFields(data, previous = {}) {
    const brigade = data.brigadista ?? previous.brigadista ?? 0;
    if (![true, false, 0, 1].includes(brigade))
        throw new Error('Identificação de brigadista inválida');
    const validity = data.brigada_validade === undefined ? previous.brigada_validade : data.brigada_validade;
    if (validity && (!/^\d{4}-\d{2}-\d{2}$/.test(validity) || Number.isNaN(Date.parse(validity + 'T00:00:00Z')) || new Date(validity + 'T00:00:00Z').toISOString().slice(0, 10) !== validity)) {
        throw new Error('Validade da habilitação da brigada inválida');
    }
    return {
        empresa: (0, OperationalService_1.text)(data.empresa ?? previous.empresa ?? '', 'Empresa', 255, false),
        turma: (0, OperationalService_1.text)(data.turma ?? previous.turma ?? '', 'Turma', 32, false),
        brigadista: brigade ? 1 : 0,
        brigada_especialidade: (0, OperationalService_1.text)(data.brigada_especialidade ?? previous.brigada_especialidade ?? '', 'Especialidade na brigada', 255, false),
        brigada_validade: validity || null
    };
}
