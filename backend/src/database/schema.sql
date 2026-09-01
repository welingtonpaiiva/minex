-- SCHEMA INDUSTRIAL - CASA DA LANTERNA

-- 1. TABELA DE USUÁRIOS DO SISTEMA (OPERADORES E ADMINS)
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  matricula TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  nivel_acesso TEXT NOT NULL DEFAULT 'OPERADOR', -- ADMINISTRADOR, OPERADOR, CONSULTA
  status TEXT NOT NULL DEFAULT 'ATIVO',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 2. TABELA DE COLABORADORES (TRABALHADORES DA MINA)
CREATE TABLE IF NOT EXISTS colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  matricula TEXT UNIQUE NOT NULL,
  setor TEXT DEFAULT '',
  cargo TEXT DEFAULT '',
  foto_url TEXT DEFAULT '',
  nfc_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'ATIVO', -- ATIVO, INATIVO
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_nfc ON colaboradores(nfc_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_matricula ON colaboradores(matricula);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(nome);

-- 3. TABELA DE CATEGORIAS DE MATERIAIS
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT UNIQUE NOT NULL,
  descricao TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 4. TABELA DE MATERIAIS / EQUIPAMENTOS INDIVIDUAIS
CREATE TABLE IF NOT EXISTS materiais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  codigo_interno TEXT UNIQUE NOT NULL,
  codigo_barras TEXT UNIQUE NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id),
  patrimonio TEXT DEFAULT '',
  foto_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DISPONIVEL', -- DISPONIVEL, EM_USO, MANUTENCAO
  observacao TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_materiais_codigo_barras ON materiais(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_materiais_codigo_interno ON materiais(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_materiais_status ON materiais(status);

-- 5. TABELA DE EMPRÉSTIMOS ATIVOS (1 MATERIAL = NO MÁXIMO 1 EMPRÉSTIMO ATIVO)
CREATE TABLE IF NOT EXISTS emprestimos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  material_id INTEGER UNIQUE NOT NULL REFERENCES materiais(id), -- Garantia de 1 empréstimo ativo por material
  operador_saida_id INTEGER NOT NULL REFERENCES usuarios(id),
  data_hora_saida TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_emprestimos_colaborador ON emprestimos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_emprestimos_material ON emprestimos(material_id);

-- 6. TABELA DE MOVIMENTAÇÕES HISTÓRICAS PERMANENTES
CREATE TABLE IF NOT EXISTS movimentacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER REFERENCES materiais(id),
  material_codigo TEXT NOT NULL,
  material_nome TEXT NOT NULL,
  colaborador_id INTEGER REFERENCES colaboradores(id),
  colaborador_nome TEXT NOT NULL,
  colaborador_matricula TEXT NOT NULL,
  operador_id INTEGER REFERENCES usuarios(id),
  operador_nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- SAIDA, ENTRADA, MANUTENCAO
  data_hora TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  observacao TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_colaborador ON movimentacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_material ON movimentacoes(material_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data_hora ON movimentacoes(data_hora);
