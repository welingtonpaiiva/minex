const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('./xlsx.js');

const dbPath = path.join(__dirname, 'minex.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error("Erro:", err); return; }
    
    // Ler Excel e pegar matrículas
    const filePath = path.join(__dirname, 'public', 'turmas.xlsx');
    const buf = fs.readFileSync(filePath);
    const workbook = xlsx.read(buf, { type: 'buffer' });
    
    const matriculasExcel = new Set();
    // Proteger o admin
    matriculasExcel.add('admin');
    
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
        data.forEach(row => {
            const m = row['MATRÍCULA']?.toString().toLowerCase();
            if (m) matriculasExcel.add(m);
        });
    }
    
    console.log(`Encontradas ${matriculasExcel.size} matrículas válidas (incluindo admin).`);
    
    db.all("SELECT matricula FROM usuarios", (err, rows) => {
        if (err) { console.error("Erro no SELECT:", err); return; }
        
        let toDelete = [];
        rows.forEach(r => {
            if (!matriculasExcel.has(r.matricula.toLowerCase())) {
                toDelete.push(r.matricula);
            }
        });
        
        if (toDelete.length === 0) {
            console.log("Nenhum usuário extra encontrado para excluir.");
            db.close();
            return;
        }
        
        console.log(`Excluindo ${toDelete.length} usuários que não estão na planilha...`);
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("DELETE FROM usuarios WHERE matricula = ?");
            toDelete.forEach(mat => stmt.run(mat));
            stmt.finalize();
            db.run("COMMIT", () => {
                console.log("Exclusão concluída com sucesso.");
                db.close();
            });
        });
    });
});
