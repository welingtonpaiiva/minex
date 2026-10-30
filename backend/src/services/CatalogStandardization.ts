import { createHash } from 'crypto';
import { query, withTransaction, lockRow } from '../config/db';
import { audit } from './OperationalService';
import { now } from '../utils/time';

export function standardizedCatalog(rows: any[]) {
  const targets = new Map<string, number>();
  const items = rows.map(row => {
    const match = /^([A-Z][A-Z0-9]*-)(\d{1,3})$/.exec(row.codigo_interno);
    if (!match || Number(match[2]) < 1) throw new Error('TAG fora do padrão: ' + row.codigo_interno);
    const codigo = match[1] + String(Number(match[2])).padStart(3, '0');
    if (row.codigo_barras !== row.codigo_interno && row.codigo_barras !== codigo) {
      throw new Error('Código de barras personalizado precisa de revisão: ' + row.codigo_interno);
    }
    if (targets.has(codigo)) throw new Error('Conflito ao padronizar: ' + codigo);
    targets.set(codigo, row.id);
    return { id: row.id, anterior: { codigo_interno: row.codigo_interno, codigo_barras: row.codigo_barras, patrimonio: row.patrimonio },
      novo: { codigo_interno: codigo, codigo_barras: codigo, patrimonio: 'MINA-UG' } };
  });
  for (const row of rows) for (const code of [row.codigo_interno, row.codigo_barras]) {
    if (targets.has(code) && targets.get(code) !== row.id) throw new Error('Código pertence a outro equipamento: ' + code);
  }
  const changed = items.filter(item => JSON.stringify(item.anterior) !== JSON.stringify(item.novo));
  const lanternas = items.filter(item => /^LM-\d{3}$/.test(item.novo.codigo_interno));
  const missing = Array.from({ length: 300 }, (_, index) => 'LM-' + String(index + 1).padStart(3, '0'))
    .filter(code => !targets.has(code));
  const versao = createHash('sha256').update(JSON.stringify(items)).digest('hex');
  return { total: items.length, alterados: changed.length, tags: items.filter(i => i.anterior.codigo_interno !== i.novo.codigo_interno).length,
    codigos_barras: items.filter(i => i.anterior.codigo_barras !== i.novo.codigo_barras).length,
    patrimonios: items.filter(i => i.anterior.patrimonio !== 'MINA-UG').length,
    lanternas: lanternas.length, lanternas_faltantes: missing, items: changed, versao };
}

export async function previewCatalogStandardization() {
  return standardizedCatalog(await query('SELECT id,codigo_interno,codigo_barras,patrimonio FROM materiais ORDER BY id'));
}

export async function applyCatalogStandardization(versao: string, userId: number) {
  return withTransaction(async execute => {
    await execute('SELECT id FROM material_identification_lock WHERE id = 1' + lockRow);
    const rows = await execute('SELECT * FROM materiais ORDER BY id' + lockRow);
    const preview = standardizedCatalog(rows);
    if (preview.versao !== versao) throw new Error('Os cadastros mudaram. Gere uma nova prévia.');
    for (const item of preview.items) {
      await execute('UPDATE materiais SET codigo_interno=?,codigo_barras=?,patrimonio=?,updated_at=? WHERE id=?',
        [item.novo.codigo_interno, item.novo.codigo_barras, 'MINA-UG', now(), item.id]);
      await audit(userId, 'PADRONIZAR_CATALOGO', 'material', item.id,
        { ...item, origem: 'Manutenção local autorizada pelo usuário; três dígitos e patrimônio MINA-UG' }, execute);
    }
    const after = await execute('SELECT * FROM materiais ORDER BY id');
    const operational = (data: any) => {
      const { codigo_interno, codigo_barras, patrimonio, updated_at, ...rest } = data;
      return rest;
    };
    if (JSON.stringify(rows.map(operational)) !== JSON.stringify(after.map(operational))) {
      throw new Error('A validação detectou mudança em dados operacionais; operação cancelada.');
    }
    if (standardizedCatalog(after).alterados) throw new Error('A padronização não foi concluída; operação cancelada.');
    return { total: preview.total, atualizados: preview.alterados, tags: preview.tags, codigos_barras: preview.codigos_barras, patrimonios: preview.patrimonios };
  });
}
