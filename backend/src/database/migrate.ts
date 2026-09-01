import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/db';

export async function runMigrations() {
  console.log('[MIGRATE] Iniciando criação das tabelas...');

  let schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/database/schema.sql');
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../src/database/schema.sql');
  }
  const sqlContent = fs.readFileSync(schemaPath, 'utf-8');

  // Dividir o script por instruções individuais
  const statements = sqlContent
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);

  // Verificar se existem tabelas com schema legado e dropar para recriar com a estrutura correta
  try {
    const userCols = await query("PRAGMA table_info(usuarios)");
    const hasSenhaHash = Array.isArray(userCols) && userCols.some((col: any) => col.name === 'senha_hash');
    if (userCols.length > 0 && !hasSenhaHash) {
      console.log('[MIGRATE] Tabela usuarios legada detectada. Atualizando estrutura...');
      await query("DROP TABLE IF EXISTS emprestimos");
      await query("DROP TABLE IF EXISTS movimentacoes");
      await query("DROP TABLE IF EXISTS materiais");
      await query("DROP TABLE IF EXISTS categorias");
      await query("DROP TABLE IF EXISTS colaboradores");
      await query("DROP TABLE IF EXISTS usuarios");
    }

    const colabCols = await query("PRAGMA table_info(colaboradores)");
    const hasNfc = Array.isArray(colabCols) && colabCols.some((col: any) => col.name === 'nfc_id');
    if (colabCols.length > 0 && !hasNfc) {
      console.log('[MIGRATE] Tabela colaboradores legada detectada. Atualizando estrutura...');
      await query("DROP TABLE IF EXISTS emprestimos");
      await query("DROP TABLE IF EXISTS movimentacoes");
      await query("DROP TABLE IF EXISTS colaboradores");
    }
  } catch (e) {
    // Ignorar erro se tabela não existir
  }

  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch (err: any) {
      // Ignorar erros secundários de índice existente
      if (!err.message?.includes('already exists')) {
        console.error('[MIGRATE] Erro ao executar SQL:', err.message);
      }
    }
  }

  console.log('[MIGRATE] Tabelas criadas com sucesso!');

  // Seed do usuário Admin Padrão
  const adminExist = await queryOne('SELECT * FROM usuarios WHERE matricula = ?', ['999999']);
  if (!adminExist) {
    const hash = await bcrypt.hash('123456', 10);
    await query(
      'INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)',
      ['ADMINISTRADOR CASA DA LANTERNA', '999999', hash, 'ADMINISTRADOR', 'ATIVO']
    );
    console.log('[SEED] Usuário Admin padrão criado: Matrícula 999999 / Senha 123456');
  }

  // Seed de Operador Padrão
  const operadorExist = await queryOne('SELECT * FROM usuarios WHERE matricula = ?', ['1001']);
  if (!operadorExist) {
    const hash = await bcrypt.hash('123456', 10);
    await query(
      'INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)',
      ['OPERADOR DE BALCÃO', '1001', hash, 'OPERADOR', 'ATIVO']
    );
    console.log('[SEED] Usuário Operador criado: Matrícula 1001 / Senha 123456');
  }

  // Seed de Categorias Padrão
  const categoriasPadrao = ['Iluminação', 'Comunicação', 'Detecção de Gás', 'Segurança', 'Operação LHD', 'Ferramentas'];
  for (const cat of categoriasPadrao) {
    const catExist = await queryOne('SELECT * FROM categorias WHERE nome = ?', [cat]);
    if (!catExist) {
      await query('INSERT INTO categorias (nome, descricao) VALUES (?, ?)', [cat, `Categoria ${cat}`]);
    }
  }

  // Seed de Colaboradores Iniciais (se vazio)
  const colabCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM colaboradores');
  if (colabCount && (colabCount.count === 0 || colabCount.count === undefined)) {
    const colaboradoresSeed = [
      { nome: 'ENZO DE OLIVEIRA FIRMO', matricula: '99300922', setor: 'OPERAÇÃO', cargo: 'Operador de LHD', nfc: '00270584711361' },
      { nome: 'JOÃO DA SILVA', matricula: '001245', setor: 'MINA SUBTERRÂNEA', cargo: 'Técnico de Mineração', nfc: '00270584711362' },
      { nome: 'CARLOS SILVA', matricula: '001246', setor: 'MANUTENÇÃO', cargo: 'Eletricista Industrial', nfc: '00270584711363' },
      { nome: 'MARIA APARECIDA', matricula: '001247', setor: 'SEGURANÇA', cargo: 'Técnica de Segurança', nfc: '00270584711364' }
    ];

    for (const c of colaboradoresSeed) {
      await query(
        'INSERT INTO colaboradores (nome, matricula, setor, cargo, nfc_id, status) VALUES (?, ?, ?, ?, ?, ?)',
        [c.nome, c.matricula, c.setor, c.cargo, c.nfc, 'ATIVO']
      );
    }
    console.log('[SEED] Colaboradores iniciais criados com sucesso!');
  }

  // Seed de Materiais Iniciais (se vazio)
  const matCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM materiais');
  if (matCount && (matCount.count === 0 || matCount.count === undefined)) {
    const catIluminacao = await queryOne('SELECT id FROM categorias WHERE nome = ?', ['Iluminação']);
    const catComunicao = await queryOne('SELECT id FROM categorias WHERE nome = ?', ['Comunicação']);
    const catOperacao = await queryOne('SELECT id FROM categorias WHERE nome = ?', ['Operação LHD']);
    const catDeteccao = await queryOne('SELECT id FROM categorias WHERE nome = ?', ['Detecção de Gás']);

    const materiaisSeed = [
      { nome: 'Lanterna de Capacete LED', codigo: 'LAT-001', cat: catIluminacao?.id || 1, status: 'DISPONIVEL', patrimonio: 'PAT-10001' },
      { nome: 'Lanterna de Capacete LED', codigo: 'LAT-002', cat: catIluminacao?.id || 1, status: 'DISPONIVEL', patrimonio: 'PAT-10002' },
      { nome: 'Lanterna de Capacete LED', codigo: 'LAT-003', cat: catIluminacao?.id || 1, status: 'DISPONIVEL', patrimonio: 'PAT-10003' },
      { nome: 'Rádio HT Digital Subterrâneo', codigo: 'RAD-001', cat: catComunicao?.id || 2, status: 'DISPONIVEL', patrimonio: 'PAT-20001' },
      { nome: 'Rádio HT Digital Subterrâneo', codigo: 'RAD-002', cat: catComunicao?.id || 2, status: 'DISPONIVEL', patrimonio: 'PAT-20002' },
      { nome: 'Controle Remoto LHD Caterpillar', codigo: 'LHD-001', cat: catOperacao?.id || 5, status: 'DISPONIVEL', patrimonio: 'PAT-30001' },
      { nome: 'Controle Remoto LHD Caterpillar', codigo: 'LHD-002', cat: catOperacao?.id || 5, status: 'DISPONIVEL', patrimonio: 'PAT-30002' },
      { nome: 'Detector Mutigás MX4', codigo: 'DET-001', cat: catDeteccao?.id || 3, status: 'DISPONIVEL', patrimonio: 'PAT-40001' },
      { nome: 'Detector Mutigás MX4', codigo: 'DET-002', cat: catDeteccao?.id || 3, status: 'MANUTENCAO', patrimonio: 'PAT-40002', obs: 'Sensor de H2S necessita calibração' }
    ];

    for (const m of materiaisSeed) {
      await query(
        'INSERT INTO materiais (nome, codigo_interno, codigo_barras, categoria_id, patrimonio, status, observacao) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [m.nome, m.codigo, m.codigo, m.cat, m.patrimonio, m.status, m.obs || '']
      );
    }
    console.log('[SEED] Materiais individuais criados com sucesso!');
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[MIGRATE] Migração executada.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRATE] Erro fatal na migração:', err);
      process.exit(1);
    });
}
