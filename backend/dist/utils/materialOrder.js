"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.materialCategoryOrder = exports.materialCodeOrder = void 0;
const db_1 = require("../config/db");
// Compare the numeric part of a TAG before applying pagination (LM-99 < LM-100).
const separator = "INSTR(m.codigo_interno, '-')";
const prefix = `CASE WHEN ${separator} > 0 THEN SUBSTR(m.codigo_interno, 1, ${separator} - 1) ELSE m.codigo_interno END`;
const number = `CAST(SUBSTR(m.codigo_interno, ${separator} + 1) AS ${db_1.databaseClient === 'mysql' ? 'UNSIGNED' : 'INTEGER'})`;
exports.materialCodeOrder = `${prefix} ASC, ${number} ASC, m.codigo_interno ASC, m.id ASC`;
exports.materialCategoryOrder = `CASE WHEN m.categoria_id IS NULL THEN 1 ELSE 0 END ASC, c.nome ASC, m.categoria_id ASC, ${exports.materialCodeOrder}`;
