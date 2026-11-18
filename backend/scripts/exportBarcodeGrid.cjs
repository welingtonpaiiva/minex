// Exporta etiquetas do cadastro local sem alterar o banco.
// Uso: node backend/scripts/exportBarcodeGrid.cjs [diretorio-de-saida]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const PdfPrinter = require('pdfmake');
const bwipjs = require('bwip-js');
const JSZip = require('jszip');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.argv[2] || path.join(root, 'exports/etiquetas-2026-11-18-5x10-4x9'));
const mm = value => value * 72 / 25.4;
const groups = [
  ['LM-', '01-lanternas-de-mineiro', 'Lanternas de Mineiro'],
  ['BR-', '02-baterias-de-radio', 'Baterias de Rádio'],
  ['RP-', '03-radios', 'Rádios'],
  ['ML-', '04-mega-light', 'Mega Light'],
  ['MG-', '05-medidores-de-gas', 'Medidores de Gás'],
  ['TL-', '06-sinalizadores', 'Sinalizadores'],
  ['MF-', '07-mascaras-de-fuga', 'Máscaras de Fuga']
];

function graphic(code, columns) {
  assert.match(code, /^[\x20-\x7e]{1,80}$/);
  const moduleMm = columns === 5 ? 0.28 : 0.33;
  const heightMm = columns === 5 ? 11 : 14;
  const svg = bwipjs.toSVG({ bcid: 'code128', text: code, scale: 1,
    height: heightMm / mm(moduleMm), includetext: false, paddingwidth: 12,
    backgroundcolor: 'FFFFFF', barcolor: '000000' });
  const bounds = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  assert.ok(bounds);
  return { svg, width: Number(bounds[1]) * mm(moduleMm), height: Number(bounds[2]) * mm(moduleMm) };
}

function createPdf(pages, title) {
  const content = [];
  const labelText = (text, fontSize, bold, x, y, width) => ({
    columns: [{ text, fontSize, bold, alignment: 'center', width: mm(width) }],
    absolutePosition: { x: mm(x), y: mm(y) }
  });
  for (const [index, page] of pages.entries()) {
    const { columns, rows, items, category } = page;
    const cellWidth = 190 / columns, cellHeight = 270 / rows;
    content.push({ text: category + '  |  ' + columns + ' colunas x ' + rows + ' linhas',
      fontSize: 7, color: '#444444', absolutePosition: { x: mm(10), y: mm(4) },
      ...(index ? { pageBreak: 'before' } : {}) });
    const lines = [];
    for (let col = 0; col <= columns; col++) lines.push({ type: 'line', x1: mm(10 + col * cellWidth), y1: mm(10), x2: mm(10 + col * cellWidth), y2: mm(280), lineWidth: 0.25, lineColor: '#bbbbbb' });
    for (let row = 0; row <= rows; row++) lines.push({ type: 'line', x1: mm(10), y1: mm(10 + row * cellHeight), x2: mm(200), y2: mm(10 + row * cellHeight), lineWidth: 0.25, lineColor: '#bbbbbb' });
    content.push({ canvas: lines, absolutePosition: { x: 0, y: 0 } });
    for (const [slot, item] of items.entries()) {
      const x = 10 + (slot % columns) * cellWidth, y = 10 + Math.floor(slot / columns) * cellHeight;
      const bars = graphic(item.codigo_barras, columns);
      assert.ok(bars.width <= mm(cellWidth - 2), 'Código maior que a célula: ' + item.codigo_interno);
      content.push(
        labelText(item.nome, columns === 5 ? 7 : 8, true, x + 1, y + 5.3, cellWidth - 2),
        { svg: bars.svg, width: bars.width, absolutePosition: { x: mm(x + cellWidth / 2) - bars.width / 2, y: mm(y + 9) } },
        labelText(item.codigo_barras, 9, true, x + 1, y + (columns === 5 ? 21.5 : 24.5), cellWidth - 2)
      );
    }
    content.push({ text: 'A4 | Tamanho real / 100% | Não ajustar à página | ' + (index + 1) + '/' + pages.length,
      fontSize: 7, alignment: 'center', absolutePosition: { x: 0, y: mm(286) } });
  }
  const printer = new PdfPrinter({ Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold' } });
  const document = printer.createPdfKitDocument({ pageSize: 'A4', pageMargins: [0, 0, 0, 0],
    defaultStyle: { font: 'Helvetica' }, content,
    info: { title, author: 'Casa da Lanterna - Minex', subject: 'Etiquetas vetoriais Code 128' }
  });
  return new Promise((resolve, reject) => {
    const chunks = []; document.on('data', chunk => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks))); document.on('error', reject); document.end();
  });
}

