"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.code128Graphic = code128Graphic;
exports.barcodePrintTest = barcodePrintTest;
exports.materialLabels = materialLabels;
const pdfmake_1 = __importDefault(require("pdfmake"));
const bwip_js_1 = __importDefault(require("bwip-js"));
const db_1 = require("../config/db");
const OperationalService_1 = require("./OperationalService");
function code128Graphic(code, moduleMm = 0.508) {
    if (!/^[\x20-\x7e]{1,80}$/.test(code))
        throw new Error('Código incompatível com a etiqueta Code 128: ' + code);
    const modulePt = moduleMm * 72 / 25.4;
    const svg = bwip_js_1.default.toSVG({ bcid: 'code128', text: code, scale: 1, height: 18 / modulePt,
        includetext: false, paddingwidth: 12, backgroundcolor: 'FFFFFF', barcolor: '000000' });
    const bounds = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    if (!bounds)
        throw new Error('Não foi possível dimensionar o código de barras.');
    return { svg, width: Number(bounds[1]) * modulePt, height: Number(bounds[2]) * modulePt };
}
function createPdf(definition) {
    const printer = new pdfmake_1.default({ Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } });
    return new Promise((resolve, reject) => {
        const document = printer.createPdfKitDocument(definition), chunks = [];
        document.on('data', chunk => chunks.push(chunk));
        document.on('end', () => resolve(Buffer.concat(chunks)));
        document.on('error', reject);
        document.end();
    });
}
function barcodePrintTest() {
    const content = [
        { text: 'Teste de leitura — Code 128', fontSize: 19, bold: true, margin: [0, 0, 0, 12] },
        { text: 'Imprima em A4, tamanho real / 100%, em preto sobre papel branco. Desative ajustar à página e economia de tinta/toner.', margin: [0, 0, 0, 12] },
        { text: 'No sistema, abra Devolução e leia uma amostra. O campo deve mostrar LM-003 e consultar o item automaticamente. A leitura não confirma a devolução.', margin: [0, 0, 0, 20] }
    ];
    for (const moduleMm of [0.33, 0.508, 0.635]) {
        const graphic = code128Graphic('LM-003', moduleMm);
        content.push({ stack: [
                { text: `Amostra — módulo ${String(moduleMm).replace('.', ',')} mm`, fontSize: 11, margin: [0, 0, 0, 6] },
                { svg: graphic.svg, width: graphic.width },
                { text: 'LM-003', fontSize: 12, bold: true, margin: [0, 4, 0, 0] }
            ], margin: [0, 0, 0, 24] });
    }
    content.push({ text: 'Régua de conferência: esta linha deve medir 50 mm no papel.', fontSize: 10, margin: [0, 0, 0, 5] });
    content.push({ canvas: [
            { type: 'line', x1: 0, y1: 5, x2: 50 * 72 / 25.4, y2: 5, lineWidth: 1 },
            { type: 'line', x1: 0, y1: 0, x2: 0, y2: 10, lineWidth: 1 },
            { type: 'line', x1: 50 * 72 / 25.4, y1: 0, x2: 50 * 72 / 25.4, y2: 10, lineWidth: 1 }
        ] });
    return createPdf({ pageSize: 'A4', pageMargins: [35, 30, 35, 30], defaultStyle: { font: 'Helvetica', fontSize: 11 }, content });
}
async function materialLabels(data) {
    let items;
    if (Array.isArray(data.ids)) {
        if (!data.ids.length || data.ids.length > 1000)
            throw new Error('Selecione de 1 a 1000 equipamentos.');
        const ids = [...new Set(data.ids.map(OperationalService_1.id))];
        items = await (0, db_1.query)(`SELECT nome,codigo_interno,codigo_barras,patrimonio FROM materiais WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY codigo_interno`, ids);
        if (items.length !== ids.length)
            throw new Error('Um dos equipamentos não foi encontrado.');
    }
    else {
        let where = "WHERE m.tipo_controle='INDIVIDUAL' AND m.status <> 'INATIVO'";
        const params = [];
        if (data.busca) {
            where += ' AND (m.nome LIKE ? OR m.codigo_interno LIKE ? OR m.codigo_barras LIKE ? OR m.patrimonio LIKE ? OR col.nome LIKE ? OR col.matricula LIKE ?)';
            params.push(...Array(6).fill('%' + String(data.busca).slice(0, 255) + '%'));
        }
        if (data.categoria_id === 'sem-categoria')
            where += ' AND m.categoria_id IS NULL';
        else if (data.categoria_id) {
            where += ' AND m.categoria_id=?';
            params.push((0, OperationalService_1.id)(data.categoria_id));
        }
        items = await (0, db_1.query)(`SELECT m.nome,m.codigo_interno,m.codigo_barras,m.patrimonio FROM materiais m
      LEFT JOIN emprestimos e ON e.material_id=m.id LEFT JOIN colaboradores col ON col.id=e.colaborador_id
      ${where} ORDER BY m.codigo_interno LIMIT 1001`, params);
    }
    if (!items.length || items.length > 1000)
        throw new Error('Use os filtros para selecionar de 1 a 1000 equipamentos.');
    const graphics = items.map(item => code128Graphic(item.codigo_barras));
    const columns = graphics.some(graphic => graphic.width > 245) ? 1 : 2;
    if (graphics.some(graphic => graphic.width > 530))
        throw new Error('Código muito longo para impressão legível em A4. Use uma etiqueta maior.');
    const labels = items.map((item, index) => ({ stack: [
            { text: item.nome, fontSize: 10, bold: true },
            { text: 'TAG: ' + item.codigo_interno + ' · ' + (item.patrimonio || ''), fontSize: 8, margin: [0, 3, 0, 3] },
            { svg: graphics[index].svg, width: graphics[index].width },
            { text: item.codigo_barras, fontSize: 11, bold: true, margin: [0, 3, 0, 0] }
        ], margin: [4, 5, 4, 5], alignment: 'center' }));
    const content = [], perPage = columns * 7;
    for (let start = 0; start < labels.length; start += perPage) {
        const page = labels.slice(start, start + perPage), rows = [];
        for (let row = 0; row < page.length; row += columns)
            rows.push(Array.from({ length: columns }, (_, col) => page[row + col] || ''));
        content.push({ table: { widths: Array(columns).fill('*'), heights: 103, dontBreakRows: true, body: rows },
            layout: 'noBorders', ...(start ? { pageBreak: 'before' } : {}) });
    }
    return createPdf({ pageSize: 'A4', pageMargins: [20, 20, 20, 24], defaultStyle: { font: 'Helvetica' }, content,
        footer: { text: 'A4 · Tamanho real / 100% · Não ajustar à página · Imprimir em preto e branco', alignment: 'center', fontSize: 8, margin: [0, 5, 0, 0] },
        info: { title: 'Etiquetas vetoriais — Casa da Lanterna' } });
}
