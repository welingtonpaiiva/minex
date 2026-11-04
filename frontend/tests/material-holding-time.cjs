const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../src/utils/materialHoldingTime.ts'),'utf8');const model={exports:{}};
new Function('exports','module',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(model.exports,model);
const {materialHoldingTime}=model.exports;const withdrawal='2026-11-04T00:00:00.000Z',start=Date.parse(withdrawal);
test('destaque começa somente após oito horas completas',()=>{
  assert.equal(materialHoldingTime(withdrawal,start+8*3600000).overdue,false);
  assert.equal(materialHoldingTime(withdrawal,start+8*3600000+999).overdue,false);
  assert.equal(materialHoldingTime(withdrawal,start+8*3600000+1000).overdue,true);
  assert.equal(materialHoldingTime(withdrawal,start+8*3600000+1000).label,'08h 00m 01s');
});
test('horas totais não reiniciam após 24 horas e horário inválido exige conferência',()=>{
  assert.equal(materialHoldingTime(withdrawal,start+49*3600000).label,'49h 00m 00s');
  for(const value of [null,'inválido',new Date(start+10000).toISOString()]){const state=materialHoldingTime(value,start);assert.equal(state.seconds,null);assert.equal(state.overdue,false);}
});
