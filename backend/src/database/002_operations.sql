CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  referencia_id INTEGER NOT NULL,
  detalhes TEXT NOT NULL,
  data_hora TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auditoria_ref ON auditoria(entidade, referencia_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_data ON auditoria(data_hora);
CREATE TABLE IF NOT EXISTS acessos_mina (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  entrada TEXT NOT NULL,
  saida TEXT,
  operador_entrada_id INTEGER NOT NULL REFERENCES usuarios(id),
  operador_saida_id INTEGER REFERENCES usuarios(id),
  destino TEXT NOT NULL DEFAULT '',
  justificativa TEXT NOT NULL DEFAULT '',
  ativo_colaborador_id INTEGER UNIQUE REFERENCES colaboradores(id)
);
CREATE INDEX IF NOT EXISTS idx_acessos_entrada ON acessos_mina(entrada);
CREATE INDEX IF NOT EXISTS idx_acessos_colaborador ON acessos_mina(colaborador_id);
CREATE TABLE IF NOT EXISTS treinamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ATIVO'
);
CREATE TABLE IF NOT EXISTS colaborador_treinamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  treinamento_id INTEGER NOT NULL REFERENCES treinamentos(id),
  obrigatorio INTEGER NOT NULL DEFAULT 1,
  realizacao TEXT,
  validade TEXT,
  sem_vencimento INTEGER NOT NULL DEFAULT 0,
  em_analise INTEGER NOT NULL DEFAULT 0,
  impeditivo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  observacao TEXT NOT NULL DEFAULT '',
  responsavel_id INTEGER NOT NULL REFERENCES usuarios(id),
  updated_at TEXT NOT NULL,
  UNIQUE(colaborador_id, treinamento_id)
);
CREATE INDEX IF NOT EXISTS idx_treinamentos_colab ON colaborador_treinamentos(colaborador_id, status);
CREATE TABLE IF NOT EXISTS extravios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emprestimo_origem_id INTEGER NOT NULL UNIQUE,
  material_id INTEGER NOT NULL REFERENCES materiais(id),
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  retirada TEXT NOT NULL,
  prazo_devolucao TEXT,
  identificado_em TEXT NOT NULL,
  destino TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL,
  situacao TEXT NOT NULL,
  responsavel_id INTEGER NOT NULL REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_extravios_situacao ON extravios(situacao);
CREATE TABLE IF NOT EXISTS requisicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  chave TEXT NOT NULL,
  assinatura TEXT NOT NULL,
  resposta_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(usuario_id, chave)
);
