const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// Conexão com o Banco de Dados SQLite
const dbPath = path.join(__dirname, 'minex.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Erro ao abrir o banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite (minex.db).");
        inicializarBanco();
    }
});

function inicializarBanco() {
    db.serialize(() => {
        // 1. Tabela de Colaboradores
        db.run(`CREATE TABLE IF NOT EXISTS colaboradores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matricula_cracha TEXT,
            empresa TEXT DEFAULT '',
            matricula TEXT NOT NULL UNIQUE,
            colaborador TEXT NOT NULL,
            funcao TEXT DEFAULT '',
            turma TEXT DEFAULT '',
            ativo INTEGER NOT NULL DEFAULT 1,
            email TEXT DEFAULT '',
            senha TEXT DEFAULT '123456',
            permissao TEXT DEFAULT 'OPERADOR',
            foto_url TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(colaborador)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_colaboradores_matricula ON colaboradores(matricula)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_colaboradores_cracha ON colaboradores(matricula_cracha)`);

        // 2. Tabela de Itens / Materiais
        db.run(`CREATE TABLE IF NOT EXISTS itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_barras TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            categoria TEXT DEFAULT 'Geral',
            descricao TEXT DEFAULT '',
            foto_url TEXT DEFAULT '',
            qtd_total INTEGER DEFAULT 1,
            status TEXT DEFAULT 'GUARDADO',
            localizacao TEXT DEFAULT 'Almoxarifado Principal',
            colaborador_id INTEGER,
            colaborador_mat TEXT,
            colaborador_nome TEXT,
            data_saida TEXT,
            operador_saida TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_itens_codigo ON itens(codigo_barras)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_itens_status ON itens(status)`);

        // Backward compatibility: Tabela equipamentos
        db.run(`CREATE TABLE IF NOT EXISTS equipamentos (
            codigo TEXT PRIMARY KEY,
            descricao TEXT
        )`);

        // 3. Tabela de Movimentações Rastreáveis
        db.run(`CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            codigo_barras TEXT NOT NULL,
            item_nome TEXT NOT NULL,
            colaborador_id INTEGER,
            colaborador_mat TEXT,
            colaborador_nome TEXT,
            tipo TEXT NOT NULL, -- ENTRADA, SAÍDA, MANUTENÇÃO
            data_hora TEXT NOT NULL,
            operador_id INTEGER,
            operador_nome TEXT NOT NULL,
            observacao TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_mov_codigo ON movimentacoes(codigo_barras)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_mov_colab ON movimentacoes(colaborador_id)`);

        // Migrar equipamentos existentes para a tabela itens se não existirem
        db.all("SELECT codigo, descricao FROM equipamentos", [], (err, rows) => {
            if (!err && rows && rows.length > 0) {
                rows.forEach(eq => {
                    db.run(
                        `INSERT OR IGNORE INTO itens (codigo_barras, nome, categoria, status) VALUES (?, ?, ?, ?)`,
                        [eq.codigo, eq.descricao || eq.codigo, 'Equipamento', 'GUARDADO']
                    );
                });
            }
        });

        // Seed inicial de colaboradores padrão se a tabela estiver vazia
        db.get("SELECT COUNT(*) as total FROM colaboradores", [], (err, row) => {
            if (!err && row && row.total === 0) {
                db.run(`INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, permissao, senha)
                        VALUES ('1001', 'CMOC', '1001', 'Welington Paiva', 'Administrador de Almoxarifado', 'A', 1, 'ADMINISTRADOR', '123456')`);
                db.run(`INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, permissao, senha)
                        VALUES ('2002', 'CMOC', '2002', 'João da Silva', 'Operador de Mina', 'B', 1, 'OPERADOR', '123456')`);
                db.run(`INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, permissao, senha)
                        VALUES ('3003', 'CMOC', '3003', 'Maria Santos', 'Técnica de Manutenção', 'C', 1, 'OPERADOR', '123456')`);
                db.run(`INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, permissao, senha)
                        VALUES ('4004', 'TERCEIRO', '4004', 'Carlos Oliveira (Inativo)', 'Auxiliar de Serviços', 'D', 0, 'OPERADOR', '123456')`);
            }
        });

        // Seed inicial de itens se a tabela estiver vazia
        db.get("SELECT COUNT(*) as total FROM itens", [], (err, row) => {
            if (!err && row && row.total === 0) {
                const itensIniciais = [
                    { codigo: '789456123001', nome: 'FURADEIRA ELÉTRICA INDUSTRIAL 750W', cat: 'Ferramentas Elétricas', status: 'GUARDADO' },
                    { codigo: '789456123002', nome: 'LANTERNA DE CAPACETE MINERAÇÃO LED', cat: 'Iluminação', status: 'GUARDADO' },
                    { codigo: '789456123003', nome: 'AUTORESGATADOR DE OXIGÊNIO MSHA', cat: 'Segurança / EPI', status: 'GUARDADO' },
                    { codigo: '789456123004', nome: 'MULTÍMETRO DIGITAL FLUKES 87V', cat: 'Instrumentação', status: 'GUARDADO' },
                    { codigo: '789456123005', nome: 'DETECTORES DE GÁS QUADRAGÁS ALTA PRECISÃO', cat: 'Segurança / EPI', status: 'GUARDADO' },
                    { codigo: '789456123006', nome: 'CHAVE DE IMPACTO PNEUMÁTICA 1/2"', cat: 'Ferramentas Pneumáticas', status: 'MANUTENÇÃO' },
                ];
                itensIniciais.forEach(i => {
                    db.run(`INSERT INTO itens (codigo_barras, nome, categoria, status, qtd_total) VALUES (?, ?, ?, ?, 1)`,
                        [i.codigo, i.nome, i.cat, i.status]
                    );
                    db.run(`INSERT OR REPLACE INTO equipamentos (codigo, descricao) VALUES (?, ?)`, [i.codigo, i.nome]);
                });
            }
        });
    });
}

