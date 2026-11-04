const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minex-active-inventory-')), 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { MaterialService } = require('../dist/services/MaterialService');
const { RelatorioService } = require('../dist/services/RelatorioService');
const { materialLabels } = require('../dist/services/MaterialLabels');
const { decodeLabelPdf } = require('./helpers/barcodePdf.cjs');
const { app } = require('../dist/server');
let server, base, token, category, retired;
before(async () => {
  await runMigrations();
  const actor = (await query('INSERT INTO usuarios (nome,matricula,senha_hash,nivel_acesso) VALUES (?,?,?,?)', ['Consulta','INVENTORY-TEST','unused','CONSULTA']))[0];
  token = jwt.sign({ id: actor.id }, process.env.JWT_SECRET);
  category = (await query('INSERT INTO categorias (nome) VALUES (?)', ['Inventário teste']))[0].id;
  for (const [code, status] of [['INV-001','DISPONIVEL'],['INV-002','EM_USO'],['INV-003','INATIVO']]) {
    const item = await MaterialService.criar({ nome: 'Equipamento', codigo_interno: code, categoria_id: category });
    await query('UPDATE materiais SET status=? WHERE id=?', [status,item.id]);
    if (status === 'INATIVO') retired = item;
  }
  server = await new Promise(resolve => { const instance = app.listen(0,'127.0.0.1',()=>resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve=>server.close(resolve)); await closeDatabase(); });

test('estoque e resumo contam ativos; consulta explícita preserva acesso aos inativos', async () => {
  const get = async suffix => {
    const response = await fetch(base + '/api/estoque' + suffix, { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status,200); return response.json();
  };
  const all = await get('');
  assert.equal(all.total,2);
  assert.deepEqual(all.items.map(item=>item.codigo_interno).sort(), ['INV-001','INV-002']);
  assert.deepEqual(all.contadores,{ DISPONIVEL:1, EM_USO:1 });
  assert.equal(all.categorias.find(item=>item.id===category).total,2);
  const inactive = await get('?status=INATIVO');
  assert.equal(inactive.total,1); assert.equal(inactive.items[0].codigo_interno,'INV-003');
  assert.equal((await get('?status=DISPONIVEL')).total,1);
  assert.equal((await RelatorioService.obterResumo()).totalMateriais,2);
  assert.equal((await query('SELECT * FROM materiais')).length,3);
});

test('etiquetas padrão incluem somente ativos; IDs explícitos permitem reimprimir inativos', async () => {
  const snapshot = await query('SELECT * FROM materiais ORDER BY id');
  const active = await decodeLabelPdf(await materialLabels({}), { dpi:203 });
  assert.deepEqual(active.items.map(item=>item.codigo).sort(), ['INV-001','INV-002']);
  const explicit = await decodeLabelPdf(await materialLabels({ ids:[retired.id] }), { dpi:203 });
  assert.deepEqual(explicit.items.map(item=>item.codigo), ['INV-003']);
  assert.deepEqual(await query('SELECT * FROM materiais ORDER BY id'),snapshot);
});
