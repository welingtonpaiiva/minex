CREATE TABLE IF NOT EXISTS kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DISPONIVEL',
  criado_por_id INTEGER REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS kit_materiais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kit_id INTEGER NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materiais(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_kits_status ON kits(status);
CREATE INDEX IF NOT EXISTS idx_kit_materiais_kit ON kit_materiais(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_materiais_material ON kit_materiais(material_id);
