const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('./xlsx.js');

const dbPath = path.join(__dirname, 'minex.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error("Erro:", err); return; }
    iniciarImportacao();
});

function iniciarImportacao() {
    console.log("Iniciando importação completa de turmas...");
    const filePath = path.join(__dirname, 'public', 'turmas.xlsx');
    const buf = fs.readFileSync(filePath);
    const workbook = xlsx.read(buf, { type: 'buffer' });
    
    let count = 0;
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO usuarios (
                matricula, nome, cracha, empresa, funcao, turma, permissao, email, senha
            ) VALUES (
                ?, ?, ?, ?, ?, ?, 
                COALESCE((SELECT permissao FROM usuarios WHERE matricula = ?), 'Colaborador'),
                COALESCE((SELECT email FROM usuarios WHERE matricula = ?), ''),
                COALESCE((SELECT senha FROM usuarios WHERE matricula = ?), '')
            )
        `);
        
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
            
            data.forEach(row => {
                const cracha = row['MATRÍCULA \nDO CRACHÁ']?.toString() || '';
                const empresa = row['EMPRESA'] || '';
                const matricula = row['MATRÍCULA']?.toString() || '';
                const nome = row['COLABORADOR'] || '';
                const funcao = row['FUNÇÃO'] || '';
                const turma = sheetName;
                
                if (matricula && nome) {
                    stmt.run(matricula, nome, cracha, empresa, funcao, turma, matricula, matricula, matricula);
                    count++;
                }
            });
        }
        
        stmt.finalize();
        db.run("COMMIT", () => {
            console.log(`Importação concluída: ${count} registros processados de ${workbook.SheetNames.length} turmas.`);
            db.close();
        });
    });
}
