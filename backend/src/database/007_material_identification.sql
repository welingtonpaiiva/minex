-- Serializa alterações de TAG e código de barras, inclusive entre processos.
CREATE TABLE IF NOT EXISTS material_identification_lock (
  id INTEGER PRIMARY KEY
);
INSERT INTO material_identification_lock (id) SELECT 1 WHERE NOT EXISTS (SELECT id FROM material_identification_lock WHERE id = 1);
