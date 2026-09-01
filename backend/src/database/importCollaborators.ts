import path from 'path';
import ExcelJS from 'exceljs';
import { query, queryOne } from '../config/db';

interface ExcelCollaborator {
  sheetName: string;
  nfcId: string;
  empresa: string;
  matricula: string;
  nome: string;
  cargo: string;
}

export async function importCollaborators() {
  console.log('[IMPORT] Iniciando importação de colaboradores a partir do Excel...');

  const excelPath = path.resolve(__dirname, '../../../ATUALIZAÇÃO DAS TURMAS.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);

  const sheetsToProcess = ['TURMA A', 'TURMA B', 'TURMA C', 'TURMA D', 'ADM'];
  const allRows: ExcelCollaborator[] = [];

  for (const sheetName of sheetsToProcess) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      console.warn(`[IMPORT] Aba ${sheetName} não encontrada na planilha.`);
      continue;
    }

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const getVal = (colNumber: number): string => {
        const cell = row.getCell(colNumber);
        let v = cell.value;
        if (v !== null && typeof v === 'object' && 'result' in v && v.result !== undefined) {
          v = v.result;
        }
        return v !== null && v !== undefined ? String(v).trim() : '';
      };

      const nfcId = getVal(1);
      const empresa = getVal(2);
      const matricula = getVal(3);
      const nome = getVal(4);
      const cargo = getVal(5);

      if (!nome && !matricula && !nfcId) {
        continue; // Pular linhas vazias
      }

      allRows.push({
        sheetName: sheetName.trim(),
        nfcId,
        empresa,
        matricula,
        nome,
        cargo
      });
    }
  }

  console.log(`[IMPORT] Total de ${allRows.length} registros identificados na planilha.`);

  let insertedCount = 0;
  let updatedCount = 0;
  const processedMatriculas = new Map<string, string>(); // matricula -> nome

  for (const item of allRows) {
    let matriculaFinal = item.matricula;

    // Verificar se já processamos essa mesma matrícula nesta execução para OUTRA pessoa
    if (processedMatriculas.has(matriculaFinal)) {
      const prevNome = processedMatriculas.get(matriculaFinal);
      if (prevNome && prevNome.toUpperCase() !== item.nome.toUpperCase()) {
        matriculaFinal = `${item.matricula}-2`;
        console.log(`[IMPORT] Ajustada matrícula duplicada: "${item.nome}" (${item.matricula} -> ${matriculaFinal})`);
      }
    }
    processedMatriculas.set(matriculaFinal, item.nome);

    // Verificar se já existe no banco por matrícula ou por nfc_id
    const existingByMat = await queryOne('SELECT * FROM colaboradores WHERE matricula = ?', [matriculaFinal]);
    const existingByNfc = item.nfcId ? await queryOne('SELECT * FROM colaboradores WHERE nfc_id = ?', [item.nfcId]) : null;

    const existing = existingByMat || existingByNfc;

    if (existing) {
      // Atualizar cadastro existente
      await query(
        `UPDATE colaboradores 
         SET nome = ?, setor = ?, cargo = ?, nfc_id = ?, status = 'ATIVO', updated_at = (datetime('now', 'localtime'))
         WHERE id = ?`,
        [item.nome, item.sheetName, item.cargo, item.nfcId || null, existing.id]
      );
      updatedCount++;
    } else {
      // Inserir novo cadastro
      await query(
        `INSERT INTO colaboradores (nome, matricula, setor, cargo, nfc_id, status)
         VALUES (?, ?, ?, ?, ?, 'ATIVO')`,
        [item.nome, matriculaFinal, item.sheetName, item.cargo, item.nfcId || null]
      );
      insertedCount++;
    }
  }

  console.log(`[IMPORT] Importação concluída com sucesso!`);
  console.log(`[IMPORT] Novos colaboradores inseridos: ${insertedCount}`);
  console.log(`[IMPORT] Colaboradores atualizados: ${updatedCount}`);
  console.log(`[IMPORT] Total processado: ${insertedCount + updatedCount}`);
}

if (require.main === module) {
  importCollaborators()
    .then(() => {
      console.log('[IMPORT] Script concluído.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[IMPORT] Erro ao importar colaboradores:', err);
      process.exit(1);
    });
}
