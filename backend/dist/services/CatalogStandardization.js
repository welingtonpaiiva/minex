"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardizedCatalog = standardizedCatalog;
exports.previewCatalogStandardization = previewCatalogStandardization;
exports.applyCatalogStandardization = applyCatalogStandardization;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const OperationalService_1 = require("./OperationalService");
const time_1 = require("../utils/time");
function standardizedCatalog(rows) {
    const targets = new Map();
    const items = rows.map(row => {
        const match = /^([A-Z][A-Z0-9]*-)(\d{1,3})$/.exec(row.codigo_interno);
        if (!match || Number(match[2]) < 1)
            throw new Error('TAG fora do padrão: ' + row.codigo_interno);
        const codigo = match[1] + String(Number(match[2])).padStart(3, '0');
        if (row.codigo_barras !== row.codigo_interno && row.codigo_barras !== codigo) {
            throw new Error('Código de barras personalizado precisa de revisão: ' + row.codigo_interno);
        }
        if (targets.has(codigo))
            throw new Error('Conflito ao padronizar: ' + codigo);
        targets.set(codigo, row.id);
        return { id: row.id, anterior: { codigo_interno: row.codigo_interno, codigo_barras: row.codigo_barras, patrimonio: row.patrimonio },
            novo: { codigo_interno: codigo, codigo_barras: codigo, patrimonio: 'MINA-UG' } };
    });
    for (const row of rows)
        for (const code of [row.codigo_interno, row.codigo_barras]) {
            if (targets.has(code) && targets.get(code) !== row.id)
                throw new Error('Código pertence a outro equipamento: ' + code);
        }
    const changed = items.filter(item => JSON.stringify(item.anterior) !== JSON.stringify(item.novo));
    const lanternas = items.filter(item => /^LM-\d{3}$/.test(item.novo.codigo_interno));
    const missing = Array.from({ length: 300 }, (_, index) => 'LM-' + String(index + 1).padStart(3, '0'))
        .filter(code => !targets.has(code));
    const versao = (0, crypto_1.createHash)('sha256').update(JSON.stringify(items)).digest('hex');
    return { total: items.length, alterados: changed.length, tags: items.filter(i => i.anterior.codigo_interno !== i.novo.codigo_interno).length,
        codigos_barras: items.filter(i => i.anterior.codigo_barras !== i.novo.codigo_barras).length,
        patrimonios: items.filter(i => i.anterior.patrimonio !== 'MINA-UG').length,
        lanternas: lanternas.length, lanternas_faltantes: missing, items: changed, versao };
}
async function previewCatalogStandardization() {
    return standardizedCatalog(await (0, db_1.query)('SELECT id,codigo_interno,codigo_barras,patrimonio FROM materiais ORDER BY id'));
}
async function applyCatalogStandardization(versao, userId) {
    return (0, db_1.withTransaction)(async (execute) => {
        await execute('SELECT id FROM material_identification_lock WHERE id = 1' + db_1.lockRow);
        const rows = await execute('SELECT * FROM materiais ORDER BY id' + db_1.lockRow);
        const preview = standardizedCatalog(rows);
        if (preview.versao !== versao)
            throw new Error('Os cadastros mudaram. Gere uma nova prévia.');
        for (const item of preview.items) {
            await execute('UPDATE materiais SET codigo_interno=?,codigo_barras=?,patrimonio=?,updated_at=? WHERE id=?', [item.novo.codigo_interno, item.novo.codigo_barras, 'MINA-UG', (0, time_1.now)(), item.id]);
            await (0, OperationalService_1.audit)(userId, 'PADRONIZAR_CATALOGO', 'material', item.id, { ...item, origem: 'Manutenção local autorizada pelo usuário; três dígitos e patrimônio MINA-UG' }, execute);
        }
        const after = await execute('SELECT * FROM materiais ORDER BY id');
        const operational = (data) => {
            const { codigo_interno, codigo_barras, patrimonio, updated_at, ...rest } = data;
            return rest;
        };
        if (JSON.stringify(rows.map(operational)) !== JSON.stringify(after.map(operational))) {
            throw new Error('A validação detectou mudança em dados operacionais; operação cancelada.');
        }
        if (standardizedCatalog(after).alterados)
            throw new Error('A padronização não foi concluída; operação cancelada.');
        return { total: preview.total, atualizados: preview.alterados, tags: preview.tags, codigos_barras: preview.codigos_barras, patrimonios: preview.patrimonios };
    });
}
