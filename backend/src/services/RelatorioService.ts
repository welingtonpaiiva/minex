import ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { query, queryOne } from '../config/db';

export class RelatorioService {
  static async obterResumo() {
    const totalMateriais = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM materiais');
    const disponiveis = await queryOne<{ total: number }>("SELECT COUNT(*) as total FROM materiais WHERE status = 'DISPONIVEL'");
    const emUso = await queryOne<{ total: number }>("SELECT COUNT(*) as total FROM materiais WHERE status = 'EM_USO'");
    const manutencao = await queryOne<{ total: number }>("SELECT COUNT(*) as total FROM materiais WHERE status = 'MANUTENCAO'");
    const totalColaboradores = await queryOne<{ total: number }>("SELECT COUNT(*) as total FROM colaboradores WHERE status = 'ATIVO'");

    return {
      totalMateriais: totalMateriais?.total || 0,
      disponiveis: disponiveis?.total || 0,
      emUso: emUso?.total || 0,
      manutencao: manutencao?.total || 0,
      totalColaboradoresAtivos: totalColaboradores?.total || 0
    };
  }

  static async gerarExcelMovimentacoes(filtros?: any): Promise<Buffer> {
    const movimentacoes = await query(`
      SELECT m.data_hora, m.tipo, m.material_codigo, m.material_nome, m.colaborador_nome, m.colaborador_matricula, m.operador_nome, m.observacao
      FROM movimentacoes m
      ORDER BY m.data_hora DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Movimentações');

    sheet.columns = [
      { header: 'Data/Hora', key: 'data_hora', width: 22 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Código Item', key: 'material_codigo', width: 15 },
      { header: 'Material', key: 'material_nome', width: 30 },
      { header: 'Colaborador', key: 'colaborador_nome', width: 30 },
      { header: 'Matrícula', key: 'colaborador_matricula', width: 15 },
      { header: 'Operador', key: 'operador_nome', width: 20 },
      { header: 'Observação', key: 'observacao', width: 35 }
    ];

    // Estilizar cabeçalho
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0F172A' }
    };

    movimentacoes.forEach((row: any) => {
      sheet.addRow(row);
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  static async gerarPdfMateriaisEmUso(): Promise<Buffer> {
    const emUso = await query(`
      SELECT e.data_hora_saida,
             col.nome as colaborador_nome, col.matricula as colaborador_matricula, col.setor, col.cargo,
             m.codigo_interno, m.nome as material_nome, c.nome as categoria_nome
      FROM emprestimos e
      JOIN colaboradores col ON e.colaborador_id = col.id
      JOIN materiais m ON e.material_id = m.id
      LEFT JOIN categorias c ON m.categoria_id = c.id
      ORDER BY e.data_hora_saida DESC
    `);

    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const printer = new PdfPrinter(fonts);

    const tableBody: any[] = [
      [
        { text: 'CÓDIGO', style: 'tableHeader' },
        { text: 'MATERIAL', style: 'tableHeader' },
        { text: 'COLABORADOR', style: 'tableHeader' },
        { text: 'MATRÍCULA', style: 'tableHeader' },
        { text: 'SETOR', style: 'tableHeader' },
        { text: 'DATA/HORA SAÍDA', style: 'tableHeader' }
      ]
    ];

    emUso.forEach((item: any) => {
      tableBody.push([
        item.codigo_interno,
        item.material_nome,
        item.colaborador_nome,
        item.colaborador_matricula,
        item.setor || '-',
        item.data_hora_saida
      ]);
    });

    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: 'CASA DA LANTERNA - RELATÓRIO DE MATERIAIS EM USO', style: 'header' },
        { text: `Gerado em: ${new Date().toLocaleString()}`, style: 'subheader' },
        { text: `Total de Materiais em Posse: ${emUso.length}`, margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['15%', '25%', '25%', '12%', '13%', '10%'],
            body: tableBody
          }
        }
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 5]
        },
        subheader: {
          fontSize: 10,
          italics: true,
          margin: [0, 0, 0, 15]
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          fillColor: '#0F172A',
          color: '#FFFFFF'
        }
      },
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 8
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err) => reject(err));
      pdfDoc.end();
    });
  }
}