// ==========================================
// ROTAS DA API
// ==========================================

// --- AUTH / LOGIN ---
app.post('/api/auth/login', (req, res) => {
    const { matricula, senha } = req.body;
    if (!matricula) {
        return res.status(400).json({ error: 'Matrícula é obrigatória' });
    }

    db.get(
        "SELECT id, matricula, colaborador as nome, permissao, ativo, turma, funcao FROM colaboradores WHERE matricula = ? OR matricula_cracha = ?",
        [matricula, matricula],
        (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) {
                // Se for admin padrão de emergência
                if (matricula === 'admin' || matricula === '1001') {
                    return res.json({
                        id: 1,
                        matricula: '1001',
                        nome: 'Welington Paiva',
                        permissao: 'ADMINISTRADOR',
                        ativo: 1
                    });
                }
                return res.status(401).json({ error: 'Matrícula ou operador não encontrado' });
            }
            if (user.ativo === 0) {
                return res.status(403).json({ error: 'Operador inativo no sistema' });
            }
            res.json(user);
        }
    );
});

// --- COLABORADORES ---
app.get('/api/colaboradores', (req, res) => {
    const q = req.query.q ? `%${req.query.q}%` : null;
    const ativo = req.query.ativo !== undefined ? req.query.ativo : null;

    let sql = "SELECT id, matricula_cracha as cracha, empresa, matricula, colaborador as nome, funcao, turma as setor, ativo, email, permissao, foto_url, created_at FROM colaboradores";
    let params = [];
    let conditions = [];

    if (q) {
        conditions.push("(colaborador LIKE ? OR matricula LIKE ? OR matricula_cracha LIKE ? OR funcao LIKE ? OR turma LIKE ?)");
        params.push(q, q, q, q, q);
    }
    if (ativo !== null) {
        conditions.push("ativo = ?");
        params.push(ativo);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY colaborador ASC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/colaboradores', (req, res) => {
    const cracha = req.body.cracha || req.body.matricula_cracha || '';
    const nome = req.body.nome || req.body.colaborador || '';
    const { id, empresa, matricula, funcao, setor, turma, ativo, email, permissao, senha, foto_url } = req.body;
    const setorTurma = setor || turma || '';
    const userPermissao = permissao || 'OPERADOR';

    if (!matricula || !nome) {
        return res.status(400).json({ error: 'Matrícula e Nome são obrigatórios.' });
    }

    if (id) {
        db.run(
            `UPDATE colaboradores SET 
                matricula_cracha=?, empresa=?, matricula=?, colaborador=?, funcao=?, turma=?, ativo=?, email=?, permissao=?, foto_url=?, updated_at=CURRENT_TIMESTAMP 
             WHERE id=?`,
            [cracha, empresa || 'CMOC', matricula, nome, funcao || '', setorTurma, ativo !== undefined ? Number(ativo) : 1, email || '', userPermissao, foto_url || '', id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id });
            }
        );
    } else {
        db.run(
            `INSERT INTO colaboradores (matricula_cracha, empresa, matricula, colaborador, funcao, turma, ativo, email, permissao, senha, foto_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cracha || matricula, empresa || 'CMOC', matricula, nome, funcao || '', setorTurma, ativo !== undefined ? Number(ativo) : 1, email || '', userPermissao, senha || '123456', foto_url || ''],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Matrícula já cadastrada no sistema.' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, id: this.lastID });
            }
        );
    }
});

app.put('/api/colaboradores/:id/status', (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;
    db.run("UPDATE colaboradores SET ativo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [Number(ativo), id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/colaboradores/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM colaboradores WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/colaboradores/:id/historico', (req, res) => {
    const { id } = req.params;
    db.all(
        "SELECT * FROM movimentacoes WHERE colaborador_id = ? ORDER BY id DESC",
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// --- ITENS / MATERIAIS ---
app.get('/api/itens', (req, res) => {
    const q = req.query.q ? `%${req.query.q}%` : null;
    const status = req.query.status || null;
    const categoria = req.query.categoria || null;

    let sql = "SELECT * FROM itens";
    let params = [];
    let conditions = [];

    if (q) {
        conditions.push("(codigo_barras LIKE ? OR nome LIKE ? OR categoria LIKE ? OR localizacao LIKE ?)");
        params.push(q, q, q, q);
    }
    if (status) {
        conditions.push("status = ?");
        params.push(status);
    }
    if (categoria) {
        conditions.push("categoria = ?");
        params.push(categoria);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY nome ASC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/itens/codigo/:codigo', (req, res) => {
    const { codigo } = req.params;
    db.get("SELECT * FROM itens WHERE codigo_barras = ?", [codigo], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Item não encontrado' });
        res.json(row);
    });
});

app.post('/api/itens', (req, res) => {
    const { id, codigo_barras, nome, categoria, descricao, foto_url, qtd_total, status, localizacao } = req.body;

    if (!codigo_barras || !nome) {
        return res.status(400).json({ error: 'Código de barras e Nome são obrigatórios.' });
    }

    if (id) {
        db.run(
            `UPDATE itens SET codigo_barras=?, nome=?, categoria=?, descricao=?, foto_url=?, qtd_total=?, status=?, localizacao=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [codigo_barras, nome, categoria || 'Geral', descricao || '', foto_url || '', qtd_total || 1, status || 'GUARDADO', localizacao || 'Almoxarifado Principal', id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                // Atualiza equipamentos para manter retrocompatibilidade
                db.run(`INSERT OR REPLACE INTO equipamentos (codigo, descricao) VALUES (?, ?)`, [codigo_barras, nome]);
                res.json({ success: true, id });
            }
        );
    } else {
        db.run(
            `INSERT INTO itens (codigo_barras, nome, categoria, descricao, foto_url, qtd_total, status, localizacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [codigo_barras, nome, categoria || 'Geral', descricao || '', foto_url || '', qtd_total || 1, status || 'GUARDADO', localizacao || 'Almoxarifado Principal'],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Código de barras já cadastrado em outro item.' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                const newId = this.lastID;
                db.run(`INSERT OR REPLACE INTO equipamentos (codigo, descricao) VALUES (?, ?)`, [codigo_barras, nome]);
                res.json({ success: true, id: newId });
            }
        );
    }
});

app.put('/api/itens/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['GUARDADO', 'EM USO', 'MANUTENÇÃO'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }
    db.run("UPDATE itens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/itens/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM itens WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- MOVIMENTAÇÕES (SAÍDA E ENTRADA) ---

// 1. REGISTRAR SAÍDA
app.post('/api/movimentacoes/saida', (req, res) => {
    const { codigo_barras, colaborador_id, operador_nome, observacao } = req.body;
    const opNome = operador_nome || 'Operador Balcão';

    if (!codigo_barras) {
        return res.status(400).json({ error: 'Código de barras do material é obrigatório.' });
    }
    if (!colaborador_id) {
        return res.status(400).json({ error: 'É necessário selecionar um colaborador responsável.' });
    }

    // Buscar item no banco
    db.get("SELECT * FROM itens WHERE codigo_barras = ?", [codigo_barras], (err, item) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!item) {
            return res.status(404).json({ error: 'CÓDIGO DE BARRAS NÃO CADASTRADO NO SISTEMA' });
        }

        // Validação da regra 1 & 2: Status do item
        if (item.status === 'EM USO') {
            return res.status(400).json({
                error: `ITEM JÁ ESTÁ EM USO! Responsável atual: ${item.colaborador_nome || 'Não identificado'} (Matrícula: ${item.colaborador_mat || '-'}), retirado em: ${item.data_saida ? new Date(item.data_saida).toLocaleString('pt-BR') : '-'}.`
            });
        }
        if (item.status === 'MANUTENÇÃO') {
            return res.status(400).json({ error: 'ITEM EM MANUTENÇÃO! Não é possível realizar saída deste item.' });
        }

        // Buscar colaborador responsável
        db.get("SELECT * FROM colaboradores WHERE id = ?", [colaborador_id], (err, colab) => {
            if (err) return res.status(400).json({ error: err.message });
            if (!colab) {
                return res.status(400).json({ error: 'Colaborador responsável não encontrado.' });
            }

            // Regra 4: Colaborador INATIVO não pode receber material
            if (colab.ativo === 0) {
                return res.status(400).json({ error: `COLABORADOR INATIVO (${colab.colaborador})! Não é permitido realizar saída para colaboradores inativos.` });
            }

            const dataHoraIso = new Date().toISOString();
            const dataHoraFormatada = new Date().toLocaleString('pt-BR');

            // Atualizar status do item para EM USO
            db.run(
                `UPDATE itens SET status='EM USO', colaborador_id=?, colaborador_mat=?, colaborador_nome=?, data_saida=?, operador_saida=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [colab.id, colab.matricula, colab.colaborador, dataHoraIso, opNome, item.id],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });

                    // Registrar movimentação permanente (Regra 7)
                    db.run(
                        `INSERT INTO movimentacoes (item_id, codigo_barras, item_nome, colaborador_id, colaborador_mat, colaborador_nome, tipo, data_hora, operador_nome, observacao)
                         VALUES (?, ?, ?, ?, ?, ?, 'SAÍDA', ?, ?, ?)`,
                        [item.id, item.codigo_barras, item.nome, colab.id, colab.matricula, colab.colaborador, dataHoraFormatada, opNome, observacao || 'Saída registrada'],
                        function(err) {
                            if (err) return res.status(500).json({ error: err.message });

                            // Retrocompatibilidade tabela movimentacoes
                            db.run(
                                `INSERT INTO movimentacoes (dt, tipo, mat, nome, itens, op) VALUES (?, 'SAÍDA', ?, ?, ?, ?)`,
                                [dataHoraFormatada, colab.matricula, colab.colaborador, JSON.stringify([item.nome]), opNome]
                            );

                            res.json({
                                success: true,
                                message: 'SAÍDA REGISTRADA COM SUCESSO',
                                item: {
                                    id: item.id,
                                    codigo_barras: item.codigo_barras,
                                    nome: item.nome,
                                    status: 'EM USO',
                                    colaborador_nome: colab.colaborador,
                                    colaborador_mat: colab.matricula,
                                    data_saida: dataHoraFormatada
                                }
                            });
                        }
                    );
                }
            );
        });
    });
});

