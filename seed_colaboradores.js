const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('./xlsx.js');

const dbPath = path.join(__dirname, 'minex.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error("Erro:", err); return; }
    console.log("========================================");
    console.log("IMPORTAÇÃO DE COLABORADORES");
    console.log("========================================\n");
    iniciarSeed();
});

function normalizarTexto(txt) {
    if (!txt) return '';
    return txt.toString().replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
}

function iniciarSeed() {
    // 1. Forçar a criação da tabela colaboradores caso ainda não exista
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS colaboradores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matricula_cracha TEXT NOT NULL,
            empresa TEXT NOT NULL,
            matricula TEXT NOT NULL,
            colaborador TEXT NOT NULL,
            funcao TEXT NOT NULL,
            turma TEXT NOT NULL,
            ativo INTEGER NOT NULL DEFAULT 1,
            email TEXT,
            senha TEXT,
            permissao TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // 2. Tentar migrar admin e outros usuários críticos da tabela antiga
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'", [], (err, rows) => {
            if (rows.length > 0) {
                db.all("SELECT * FROM usuarios", [], (err, users) => {
                    if (!err && users) {
                        users.forEach(u => {
                            if (u.matricula === 'admin' || u.permissao === 'Admin') {
                                // Inserir se não existir
                                db.run(`INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, email, senha, permissao)
                                        SELECT ?, ?, ?, ?, ?, ?, 1, ?, ?, ?
                                        WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE matricula = ?)`,
                                    ['ADMIN_CRACHA', 'ADMIN', u.matricula, u.nome || 'Admin', 'Administrador', 'ADM', u.email, u.senha, u.permissao, u.matricula]
                                );
                            }
                        });
                    }
                    importarPlanilha();
                });
            } else {
                importarPlanilha();
            }
        });
    });
}

function importarPlanilha() {
    const filePath = path.join(__dirname, 'public', 'turmas.xlsx');
    
    if (!fs.existsSync(filePath)) {
        console.error("Arquivo turmas.xlsx não encontrado em public/.");
        return db.close();
    }

    const buf = fs.readFileSync(filePath);
    const workbook = xlsx.read(buf, { type: 'buffer' });
    
    let stats = {
        'A': 0, 'B': 0, 'C': 0, 'D': 0, 'ADM': 0
    };
    
    let totais = 0;
    let duplicados = 0;
    let vazios = 0;
    
    // Mapeamento das abas
    const mapTurmas = {
        'TURMA A': 'A',
        'TURMA B': 'B',
        'TURMA C': 'C',
        'TURMA D': 'D',
        'ADM': 'ADM'
    };
    
    // Obter matrículas já existentes para reportar repetição, mas permitir
    const matriculasUsadas = new Set();
    let matRepetidas = 0;

    // Obter dados existentes para idempotência (matricula_cracha + empresa)
    db.all("SELECT matricula_cracha, empresa FROM colaboradores", [], (err, rows) => {
        const existentes = new Set((rows || []).map(r => `${r.matricula_cracha}_${r.empresa}`));
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare(`
                INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, email, senha, permissao)
                VALUES (?, ?, ?, ?, ?, ?, 1, '', '', 'Colaborador')
            `);
            
            for (const sheetName of workbook.SheetNames) {
                const turmaNorm = mapTurmas[sheetName.trim().toUpperCase()];
                if (!turmaNorm) continue;
                
                const sheet = workbook.Sheets[sheetName];
                const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
                
                data.forEach(row => {
                    const cracha = normalizarTexto(row['MATRÍCULA \nDO CRACHÁ'] || row['MATRÍCULA DO CRACHÁ'] || '');
                    const empresa = normalizarTexto(row['EMPRESA'] || '');
                    const matricula = normalizarTexto(row['MATRÍCULA'] || '');
                    const nome = normalizarTexto(row['COLABORADOR'] || '');
                    const funcao = normalizarTexto(row['FUNÇÃO'] || '');
                    
                    if (!cracha || !empresa || !matricula || !nome || !funcao) {
                        vazios++;
                        return; // Pula se faltar algum obrigatório
                    }
                    
                    const chaveUnique = `${cracha}_${empresa}`;
                    if (existentes.has(chaveUnique)) {
                        duplicados++;
                        return;
                    }
                    
                    if (matriculasUsadas.has(matricula)) {
                        matRepetidas++;
                    }
                    matriculasUsadas.add(matricula);
                    
                    stmt.run(cracha, empresa, matricula, nome, funcao, turmaNorm);
                    existentes.add(chaveUnique);
                    
                    if (stats[turmaNorm] !== undefined) stats[turmaNorm]++;
                    totais++;
                });
            }
            
            stmt.finalize();
            db.run("COMMIT", () => {
                console.log(`Planilha: ATUALIZAÇÃO DAS TURMAS...xlsx\n`);
                console.log(`Turma A: ${stats['A']}`);
                console.log(`Turma B: ${stats['B']}`);
                console.log(`Turma C: ${stats['C']}`);
                console.log(`Turma D: ${stats['D']}`);
                console.log(`ADM:     ${stats['ADM']}\n`);
                console.log(`TOTAL:   ${totais}\n`);
                
                console.log(`Crachás/Empresa duplicados (ignorados): ${duplicados}`);
                console.log(`Campos obrigatórios vazios (ignorados): ${vazios}`);
                console.log(`Matrículas repetidas (inseridas com sucesso): ${matRepetidas}\n`);
                
                console.log("Importação concluída.");
                console.log("========================================");
                db.close();
            });
        });
    });
}
