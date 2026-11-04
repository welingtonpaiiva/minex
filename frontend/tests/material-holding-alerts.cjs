const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.MINEX_BROWSER_BASE||'http://localhost:3000';
let browser;
(async()=>{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('casa_da_lanterna_token','holding-visual-fixture'));
  const started=Date.now();let returned=false,alertRequests=0;
  const people=[{id:1,nome:'Colaborador com atraso',matricula:'AL-001',hours:49},{id:2,nome:'Colaborador no limite',matricula:'AL-002',hours:8-2/3600},{id:3,nome:'Colaborador recente',matricula:'AL-003',hours:2}]
    .map(person=>({...person,status:'ATIVO',setor:'Testes',foto_url:'',primeira_retirada:new Date(started-person.hours*3600000).toISOString(),total_itens:1,total_unidades:1,
      materiais:[{emprestimo_id:person.id,colaborador_id:person.id,material_id:person.id,tipo:'INDIVIDUAL',material_nome:'Equipamento de teste',codigo_interno:'MF-00'+person.id,retirada:new Date(started-person.hours*3600000).toISOString(),quantidade:1}]}));
  await page.route('**/api/**',route=>{
    const p=new URL(route.request().url()).pathname;let data;
    const current=people.filter(person=>!returned||person.id!==1);
    if(p==='/api/auth/me')data={user:{id:1,nome:'Operador',nivel_acesso:'OPERADOR'}};
    else if(p==='/api/emprestimos/alertas-posse'){alertRequests++;data={horario_servidor:new Date().toISOString(),colaboradores:current};}
    else if(p==='/api/emprestimos/pendencias')data={horario_servidor:new Date().toISOString(),items:current,total:current.length,resumo:{pessoas:current.length,itens:current.length,unidades:current.length}};
    else if(p==='/api/operacao/acessos')data={quantidade:0,colaboradores:[]};
    else data={};
    return route.fulfill({json:data});
  });
  await page.goto(base+'/entrada');await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
  const overdue=page.getByRole('article',{name:'Materiais de Colaborador com atraso',exact:true});
  await expect(overdue).toHaveClass(/is-overdue/);
  await expect(overdue.getByLabel('Tempo com materiais de Colaborador com atraso',{exact:true})).toContainText('49h');
  assert.equal(await overdue.evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(198, 40, 40)');
  await expect(page.getByRole('article',{name:'Materiais de Colaborador recente',exact:true})).not.toHaveClass(/is-overdue/);
  await expect(page.getByRole('article',{name:'Alerta de materiais de Colaborador com atraso',exact:true})).toBeVisible();
  const counter=alertRequests;await page.waitForTimeout(1200);assert.equal(alertRequests,counter,'O contador não consulta a API por segundo');
  await expect(page.getByRole('article',{name:'Materiais de Colaborador no limite',exact:true})).toHaveClass(/is-overdue/,{timeout:8000});
  await expect(page.getByRole('article',{name:'Alerta de materiais de Colaborador no limite',exact:true})).toBeVisible({timeout:8000});
  fs.mkdirSync(path.resolve(__dirname,'../../test-results'),{recursive:true});
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:path.resolve(__dirname,'../../test-results/alerta-posse-'+width+'.png'),fullPage:true});
  }
  returned=true;await page.evaluate(()=>window.dispatchEvent(new Event('operacao-atualizada')));
  await expect(overdue).toHaveCount(0);await expect(page.getByRole('article',{name:'Alerta de materiais de Colaborador com atraso',exact:true})).toHaveCount(0);
  assert.deepEqual(errors,[]);console.log('Navegador: alerta vermelho, 49h acumuladas, passagem automática de 8h, remoção após devolução, desktop/celular e ausência de consultas por segundo aprovados.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
