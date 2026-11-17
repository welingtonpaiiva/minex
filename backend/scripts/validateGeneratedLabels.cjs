// Revalida os PDFs existentes, inclusive os contidos nos ZIPs, sem alterar o cadastro.
// Uso: node backend/scripts/validateGeneratedLabels.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const JSZip = require('jszip');
const { decodeLabelPdf } = require('../tests/helpers/barcodePdf.cjs');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'test-results/validacao-pdfs');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = directory => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const filename = path.join(directory, entry.name);
  return entry.isDirectory() ? files(filename) : [filename];
}) : [];

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const snapshot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minex-label-validation-')), 'snapshot.db');
  const source = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path.join(root, 'minex.db'), sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(db));
  });
  try {
    await new Promise((resolve, reject) => {
      const backup = source.backup(snapshot, error => {
        if (error) return reject(error);
        backup.step(-1, stepError => backup.finish(finishError => stepError || finishError ? reject(stepError || finishError) : resolve()));
      });
    });
  } finally { await new Promise((resolve, reject) => source.close(error => error ? reject(error) : resolve())); }
  process.env.DB_CLIENT = 'sqlite';
  process.env.SQLITE_PATH = snapshot;
  const { query, closeDatabase } = require('../dist/config/db');
  const { MaterialService } = require('../dist/services/MaterialService');
  const { codeReturnPreview } = require('../dist/services/CodeReturnService');
  try {
    const rows = await query('SELECT * FROM materiais ORDER BY codigo_interno');
    const individual = rows.filter(row => row.tipo_controle === 'INDIVIDUAL');
    const active = individual.filter(row => row.status !== 'INATIVO');
    const byTag = new Map(rows.map(row => [row.codigo_interno, row]));
    const report = { verificado_em: new Date().toISOString(), banco: 'Snapshot consistente do minex.db local; origem aberta somente para leitura',
      ativos: active.length, mascaras_ativas: active.filter(row => row.codigo_interno.startsWith('MF-')).length,
      arquivos: [], falhas: [], avisos: [], codigos_consultados: 0 };
    const unique = new Map();
    const register = (name, bytes) => {
      const sha256 = digest(bytes);
      if (!unique.has(sha256)) unique.set(sha256, { bytes, sha256, copias: [] });
      unique.get(sha256).copias.push(name);
    };
    const candidates = ['exports', 'backups', 'frontend/public/downloads', 'frontend/dist/downloads'].flatMap(directory => files(path.join(root, directory)));
    for (const file of candidates) {
      if (/\.pdf$/i.test(file) && !/teste-leitura/i.test(file)) register(relative(file), fs.readFileSync(file));
      if (/\.zip$/i.test(file)) {
        const zip = await JSZip.loadAsync(fs.readFileSync(file), { checkCRC32: true });
        for (const entry of Object.values(zip.files)) if (!entry.dir && /\.pdf$/i.test(entry.name) && !/teste-leitura/i.test(entry.name)) {
          register(relative(file) + '::' + entry.name, await entry.async('nodebuffer'));
        }
      }
    }
    assert.ok(unique.size, 'Nenhum PDF de etiquetas encontrado');
    const consulted = new Set();
    for (const artifact of unique.values()) {
      const result = { copias: artifact.copias, sha256: artifact.sha256, leituras: [], inativos: [], falhas: [] };
      report.arquivos.push(result);
      for (const dpi of [203, 300]) {
        try {
          const decoded = await decodeLabelPdf(artifact.bytes, { dpi });
          assert.ok(decoded.items.length, 'PDF sem etiquetas TAG reconhecidas');
          const tags = decoded.items.map(item => item.tag);
          assert.equal(new Set(tags).size, tags.length, 'TAG duplicada no mesmo PDF');
          for (const item of decoded.items) {
            const material = byTag.get(item.tag);
            assert.ok(material, 'TAG ausente do cadastro: ' + item.tag);
            assert.equal(item.codigo, material.codigo_barras, 'Barras diferentes do cadastro: ' + item.tag);
            const matches = rows.filter(row => row.codigo_interno === item.codigo || row.codigo_barras === item.codigo);
            assert.equal(matches.length, 1, 'Identificação ambígua: ' + item.codigo);
            assert.equal(matches[0].id, material.id);
            if (!consulted.has(item.codigo)) {
              assert.equal((await MaterialService.buscarPorCodigo(item.codigo)).id, material.id);
              assert.equal((await codeReturnPreview(item.codigo)).material.id, material.id);
              consulted.add(item.codigo);
            }
          }
          // Os arquivos do lote atual precisam cobrir todo o conjunto anunciado.
          if (artifact.copias.some(name => name.includes('compacto-' + active.length + '-4x10/') || name.includes('etiquetas-' + active.length + '-A4-4x10'))) {
            const name = artifact.copias[0].split('::').pop().split('/').pop();
            const prefix = { '01': 'LM-', '02': 'BR-', '03': 'RP-', '04': 'ML-', '05': 'MG-', '06': 'TL-', '07': 'MF-' }[name.slice(0, 2)];
            const expected = prefix ? active.filter(row => row.codigo_interno.startsWith(prefix)) : active;
            assert.deepEqual([...tags].sort(), expected.map(row => row.codigo_interno).sort(), 'Cobertura incompleta do lote atual');
          }
          result.paginas = decoded.paginas;
          result.etiquetas = decoded.items.length;
          result.inativos = tags.filter(tag => byTag.get(tag).status === 'INATIVO');
          result.leituras.push({ dpi, decodificados: decoded.items.length, resultado: 'OK' });
        } catch (error) {
          result.falhas.push({ dpi, erro: error.message });
          report.falhas.push({ arquivo: artifact.copias[0], dpi, erro: error.message });
        }
      }
      console.log(JSON.stringify({ arquivo: artifact.copias[0], etiquetas: result.etiquetas, leituras: result.leituras, inativos: result.inativos.length, falhas: result.falhas }));
    }
    report.codigos_consultados = consulted.size;
    assert.deepEqual(await query('SELECT * FROM materiais ORDER BY codigo_interno'), rows, 'A validação alterou o snapshot');
    const current = report.arquivos.filter(item => item.copias.some(name => name.startsWith('exports/') && name.includes('compacto-' + active.length + '-4x10/')));
    report.lote_atual = { pdfs: current.length, resultado: current.length === 8 && current.every(item => !item.falhas.length && !item.inativos.length) ? 'OK' : 'FALHA' };
    if (report.arquivos.some(item => item.inativos.length)) report.avisos.push('PDFs antigos contêm itens atualmente INATIVOS. Use o lote atual de ' + active.length + ' itens para imprimir.');
    const missing = path.join(root, 'frontend/public/downloads/07-mascaras-de-fuga-A4-4x10.pdf');
    if (!fs.existsSync(missing)) report.avisos.push('A cópia pública do PDF de máscaras foi removida. O original permanece no diretório exports do lote atual.');
    fs.writeFileSync(path.join(output, 'relatorio.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ lote_atual: report.lote_atual, arquivos_unicos: unique.size, codigos_consultados: consulted.size, falhas: report.falhas.length, avisos: report.avisos }));
    if (report.falhas.length || report.lote_atual.resultado !== 'OK') process.exitCode = 1;
  } finally { await closeDatabase(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