// 2. REGISTRAR ENTRADA (DEVOLUÇÃO)
app.post('/api/movimentacoes/entrada', (req, res) => {
    const { codigo_barras, operador_nome, observacao } = req.body;
    const opNome = operador_nome || 'Operador Balcão';

    if (!codigo_barras) {
        return res.status(400).json({ error: 'Código de barras do material é obrigatório.' });
    }

    db.get("SELECT * FROM itens WHERE codigo_barras = ?", [codigo_barras], (err, item) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!item) {
            return res.status(404).json({ error: 'CÓDIGO DE BARRAS NÃO CADASTRADO NO SISTEMA' });
        }

        // Validação da regra 2: Para registrar ENTRADA, item precisa estar em uso
        if (item.status !== 'EM USO') {
            return res.status(400).json({
                error: `ITEM NÃO POSSUI SAÍDA EM ABERTO! O status atual do item é: '${item.status}'.`
            });
        }

        const dataHoraFormatada = new Date().toLocaleString('pt-BR');
        const colabId = item.colaborador_id;
        const colabMat = item.colaborador_mat || '';
        const colabNome = item.colaborador_nome || 'Não identificado';

        // Atualizar status do item para GUARDADO
        db.run(
            `UPDATE itens SET status='GUARDADO', colaborador_id=NULL, colaborador_mat=NULL, colaborador_nome=NULL, data_saida=NULL, operador_saida=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [item.id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });

                // Registrar movimentação permanente de ENTRADA (Regra 7)
                db.run(
                    `INSERT INTO movimentacoes (item_id, codigo_barras, item_nome, colaborador_id, colaborador_mat, colaborador_nome, tipo, data_hora, operador_nome, observacao)
                     VALUES (?, ?, ?, ?, ?, ?, 'ENTRADA', ?, ?, ?)`,
                    [item.id, item.codigo_barras, item.nome, colabId, colabMat, colabNome, dataHoraFormatada, opNome, observacao || 'Devolução registrada'],
                    function(err) {
                        if (err) return res.status(500).json({ error: err.message });

                        // Retrocompatibilidade
                        db.run(
                            `INSERT INTO movimentacoes (dt, tipo, mat, nome, itens, op) VALUES (?, 'ENTRADA', ?, ?, ?, ?)`,
                            [dataHoraFormatada, colabMat, colabNome, JSON.stringify([item.nome]), opNome]
                        );

                        res.json({
                            success: true,
                            message: 'ENTRADA REGISTRADA COM SUCESSO',
                            item: {
                                id: item.id,
                                codigo_barras: item.codigo_barras,
                                nome: item.nome,
                                status: 'GUARDADO',
                                ultimo_responsavel: colabNome
                            }
                        });
                    }
                );
            }
        );
    });
});

// GET MOVIMENTAÇÕES
app.get('/api/movimentacoes', (req, res) => {
    const { tipo, q, colaborador_id, limit } = req.query;

    let sql = "SELECT * FROM movimentacoes";
    let params = [];
    let conditions = [];

    if (tipo) {
        conditions.push("tipo = ?");
        params.push(tipo);
    }
    if (colaborador_id) {
        conditions.push("colaborador_id = ?");
        params.push(colaborador_id);
    }
    if (q) {
        conditions.push("(codigo_barras LIKE ? OR item_nome LIKE ? OR colaborador_nome LIKE ? OR colaborador_mat LIKE ? OR operador_nome LIKE ?)");
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY id DESC";

    if (limit) {
        sql += " LIMIT ?";
        params.push(Number(limit));
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// RESUMO / ESTATÍSTICAS
app.get('/api/relatorios/resumo', (req, res) => {
    db.get(
        `SELECT 
            COUNT(*) as total_itens,
            SUM(CASE WHEN status = 'GUARDADO' THEN 1 ELSE 0 END) as guardados,
            SUM(CASE WHEN status = 'EM USO' THEN 1 ELSE 0 END) as em_uso,
            SUM(CASE WHEN status = 'MANUTENÇÃO' THEN 1 ELSE 0 END) as manutencao
         FROM itens`,
        [],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row || { total_itens: 0, guardados: 0, em_uso: 0, manutencao: 0 });
        }
    );
});

// PERDAS (retrocompatibilidade)
app.get('/api/perdas', (req, res) => {
    db.all("SELECT * FROM perdas", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Fallback SPA index.html
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log("\n========================================");
    console.log("   MINEX PDV — SISTEMA DE ALMOXARIFADO  ");
    console.log("   Servidor Ativo: http://localhost:" + PORT);
    console.log("========================================\n");
});