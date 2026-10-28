const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const backend = path.resolve(__dirname, '../../backend');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-monitor-tv-'));
process.env.DB_CLIENT = 'sqlite'; process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex'); process.env.APP_TIMEZONE = 'America/Sao_Paulo';
delete process.env.MYSQL_HOST; delete process.env.INITIAL_ADMIN_PASSWORD;
const jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
const { query, queryOne, closeDatabase } = require(path.join(backend, 'dist/config/db'));
const { runMigrations } = require(path.join(backend, 'dist/database/migrate'));
const { ColaboradorService } = require(path.join(backend, 'dist/services/ColaboradorService'));
const { app } = require(path.join(backend, 'dist/server'));
let server, browser;
const artifacts = path.resolve(__dirname, '../../test-results');

(async () => {
  await runMigrations();
  const user = { nome: 'Monitor de teste', matricula: 'MONITOR-TV', nivel_acesso: 'CONSULTA' };
  user.id = (await query('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso) VALUES (?, ?, ?, ?)',
    [user.nome, user.matricula, 'unused', user.nivel_acesso]))[0].id;
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET), people = [];
  const names = ['Rodrigo Alves da Silva', 'Lucas Mendes Santos', 'Fernando Henrique Costa', 'João Pedro de Souza', 'Gabriel Oliveira Rocha', 'Carlos de Souza', 'Guilherme Martins Farias', 'Marcelo Antonio Silva', 'Thiago Barbosa Dias', 'Rafael Lima Cardoso', 'Paulo Henrique Nogueira', 'André Luiz Monteiro', 'Fabiano Alves', 'Marcos Vinicius Castro', 'Felipe Augusto Duarte', 'Leonardo Gomes Almeida', 'Vitor Hugo Carvalho', 'Samuel Borges Ribeiro', 'Daniel Moreira Freitas', 'Renato Cavalcante Lopes', 'Larissa Oliveira', 'Leandro Machado Vieira', 'Alexandre Correa Pinto', 'Gustavo Menezes Reis', 'Pessoa com Nome Completo Muito Longo para Validar a Apresentação'];
  for (let i = 0; i < names.length; i++) {
    const brigade = [5, 12, 20].includes(i);
    const person = await ColaboradorService.criar({ nome: names[i], matricula: 'TV-' + (99300100 + i), empresa: i % 2 ? 'Empresa de teste B' : 'Empresa de teste A', turma: ['A', 'B', 'C', 'D'][i % 4],
      cargo: ['Operador de equipamentos', 'Técnico de manutenção', 'Operador de subterrâneo'][i % 3], brigadista: brigade,
      brigada_especialidade: brigade ? ['Resgate e emergência', 'Primeiros socorros', 'Combate a incêndio'][[5, 12, 20].indexOf(i)] : '', brigada_validade: brigade ? (i === 5 ? '2000-01-01' : '2099-12-31') : null });
    people.push(person);
    const hours = i < 4 ? 7 + i / 3 : 1 + (25 - i) / 10;
    await query('INSERT INTO acessos_mina (colaborador_id, entrada, operador_entrada_id, ativo_colaborador_id) VALUES (?, ?, ?, ?)',
      [person.id, new Date(Date.now() - hours * 3600000).toISOString(), user.id, person.id]);
  }
  for (let i = 0; i < 2; i++) await ColaboradorService.criar({ nome: 'Brigadista ausente do teste ' + i, matricula: 'TV-FORA-' + i, brigadista: true });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'Asia/Tokyo' });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('casa_da_lanterna_token', token); localStorage.setItem('casa_da_lanterna_user', JSON.stringify(user));
  }, { token, user });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  await page.goto(base + '/dashboard');
  await expect(page.locator('.mine-monitor')).toHaveAttribute('data-monitor-state', 'live');
  await expect(page.getByRole('article', { name: 'COLABORADORES NA MINA', exact: true }).locator('strong')).toHaveText('25');
  await expect(page.getByRole('article', { name: 'ACIMA DO LIMITE', exact: true }).locator('strong')).toHaveText('4');
  await expect(page.getByRole('article', { name: 'BRIGADISTAS NA MINA', exact: true }).locator('strong')).toHaveText('3');
  await expect(page.locator('button, input, select, textarea, a, [role=button]')).toHaveCount(0);
  await expect(page.locator('.operator-topbar, .mine-alert, .navigation-panel')).toHaveCount(0);
  await expect(page.locator('.mine-access-card.is-critical')).toHaveCount(4);
  await expect(page.locator('.mine-brigadist .is-expired')).toHaveText('HABILITAÇÃO VENCIDA');
  const operationalClock = await page.getByLabel('Relógio operacional', { exact: true }).textContent();
  const reference = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date());
  assert.equal(operationalClock.slice(0, 5), reference.slice(0, 5));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight);
  assert.equal(overflow, false);
  const cardClip = await page.locator('.mine-access-card').evaluateAll(cards => cards.some(card => card.scrollHeight > card.clientHeight + 2));
  assert.equal(cardClip, false, 'Os cards devem caber sem cortar informações');
  fs.mkdirSync(artifacts, { recursive: true }); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, 'mine-monitoring-full-hd.png') });
  const fixed = await page.locator('.mine-access-card.is-critical').first().elementHandle();
  const regularBefore = await page.locator('.mine-access-card.is-normal').evaluateAll(cards => cards.map(card => card.dataset.personId));
  const countBefore = requests.filter(request => request.url.includes('/api/operacao/monitoramento')).length;
  await page.waitForTimeout(2200);
  assert.equal(requests.filter(request => request.url.includes('/api/operacao/monitoramento')).length, countBefore, 'O relógio não consulta o banco por segundo');
  await page.waitForTimeout(10300);
  assert.equal(await fixed.evaluate(node => node.isConnected), true, 'Cards críticos devem permanecer montados durante a rotação');
  const regularAfter = await page.locator('.mine-access-card.is-normal').evaluateAll(cards => cards.map(card => card.dataset.personId));
  assert.notDeepEqual(regularAfter, regularBefore);
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'mine-monitoring-4k.png') });
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'mine-monitoring-tablet.png') });
  await page.setViewportSize({ width: 1920, height: 1080 });
  const originalEntries = await query('SELECT id, entrada FROM acessos_mina ORDER BY id');
  await query('UPDATE acessos_mina SET entrada=? WHERE saida IS NULL', [new Date(Date.now() - 7 * 3600000).toISOString()]);
  await page.evaluate(() => window.dispatchEvent(new Event('operacao-atualizada')));
  await expect(page.locator('.mine-access-card.is-critical')).toHaveCount(25);
  await expect(page.locator('.mine-monitor-footer')).toContainText('CAPACIDADE VISUAL EXCEDIDA');
  await expect(page.locator('.mine-grid-region')).toHaveClass(/is-overflow/);
  await page.waitForTimeout(12500);
  assert.equal(await page.locator('.mine-grid-region').evaluate(node => node.scrollTop > 0), true, 'A lista prioritária saturada deve percorrer a tela automaticamente');
  await expect(page.locator('.mine-access-card.is-critical')).toHaveCount(25);
  for (const entry of originalEntries) await query('UPDATE acessos_mina SET entrada=? WHERE id=?', [entry.entrada, entry.id]);
  await query('UPDATE acessos_mina SET saida=?, ativo_colaborador_id=NULL WHERE colaborador_id=?', [new Date().toISOString(), people[0].id]);
  await page.evaluate(() => window.dispatchEvent(new Event('operacao-atualizada')));
  await expect(page.getByRole('article', { name: 'COLABORADORES NA MINA', exact: true }).locator('strong')).toHaveText('24');
  await expect(page.locator('.mine-access-card.is-critical')).toHaveCount(3);
  await page.route('**/api/operacao/monitoramento', route => route.abort('connectionfailed'));
  await page.evaluate(() => window.dispatchEvent(new Event('operacao-atualizada')));
  await expect(page.locator('.mine-monitor')).toHaveAttribute('data-monitor-state', 'stale');
  await expect(page.locator('.mine-alert-band')).toContainText('DADOS PODEM ESTAR DESATUALIZADOS');
  await page.screenshot({ path: path.join(artifacts, 'mine-monitoring-offline.png') });
  await page.unroute('**/api/operacao/monitoramento');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('.mine-monitor')).toHaveAttribute('data-monitor-state', 'live');
  const admin = { nome: 'Cadastro do teste', matricula: 'MONITOR-ADMIN', nivel_acesso: 'ADMINISTRADOR' };
  admin.id = (await query('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso) VALUES (?, ?, ?, ?)',
    [admin.nome, admin.matricula, 'unused', admin.nivel_acesso]))[0].id;
  const adminToken = jwt.sign({ id: admin.id }, process.env.JWT_SECRET);
  const sharp = require(path.join(backend, 'node_modules/sharp'));
  // Fotografias de teste distinguíveis, com nomes iguais, validam o vínculo pelo identificador.
  for (const [index, color] of [[1, '#e02020'], [2, '#2040e0']]) {
    await ColaboradorService.editar(people[index].id, { nome: 'Nome idêntico no teste de fotografia' });
    const bytes = await sharp({ create: { width: 90, height: 120, channels: 3, background: color } }).jpeg().toBuffer();
    const response = await fetch(base + '/api/fotos/' + people[index].id, { method: 'POST', headers: {
      Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ imagem: 'data:image/jpeg;base64,' + bytes.toString('base64') }) });
    assert.equal(response.status, 200);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('operacao-atualizada')));
  for (const index of [1, 2]) {
    const image = page.locator(`[data-person-id="${people[index].id}"] .mine-portrait img`);
    await expect(image).toHaveAttribute('src', /^blob:/, { timeout: 15000 });
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    const pixel = await image.evaluate(node => { const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext('2d'); context.drawImage(node, 0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data); });
    assert.equal(index === 1 ? pixel[0] > pixel[2] : pixel[2] > pixel[0], true);
  }
  assert.deepEqual(requests.filter(request => request.method !== 'GET'), [], 'O painel não pode gravar dados');
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await adminContext.addInitScript(({ token, user }) => { localStorage.setItem('casa_da_lanterna_token', token);
    localStorage.setItem('casa_da_lanterna_user', JSON.stringify(user)); }, { token: adminToken, user: admin });
  const adminPage = await adminContext.newPage(); adminPage.on('pageerror', error => errors.push(error.message));
  await adminPage.goto(base + '/cadastro');
  await adminPage.getByRole('button', { name: 'Novo colaborador', exact: true }).click();
  const form = adminPage.getByRole('dialog', { name: 'Cadastrar colaborador', exact: true });
  await form.getByLabel('Nome completo', { exact: true }).fill('Brigadista cadastrado pela interface');
  await form.getByLabel('Matrícula', { exact: true }).fill('UI-BRIGADA');
  await form.getByLabel('Empresa', { exact: true }).fill('Empresa validada no cadastro');
  await form.getByLabel('Turma', { exact: true }).fill('D');
  await form.getByRole('checkbox', { name: 'Integrante da brigada de emergência', exact: true }).check();
  await form.getByLabel('Especialidade na brigada', { exact: true }).fill('Resgate e emergência');
  await form.getByLabel('Validade da habilitação', { exact: true }).fill('2099-12-31');
  await form.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
  await expect(form).toHaveCount(0);
  const saved = await queryOne("SELECT * FROM colaboradores WHERE matricula = 'UI-BRIGADA'");
  assert.equal(saved.brigadista, 1); assert.equal(saved.empresa, 'Empresa validada no cadastro'); assert.equal(saved.turma, 'D');
  assert.equal(saved.brigada_validade, '2099-12-31');
  await adminContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS: painel passivo, dados reais de acesso, brigada, limite, rotação, fuso operacional, Full HD, 4K, tablet e reconexão.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase();
});
