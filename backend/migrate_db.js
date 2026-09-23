const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./minex.db');

db.run('ALTER TABLE materiais DROP COLUMN codigo_interno', (err) => {
  if (err) {
    console.log('DROP COLUMN not supported, using table recreation...');
    db.serialize(() => {
      db.run('DROP TABLE IF EXISTS materiais_new');
      db.run(`CREATE TABLE materiais_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        codigo_barras TEXT UNIQUE,
        categoria_id INTEGER,
        patrimonio TEXT,
        foto_url TEXT,
        status TEXT NOT NULL DEFAULT 'DISPONIVEL',
        observacao TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(categoria_id) REFERENCES categorias(id)
      )`);
      db.run(`INSERT INTO materiais_new (id, nome, codigo_barras, categoria_id, patrimonio, foto_url, status, observacao, criado_em, atualizado_em)
              SELECT id, nome, codigo_barras, categoria_id, patrimonio, foto_url, status, observacao, criado_em, atualizado_em FROM materiais`);
      db.run('DROP TABLE materiais');
      db.run('ALTER TABLE materiais_new RENAME TO materiais');
      db.run('CREATE INDEX idx_materiais_codigo_barras ON materiais(codigo_barras)', () => {
        console.log('Migration complete via recreation!');
      });
    });
  } else {
    console.log('Migration complete via DROP COLUMN!');
  }
});
