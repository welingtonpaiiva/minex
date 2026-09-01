const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'minex.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error("Erro:", err); return; }
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("INSERT OR IGNORE INTO equipamentos (codigo, descricao) VALUES (?, ?)");
        
        let count = 0;
        for (let i = 1; i <= 100; i++) {
            // Pad start: 1 -> "01", 100 -> "100"
            const num = i.toString().padStart(2, '0');
            stmt.run(`LANT-${num}`, 'Lanterna de Mineiro');
            count++;
        }
        
        stmt.finalize();
        db.run("COMMIT", () => {
            console.log(`Sucesso: ${count} lanternas adicionadas.`);
            db.close();
        });
    });
});
