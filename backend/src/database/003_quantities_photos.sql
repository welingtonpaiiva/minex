CREATE TABLE IF NOT EXISTS fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  arquivo TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL UNIQUE,
  tamanho INTEGER NOT NULL,
  largura INTEGER NOT NULL,
  altura INTEGER NOT NULL,
  responsavel_id INTEGER NOT NULL REFERENCES usuarios(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS emprestimos_quantidade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL REFERENCES materiais(id),
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  quantidade INTEGER NOT NULL,
  devolvida INTEGER NOT NULL DEFAULT 0,
  retirada TEXT NOT NULL,
  prazo_devolucao TEXT,
  destino TEXT NOT NULL DEFAULT '',
  operador_id INTEGER NOT NULL REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_eq_material ON emprestimos_quantidade(material_id);
CREATE INDEX IF NOT EXISTS idx_eq_colaborador ON emprestimos_quantidade(colaborador_id);
