import { databaseClient } from '../config/db';

// Compare the numeric part of a TAG before applying pagination (LM-99 < LM-100).
const separator = "INSTR(m.codigo_interno, '-')";
const prefix = `CASE WHEN ${separator} > 0 THEN SUBSTR(m.codigo_interno, 1, ${separator} - 1) ELSE m.codigo_interno END`;
const number = `CAST(SUBSTR(m.codigo_interno, ${separator} + 1) AS ${databaseClient === 'mysql' ? 'UNSIGNED' : 'INTEGER'})`;

export const materialCodeOrder = `${prefix} ASC, ${number} ASC, m.codigo_interno ASC, m.id ASC`;

export const materialCategoryOrder = `CASE WHEN m.categoria_id IS NULL THEN 1 ELSE 0 END ASC, c.nome ASC, m.categoria_id ASC, ${materialCodeOrder}`;