async function validate(bytes, pages, preview) {
  const canvas = require('@napi-rs/canvas'), zxing = require('@zxing/library');
  const { pathToFileURL } = require('node:url');
  Object.assign(global, { DOMMatrix: canvas.DOMMatrix, ImageData: canvas.ImageData, Path2D: canvas.Path2D });
  const pdfjs = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
  const results = [];
  for (const dpi of [203, 300]) {
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    const document = await task.promise;
    try {
      assert.equal(document.numPages, pages.length, 'Quantidade de páginas incorreta');
      let decoded = 0;
      for (const [index, spec] of pages.entries()) {
        const page = await document.getPage(index + 1), scale = dpi / 72;
        const viewport = page.getViewport({ scale });
        const target = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = target.getContext('2d');
        await page.render({ canvas: target, canvasContext: context, viewport }).promise;
        if (!index && dpi === 203 && preview) fs.writeFileSync(preview, target.toBuffer('image/png'));
        const text = (await page.getTextContent()).items;
        assert.ok(!text.some(item => /^TAG: /.test(item.str)), 'A linha TAG deve estar ausente');
        const codes = new Set(spec.items.map(item => item.codigo_barras));
        const tags = text.filter(item => codes.has(item.str));
        assert.deepEqual(tags.map(item => item.str), spec.items.map(item => item.codigo_barras));
        assert.equal(new Set(tags.map(item => Math.round(item.transform[4] * 100))).size, Math.min(spec.columns, spec.items.length));
        const cw = 190 / spec.columns, ch = 270 / spec.rows;
        for (const [slot, item] of spec.items.entries()) {
          const x = 10 + slot % spec.columns * cw, y = 10 + Math.floor(slot / spec.columns) * ch;
          const left = Math.floor(mm(x + 0.5) * scale), top = Math.floor(mm(y + 8) * scale);
          const width = Math.floor(mm(cw - 1) * scale), height = Math.floor(mm(spec.columns === 5 ? 13 : 16) * scale);
          const pixels = context.getImageData(left, top, width, height).data;
          const gray = new Uint8ClampedArray(width * height);
          for (let n = 0; n < gray.length; n++) gray[n] = (pixels[n * 4] + 2 * pixels[n * 4 + 1] + pixels[n * 4 + 2]) / 4;
          const hints = new Map([[zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.CODE_128]], [zxing.DecodeHintType.TRY_HARDER, true]]);
          try {
            const reader = new zxing.MultiFormatReader();
            const result = reader.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(gray, width, height))), hints);
            assert.equal(result.getText(), item.codigo_barras);
          } catch (error) { throw new Error(item.codigo_interno + ', página ' + (index + 1) + ', ' + dpi + ' dpi: ' + error.message); }
          decoded++;
        }
        page.cleanup(); target.width = 1; target.height = 1;
      }
      results.push({ dpi, decodificados: decoded, resultado: 'OK' });
    } finally { await task.destroy(); }
  }
  return results;
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(path.join(root, 'minex.db'), sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(connection));
  });
  let items;
  try {
    items = await new Promise((resolve, reject) => db.all("SELECT id,nome,codigo_interno,codigo_barras FROM materiais WHERE tipo_controle='INDIVIDUAL' AND status <> 'INATIVO' ORDER BY codigo_interno", (error, rows) => error ? reject(error) : resolve(rows)));
  } finally { await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())); }
  assert.ok(items.length);
  assert.equal(new Set(items.map(item => item.codigo_barras)).size, items.length, 'Código duplicado');
  assert.ok(items.every(item => groups.some(([prefix]) => item.codigo_interno.startsWith(prefix))), 'Categoria não prevista');
  const report = { total: items.length, origem: 'Cadastro SQLite local aberto somente para leitura; equipamentos individuais ativos', arquivos: [] };
  const zip = new JSZip(), allPages = [];
  for (const [prefix, stem, category] of groups) {
    const selected = items.filter(item => item.codigo_interno.startsWith(prefix));
    if (!selected.length) continue;
    const columns = prefix === 'MF-' ? 4 : 5, rows = prefix === 'MF-' ? 9 : 10;
    const filename = stem + '-A4-' + columns + 'x' + rows + '.pdf', pages = [];
    for (let n = 0; n < selected.length; n += columns * rows) pages.push({ columns, rows, category, items: selected.slice(n, n + columns * rows) });
    const bytes = await createPdf(pages, category + ' - ' + columns + 'x' + rows);
    fs.writeFileSync(path.join(output, filename), bytes);
    console.log('Gerado: ' + filename + ' | ' + selected.length + ' etiquetas | ' + pages.length + ' páginas. Validando leitura...');
    const readings = await validate(bytes, pages, path.join(output, stem + '-previa.png'));
    report.arquivos.push({ arquivo: filename, categoria: category, etiquetas: selected.length, paginas: pages.length,
      colunas: columns, linhas: rows, celula_mm: { largura: 190 / columns, altura: 270 / rows },
      leituras: readings, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      codigos: selected.map(item => ({ tag: item.codigo_interno, codigo_barras: item.codigo_barras })) });
    zip.file(filename, bytes); allPages.push(...pages);
    console.log('OK: ' + filename + ' | todos os códigos conferidos em 203 e 300 dpi.');
  }
  assert.equal(report.arquivos.reduce((total, file) => total + file.etiquetas, 0), items.length);
  const combined = 'todos-os-codigos-A4-5x10-mascaras-4x9.pdf';
  fs.writeFileSync(path.join(output, combined), await createPdf(allPages, 'Todos os códigos de barras - 5x10 e máscaras 4x9'));
  report.pdf_completo = { arquivo: combined, paginas: allPages.length, etiquetas: items.length };
  const readme = ['ETIQUETAS MINEX — A4', '', items.length + ' equipamentos ativos; um PDF por categoria.',
    'Demais categorias: 5 colunas x 10 linhas (50 etiquetas por página), células de 38 x 27 mm.',
    'Máscaras de fuga: 4 colunas x 9 linhas (36 etiquetas por página), células de 47,5 x 30 mm.',
    'Margens laterais e superior de 10 mm. Guias de corte em cinza.',
    'Cada etiqueta contém o nome do item, o código de barras e o código abaixo das barras, sem a linha TAG.',
    'Imprima em A4, tamanho real / 100%, sem ajustar à página.',
    'Todos os códigos dos PDFs separados foram decodificados e conferidos com o cadastro em 203 e 300 dpi.', '',
    ...report.arquivos.map(file => file.categoria + ': ' + file.etiquetas + ' etiquetas, ' + file.paginas + ' páginas.')].join('\r\n');
  fs.writeFileSync(path.join(output, 'LEIA-ME.txt'), readme + '\r\n');
  fs.writeFileSync(path.join(output, 'validacao.json'), JSON.stringify(report, null, 2) + '\n');
  zip.file('LEIA-ME.txt', readme + '\r\n');
  fs.writeFileSync(path.join(output, 'codigos-de-barras-5x10-mascaras-4x9.zip'), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(JSON.stringify({ output, total: items.length, pdfs: report.arquivos.length, paginas: allPages.length, resultado: 'OK' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
