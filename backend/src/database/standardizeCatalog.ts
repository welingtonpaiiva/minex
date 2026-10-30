import fs from 'fs';
import path from 'path';
import { databaseClient, sqlitePath, query, queryOne, withTransaction, closeDatabase } from '../config/db';
import { previewCatalogStandardization, applyCatalogStandardization } from '../services/CatalogStandardization';

async function main() {
  const databaseFlag = process.argv.indexOf('--database');
  if (databaseClient !== 'sqlite' || databaseFlag < 0 || !process.argv[databaseFlag + 1] ||
      path.resolve(process.argv[databaseFlag + 1]) !== sqlitePath) {
    throw new Error('Indique explicitamente o SQLite local configurado com --database CAMINHO.');
  }
  if (!fs.existsSync(sqlitePath)) throw new Error('Banco não encontrado');
  const preview = await previewCatalogStandardization();
  const { items, ...summary } = preview;
  console.log(JSON.stringify({ previa: summary }));
  if (!process.argv.includes('--apply')) return;
  if (preview.lanternas_faltantes.length) throw new Error('Complete o cadastro das lanternas faltantes antes de aplicar esta manutenção.');
  if (!preview.alterados) { console.log('Catálogo já padronizado. Nenhuma alteração.'); return; }
  const directory = path.resolve(__dirname, '../../../backups/catalogo-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(directory, { recursive: true });
  const backup = path.join(directory, 'antes.db');
  await query('VACUUM INTO ?', [backup]);
  fs.writeFileSync(path.join(directory, 'previa.json'), JSON.stringify(preview, null, 2));
  const report = await withTransaction(async execute => {
    // Identidade técnica inativa: registra a execução local sem atribuí-la a um funcionário.
    let actor = await queryOne('SELECT id,status,nivel_acesso FROM usuarios WHERE matricula=?', ['__SISTEMA_CATALOGO__']);
    if (actor && (actor.status !== 'INATIVO' || actor.nivel_acesso !== 'CONSULTA')) throw new Error('Identidade técnica inesperada.');
    if (!actor) actor = (await execute('INSERT INTO usuarios (nome,matricula,senha_hash,nivel_acesso,status) VALUES (?,?,?,?,?)',
      ['Sistema - manutenção de catálogo', '__SISTEMA_CATALOGO__', '!SEM_LOGIN', 'CONSULTA', 'INATIVO']))[0];
    return applyCatalogStandardization(preview.versao, actor.id);
  });
  fs.writeFileSync(path.join(directory, 'resultado.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ resultado: report, backup }));
}
if (require.main === module) main().then(closeDatabase).catch(async error => {
  console.error(error.message); await closeDatabase(); process.exitCode = 1;
});
