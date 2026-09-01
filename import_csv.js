const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'minex.db');
const csvPath = path.join(__dirname, 'public', 'ATUALIZAÇÃO DAS TURMAS..1.csv');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error("Erro:", err); return; }

    const content = fs.readFileSync(csvPath, 'latin1');
    const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n');
    
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(';')) {
            const cols = lines[i].split(';');
            if (/^\d+/.test(cols[0])) {
                startIndex = i;
                break;
            }
        }
    }
    
    let inserts = 0;
    let updates = 0;
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        const insertStmt = db.prepare(`
            INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, email, senha, permissao)
            VALUES (?, ?, ?, ?, ?, ?, 1, '', '', 'Colaborador')
        `);

        const updateStmt = db.prepare(`
            UPDATE colaboradores 
            SET empresa = ?, matricula = ?, colaborador = ?, funcao = ?
            WHERE matricula_cracha = ?
        `);
        
        db.all("SELECT matricula_cracha FROM colaboradores", [], (err, rows) => {
            if (err) { console.error(err); return; }
            
            const existingCrachas = new Set(rows.map(r => r.matricula_cracha));
            
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const parts = line.split(';');
                if (parts.length >= 4) {
                    const cracha = parts[0] ? parts[0].trim() : '';
                    const empresa = parts[1] ? parts[1].trim() : '';
                    const matricula = parts[2] ? parts[2].trim() : '';
                    const colaborador = parts[3] ? parts[3].trim() : '';
                    const funcao = parts[4] ? parts[4].trim() : '';
                    
                    if (!cracha) continue;

                    if (existingCrachas.has(cracha)) {
                        updateStmt.run(empresa, matricula, colaborador, funcao, cracha);
                        updates++;
                    } else {
                        // Se não existe turma no CSV, vamos definir como 'Todas' ou vazio
                        insertStmt.run(cracha, empresa, matricula, colaborador, funcao, '');
                        existingCrachas.add(cracha);
                        inserts++;
                    }
                }
            }
            
            insertStmt.finalize();
            updateStmt.finalize();
            
            db.run("COMMIT", () => {
                console.log("========================================");
                console.log("IMPORTAÇÃO/ATUALIZAÇÃO DE CSV CONCLUÍDA.");
                console.log(`Novos colaboradores inseridos: ${inserts}`);
                console.log(`Colaboradores existentes atualizados: ${updates}`);
                console.log("========================================");
                db.close();
            });
        });
    });
});
