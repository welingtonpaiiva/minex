const { test, before, after } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
process.env.DB_CLIENT = 'sqlite'; process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minex-material-photos-')), 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex'); delete process.env.MYSQL_HOST; delete process.env.INITIAL_ADMIN_PASSWORD;
const jwt = require('jsonwebtoken'), sharp = require('sharp');
const { query, queryOne, closeDatabase } = require('../dist/config/db');
const { runMigrations, mysqlDDL } = require('../dist/database/migrate');
const { MaterialService } = require('../dist/services/MaterialService');
const { EmprestimoService } = require('../dist/services/EmprestimoService');
const { pendingReturns } = require('../dist/services/ReturnService');
const { codeReturnPreview } = require('../dist/services/CodeReturnService');
const { app } = require('../dist/server');
let server, base, material, other, person, image;
const actors = {};
before(async () => {
  await runMigrations();
  for (const role of ['ADMINISTRADOR', 'OPERADOR', 'CONSULTA']) {
    const id = (await query('INSERT INTO usuarios (nome,matricula,nivel_acesso,senha_hash) VALUES (?,?,?,?)', [role, role, role, 'unused']))[0].id;
    actors[role] = { id, token: jwt.sign({ id }, process.env.JWT_SECRET) };
  }
  material = await MaterialService.criar({ nome: 'Equipamento fotografado', codigo_interno: 'PHOTO-001' });
  other = await MaterialService.criar({ nome: 'Mesmo modelo', codigo_interno: 'PHOTO-002' });
  person = (await query("INSERT INTO colaboradores (nome,matricula,nfc_id) VALUES ('Ana Foto','FOTO-ANA','NFC-FOTO')"))[0].id;
  await EmprestimoService.realizarSaida({ colaboradorId: person, operadorId: actors.OPERADOR.id, materiaisCodigos: [material.codigo_interno], requestId: crypto.randomUUID() });
  image = 'data:image/png;base64,' + (await sharp({ create: { width: 90, height: 120, channels: 4, background: '#148a6866' } }).png().toBuffer()).toString('base64');
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });
async function request(route, role = 'ADMINISTRADOR', body, method = 'POST') {
  return fetch(base + '/api' + route, { method, headers: { ...(role ? { Authorization: 'Bearer ' + actors[role].token } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test('anexa foto persistente e compartilhável sem alterar disponibilidade, empréstimo ou NFC', async () => {
  const response = await request('/materiais/' + material.id + '/foto', 'ADMINISTRADOR', { imagem: image });
  assert.equal(response.status, 200); const { foto_url } = await response.json(); assert.match(foto_url, /^\/api\/materiais\/fotos\/[a-f0-9-]+\.webp$/);
  assert.equal((await MaterialService.buscarPorId(material.id)).status, 'EM_USO');
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM emprestimos WHERE material_id=?', [material.id])).n, 1);
  assert.equal((await queryOne('SELECT nfc_id FROM colaboradores WHERE id=?', [person])).nfc_id, 'NFC-FOTO');
  assert.equal((await EmprestimoService.buscarEmprestimosDoColaborador(person))[0].foto_url, foto_url);
  assert.equal((await pendingReturns({ colaboradorId: person })).items[0].materiais[0].foto_url, foto_url);
  assert.equal((await codeReturnPreview(material.codigo_interno)).material.foto_url, foto_url);
  const shared = await request('/materiais/' + other.id + '/foto', 'ADMINISTRADOR', { imagem: image });
  assert.equal((await shared.json()).foto_url, foto_url); assert.equal((await queryOne('SELECT COUNT(*) AS n FROM material_fotos')).n, 1);
  const photo = await request(foto_url.replace('/api', ''), 'CONSULTA', undefined, 'GET'); assert.equal(photo.status, 200);
  const metadata = await sharp(Buffer.from(await photo.arrayBuffer())).metadata(); assert.equal(metadata.format, 'webp'); assert.equal(metadata.hasAlpha, true);
  assert.equal((await request(foto_url.replace('/api', ''), null, undefined, 'GET')).status, 401);
  const empty = await request('/materiais/' + material.id, 'ADMINISTRADOR', { foto_url: '' }, 'PUT'); assert.equal(empty.status, 200); assert.equal((await empty.json()).foto_url, '');
});
test('valida anexos e permissões e não aceita referências externas ou imagens inválidas', async () => {
  for (const role of ['OPERADOR', 'CONSULTA']) assert.equal((await request('/materiais/' + material.id + '/foto', role, { imagem: image })).status, 403);
  for (const invalid of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAAA', 'https://example.com/photo.png']) assert.equal((await request('/materiais/' + material.id + '/foto', 'ADMINISTRADOR', { imagem: invalid })).status, 400);
  await assert.rejects(MaterialService.editar(material.id, { foto_url: 'https://example.com/image.png' }), /catálogo|foto/);
  await assert.rejects(MaterialService.editar(material.id, { foto_url: '/api/materiais/fotos/' + crypto.randomUUID() + '.webp' }), /foto/);
  assert.equal((await request('/materiais/fotos/not-a-file', 'CONSULTA', undefined, 'GET')).status, 404);
});
test('catálogo serve as fotos fornecidas e MySQL armazena conteúdo sem truncar', async () => {
  const response = await request('/materiais/fotos/catalogo', 'CONSULTA', undefined, 'GET'); assert.equal(response.status, 200);
  const catalog = await response.json(); assert.ok(catalog.some(item => item.codigo === 'MG'));
  const created = await MaterialService.criar({ nome: 'Medidor de Gás', codigo_interno: 'MG-010' }); assert.equal(created.foto_url, catalog.find(item => item.codigo === 'MG').foto_url);
  assert.match(mysqlDDL('CREATE TABLE material_fotos (imagem_base64 TEXT NOT NULL)'), /imagem_base64 MEDIUMTEXT/);
});
