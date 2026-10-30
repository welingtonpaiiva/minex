const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
process.env.DB_CLIENT='sqlite';process.env.SQLITE_PATH=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'minex-read-code128-')),'test.db');
delete process.env.MYSQL_HOST;delete process.env.INITIAL_ADMIN_PASSWORD;
const {runMigrations}=require('../dist/database/migrate');const {query,closeDatabase}=require('../dist/config/db');
const {MaterialService}=require('../dist/services/MaterialService');const {materialLabels,code128Graphic,barcodePrintTest}=require('../dist/services/MaterialLabels');
const {decodeLabelPdf}=require('./helpers/barcodePdf.cjs');
before(runMigrations);after(closeDatabase);
test('etiquetas vetoriais são decodificadas com conteúdo exato em 203 e 300 dpi',async()=>{
 const expected=new Map();for(const tag of ['LM-003','MG-001','RP-120','BR-150','ML-100','TL-050','TXT-001']){
  const barcode=tag==='TXT-001'?'000123450001':tag;await MaterialService.criar({nome:'Equipamento '+tag,codigo_interno:tag,codigo_barras:barcode});expected.set(tag,barcode);
 }
 const before=await query('SELECT * FROM materiais ORDER BY id'),pdf=await materialLabels({});assert.ok(!pdf.toString('latin1').includes('/Subtype /Image'));
 for(const dpi of [203,300]){const result=await decodeLabelPdf(pdf,{dpi});assert.equal(result.items.length,expected.size);for(const item of result.items)assert.equal(item.codigo,expected.get(item.tag));}
 assert.deepEqual(await query('SELECT * FROM materiais ORDER BY id'),before);
});
test('impressão mantém dimensões físicas e fornece folha A4 de teste',async()=>{
 const graphic=code128Graphic('LM-003');assert.equal(Math.round(graphic.width/72*25.4*10)/10,63.5);assert.ok(graphic.height/72*25.4>=18);
 const pdf=await barcodePrintTest();assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1);
});
