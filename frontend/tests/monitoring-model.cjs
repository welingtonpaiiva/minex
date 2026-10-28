const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../src/components/monitoringModel.ts'), 'utf8');
const moduleValue = { exports: {} };
new Function('exports', 'module', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(moduleValue.exports, moduleValue);
const { timedPerson, orderPeople, monitorPage, elapsedLabel } = moduleValue.exports;
const now = Date.parse('2026-10-28T15:00:00Z');
const person = (id, seconds) => ({ acesso_id: id, colaborador_id: id, entrada: new Date(now - seconds * 1000).toISOString(), horario_inconsistente: false });
test('seis horas exatas são normais; somente 06h00m01s se torna crítico', () => {
  assert.equal(timedPerson(person(1, 21600), now).critical, false);
  assert.equal(timedPerson(person(1, 21600), now + 999).critical, false);
  assert.equal(timedPerson(person(1, 21600), now + 1000).critical, true);
  assert.equal(elapsedLabel(timedPerson(person(1, 21601), now).seconds), '06h 00m 01s');
});
test('timestamp ausente ou inválido nunca aparece como dentro do limite', () => {
  for (const entry of [null, 'inválido']) {
    const result = timedPerson({ ...person(1, 10), entrada: entry }, now);
    assert.equal(result.invalid, true); assert.equal(result.seconds, null); assert.equal(result.critical, false);
  }
  assert.equal(timedPerson(person(1, -10), now).seconds, 0);
});
test('críticos ficam fixos em toda página e regulares alternam por maior permanência', () => {
  const people = orderPeople([person(5, 1000), person(4, 1200), person(3, 1700), person(2, 22000), person(1, 26000)], now);
  const first = monitorPage(people, 3, 0), second = monitorPage(people, 3, 1);
  assert.equal(first.pages, 3);
  assert.deepEqual(first.visible.map(p => p.acesso_id), [1, 2, 3]);
  assert.deepEqual(second.visible.map(p => p.acesso_id), [1, 2, 4]);
  assert.deepEqual(monitorPage(people, 3, 3).visible, first.visible);
});
test('saturação é sinalizada e nenhum crítico entra na paginação dos regulares', () => {
  const people = orderPeople([person(1, 26000), person(2, 25000), person(3, 24000), person(4, 100)], now);
  const page = monitorPage(people, 2, 20);
  assert.equal(page.overflow, true); assert.equal(page.waiting, 1);
  assert.deepEqual(page.visible.map(p => p.acesso_id), [1, 2, 3]);
});
