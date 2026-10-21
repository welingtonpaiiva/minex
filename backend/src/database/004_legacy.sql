CREATE TABLE IF NOT EXISTS legado_esquemas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tabela TEXT NOT NULL UNIQUE,
  sql_original TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS legado_registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tabela TEXT NOT NULL,
  registro_id INTEGER NOT NULL,
  dados_json TEXT NOT NULL,
  UNIQUE(tabela, registro_id)
);
