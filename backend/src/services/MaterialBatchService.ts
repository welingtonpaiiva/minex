import { createHash } from 'crypto';
import { query, queryOne, withTransaction, lockRow } from '../config/db';
import { audit, id, text } from './OperationalService';
import { MaterialService } from './MaterialService';

export function batchConfiguration(data: any) {
  const nome = text(data.nome, 'Tipo de equipamento', 80);
  const prefixo = text(data.prefixo, 'Prefixo', 20);
  if (![data.inicio, data.fim, data.digitos].every(value => typeof value === 'number' ||
      (typeof value === 'string' && /^\d+$/.test(value)))) throw new Error('Informe números inteiros para o intervalo e a quantidade de dígitos.');
  const inicio = Number(data.inicio), fim = Number(data.fim), digitos = Number(data.digitos);
  if (!/^[A-Z][A-Z0-9-]*-$/.test(prefixo)) throw new Error('Use um prefixo como LM-, com letras maiúsculas, números e hífen final.');
  if (![inicio, fim, digitos].every(Number.isSafeInteger) || inicio < 1 || fim < inicio ||
      digitos < 1 || digitos > 8 || fim >= 10 ** digitos || fim - inicio + 1 > 1000) {
    throw new Error('Intervalo inválido. Use de 1 a 1000 itens e de 1 a 8 dígitos, suficientes para o número final.');
  }
  const patrimonio = text(data.patrimonio || 'MINA-UG', 'Patrimônio', 255);
  const categoria_id = data.categoria_id ? id(data.categoria_id) : null;
  return { nome, prefixo, inicio, fim, digitos, patrimonio, categoria_id };
}

export async function previewBatch(data: any) {
  const config = batchConfiguration(data);
  if (config.categoria_id && !await queryOne('SELECT id FROM categorias WHERE id = ?', [config.categoria_id])) {
    throw new Error('Categoria não encontrada');
  }
  const codes = Array.from({ length: config.fim - config.inicio + 1 }, (_, index) =>
    config.prefixo + String(config.inicio + index).padStart(config.digitos, '0'));
  const placeholders = codes.map(() => '?').join(',');
  const existing = await query(`SELECT id, codigo_interno, codigo_barras, status FROM materiais
    WHERE codigo_interno IN (${placeholders}) OR codigo_barras IN (${placeholders})`, [...codes, ...codes]);
  const occupied = new Map<string, any>();
  for (const item of existing) { occupied.set(item.codigo_interno, item); occupied.set(item.codigo_barras, item); }
  const items = codes.map(codigo => ({ codigo, codigo_barras: codigo, nome: config.nome, patrimonio: config.patrimonio,
    conflito: occupied.has(codigo), existente: occupied.get(codigo) || null }));
  const ignorados = items.filter(item => item.conflito).length;
  return { config, items, total: items.length, criar: items.length - ignorados, ignorados };
}

export async function createBatch(data: any, userId: number) {
  if (data.confirmar !== true) throw new Error('Visualize a prévia e confirme o cadastro em lote.');
  const preview = await previewBatch(data);
  const results: { codigo: string; resultado: string; erro?: string }[] = [];
  for (const item of preview.items) {
    try {
      const result = await withTransaction(async execute => {
        await execute('SELECT id FROM material_identification_lock WHERE id = 1' + lockRow);
        if (await queryOne('SELECT id FROM materiais WHERE codigo_interno = ? OR codigo_barras = ?', [item.codigo, item.codigo])) {
          return { codigo: item.codigo, resultado: 'IGNORADO' };
        }
        const created = await MaterialService.criar({ nome: preview.config.nome, codigo_interno: item.codigo,
          codigo_barras: item.codigo, categoria_id: preview.config.categoria_id || undefined, patrimonio: preview.config.patrimonio });
        await audit(userId, 'CADASTRO_LOTE_ITEM', 'material', created.id, { codigo: item.codigo, config: preview.config }, execute);
        return { codigo: item.codigo, resultado: 'CRIADO' };
      });
      results.push(result);
    } catch (error: any) {
      results.push({ codigo: item.codigo, resultado: 'ERRO', erro: error.message });
    }
  }
  const report = { criados: results.filter(r => r.resultado === 'CRIADO').length,
    ignorados: results.filter(r => r.resultado === 'IGNORADO').length,
    erros: results.filter(r => r.resultado === 'ERRO').length, items: results };
  await audit(userId, 'CADASTRO_LOTE', 'material', 0, { config: preview.config, ...report });
  return report;
}

// A prévia contém somente identificadores e patrimônio. Movimentações não invalidam
// a confirmação e jamais são alteradas por esta operação.
export async function previewPatrimony() {
  const items = await query(`SELECT id, codigo_interno, codigo_barras, patrimonio FROM materiais
    WHERE patrimonio IS NULL OR patrimonio <> 'MINA-UG' ORDER BY id`);
  const versao = createHash('sha256').update(JSON.stringify(items)).digest('hex');
  return { items, total: items.length, patrimonio: 'MINA-UG', versao };
}

export async function applyPatrimony(data: any, userId: number) {
  if (data.confirmar !== true) throw new Error('Confirme a alteração do patrimônio após revisar a prévia.');
  return withTransaction(async execute => {
    await execute('SELECT id FROM material_identification_lock WHERE id = 1' + lockRow);
    const preview = await previewPatrimony();
    if (data.versao !== preview.versao) throw new Error('Os cadastros foram alterados. Gere uma nova prévia antes de confirmar.');
    for (const item of preview.items) {
      await execute("UPDATE materiais SET patrimonio = 'MINA-UG', updated_at = ? WHERE id = ?", [new Date().toISOString(), item.id]);
      await audit(userId, 'PATRIMONIO_MINA_UG', 'material', item.id,
        { codigo: item.codigo_interno, anterior: item.patrimonio, novo: 'MINA-UG' }, execute);
    }
    return { atualizados: preview.total };
  });
}
