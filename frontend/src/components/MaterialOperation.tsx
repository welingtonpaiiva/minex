import { useState, useRef } from 'react';
import { Search, ScanLine, ArrowRight, CheckCircle2, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { NfcReaderModal } from './NfcReaderModal';
import { ReturnNfcConfirmation } from './ReturnNfcConfirmation';
import { ReturnReadings, emptyReturnReadings, hasReturnReadings } from './ReturnReadings';
import { ReturnCondition, returnConditionMessage } from './ReturnCondition';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useScanInputRecovery } from '../hooks/useScanInputRecovery';
import { soundFX } from '../services/soundFX';
import { api } from '../services/api';
import { useResource, notifyChange } from '../hooks/useResource';
import { MaterialIdentity, Page, Notice, Person, Badge, Empty, Modal, errorMessage, dateTime } from './ui';
export function MaterialOperation({ type }: { type: 'saida'|'entrada' }) {
  const withdrawing=type==='saida';
  const [nfc,setNfc]=useState(true);
  const [confirmingNfc,setConfirmingNfc]=useState(false);
  const [person,setPerson]=useState<any>(null),[code,setCode]=useState(''),[materialCode,setMaterialCode]=useState(''),[items,setItems]=useState<any[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState<any>(null),[condition,setCondition]=useState('APTO'),[choose,setChoose]=useState(false),[materialSearch,setMaterialSearch]=useState('');
  const [readings,setReadings]=useState(emptyReturnReadings);
  const pending=useRef(false),key=useRef(crypto.randomUUID()),scanner=useRef<HTMLInputElement>(null);
  const recoverScanner=useScanInputRecovery(scanner,()=>setMaterialCode(''),busy);
  const people=useResource<any>('/operacao/conformidade',{busca:code,limit:5},{items:[],total:0},0);
  const available=useResource<any>('/estoque',{busca:materialSearch,status:'DISPONIVEL',limit:20},{items:[],total:0},0);
  function changed(){key.current=crypto.randomUUID();}
  async function identify(target?:any,fromNfc=false,nfcId=''){
    if(pending.current)return;pending.current=true;setBusy(true);setMessage('');
    try{
      const p=target||(await api.get('/colaboradores/nfc/'+encodeURIComponent(code.trim()))).data;
      if(withdrawing&&p.status!=='ATIVO')throw new Error('Colaborador inativo. Retirada bloqueada.');
      const compliance=await api.get('/operacao/conformidade/'+p.id);
      let loans:any[]=[];
      if(!withdrawing)loans=(await api.get('/emprestimos/colaborador/'+p.id)).data;
      setNfc(false);soundFX.playSuccess();setItems(loans.map(i=>({...i,selected:false,nome:i.material_nome})));setPerson({...p,conformidade:compliance.data.situacao});setReadings({nfcId});changed();
      setTimeout(()=>scanner.current?.focus(),50);
    }catch(e:any){setMessage(e.response?errorMessage(e):e.message);soundFX.playError();if(fromNfc)throw e;}finally{pending.current=false;setBusy(false);}
  }
  function add(item:any){
    if(items.some(i=>i.material_id===item.id||i.id===item.id)){setMessage('Este material já está na lista.');recoverScanner();return;}
    soundFX.playScan();setItems(old=>[...old,{...item,selected:true}]);setMessage('');setMaterialCode('');changed();scanner.current?.focus();
  }
  async function scan(e:React.FormEvent){e.preventDefault();await lookupMaterial(materialCode);}
  async function lookupMaterial(code:string){if(!code.trim()||pending.current)return;setMessage('');
    pending.current=true;setBusy(true);try{const res=await api.get('/materiais/codigo/'+encodeURIComponent(code.trim()));if(res.data.status!=='DISPONIVEL')throw new Error('Material indisponível: '+res.data.status.replaceAll('_',' '));add(res.data);}catch(e:any){setMessage(e.response?errorMessage(e):e.message);recoverScanner();}finally{pending.current=false;setBusy(false);}
  }
  useBarcodeScanner({inputRef:scanner,enabled:withdrawing&&!!person&&!busy&&!success,onRead:code=>{setMaterialCode(code);void lookupMaterial(code);}});
  const selected=items.filter(i=>i.selected);
  const scanItems=items.map(i=>({...i,material_id:i.material_id||i.id,material_nome:i.nome}));
  const returnReady=hasReturnReadings(readings,scanItems.filter(i=>i.selected));
  async function submit(nfcId?:string){
    if(!person||!selected.length||pending.current||(!withdrawing&&!returnReady))return;
    if(!withdrawing&&!nfcId){setConfirmingNfc(true);return;}
    pending.current=true;setBusy(true);setMessage('');
    try{const result=await api.post('/emprestimos/'+type,{colaboradorId:person.id,materiaisCodigos:selected.map(i=>i.codigo_interno),condicao:condition,nfcId:nfcId||readings.nfcId},{headers:{'Idempotency-Key':key.current}});setConfirmingNfc(false);setSuccess(result.data);soundFX.playSuccess();notifyChange();}
    catch(e){setMessage(errorMessage(e));if(withdrawing)recoverScanner();soundFX.playError();if(!withdrawing)throw e;}finally{pending.current=false;setBusy(false);}
  }
  function reset(){setNfc(true);setPerson(null);setItems([]);setSuccess(null);setCode('');setMessage('');setMaterialCode('');setCondition('APTO');setReadings(emptyReturnReadings());changed();}
  return <Page title={withdrawing?'Retirar material':'Devolver material'} description={withdrawing?'Identifique o colaborador, selecione os itens e confirme a retirada.':'Identifique o colaborador e confira os materiais que retornaram.'}>
    <ReturnNfcConfirmation isOpen={confirmingNfc} person={person} onClose={()=>{if(!pending.current)setConfirmingNfc(false);}} onConfirm={submit}/>
    <NfcReaderModal isOpen={nfc} onClose={()=>setNfc(false)} requireActive={withdrawing} nfcOnly={!withdrawing} onNfcRead={async(nfcId,person)=>{if(person)await identify(person,true,nfcId);}} title={withdrawing?'SAÍDA — APROXIME O CRACHÁ':'ENTRADA — APROXIME O CRACHÁ'} subtitle="Aproxime o crachá NFC do colaborador para iniciar o atendimento"/>
    <div className="step-line"><span className={!person?'current':''}><b>1</b>Identificar</span><ArrowRight size={14}/><span className={person&&!success?'current':''}><b>2</b>Conferir materiais</span><ArrowRight size={14}/><span className={success?'current':''}><b>3</b>Concluir</span></div><Notice message={message}/>
    {success?<section className="panel success-state"><CheckCircle2 size={60}/><h2>{withdrawing?'Retirada registrada':'Devolução registrada'}</h2><p>{success.materiaisCount} material(is) · {success.colaborador.nome}</p>{!withdrawing&&<Notice message={returnConditionMessage(condition)} type="success"/>}<button className="button primary" onClick={reset}>Próximo atendimento<ArrowRight size={18}/></button></section>
    :!person?<section className="panel operation-identify"><button className="button primary nfc-start" onClick={()=>setNfc(true)}><ScanLine size={24}/>Aproximar crachá NFC</button><div><h2>Quem é o colaborador?</h2><p>Leia o cartão NFC ou pesquise pelo nome ou matrícula.</p></div><form className="inline-form" onSubmit={e=>{e.preventDefault();void identify();}}><input aria-label="Nome, matrícula ou NFC" autoFocus placeholder="Nome, matrícula ou cartão NFC" value={code} onChange={e=>setCode(e.target.value)} maxLength={255} required/><button className="button primary" disabled={busy}><Search size={18}/>{busy?'Consultando…':'Identificar'}</button></form>{code.length>=2&&<div className="compact-list">{people.data.items.map((p:any)=><button key={p.id} className="compact-row" style={{width:'100%',textAlign:'left'}} disabled={busy} onClick={()=>void identify(p)}><Person person={p}/><ArrowRight size={18}/></button>)}</div>}<Notice message={people.error}/></section>
    :<><section className="panel selected-person"><Person person={person}/><button className="button secondary" disabled={busy} onClick={reset}>Trocar colaborador</button></section><div className="operation-layout"><section className="panel"><div className="panel-heading"><div><h2>{withdrawing?'Materiais para retirada':'Materiais sob responsabilidade'}</h2><p>{withdrawing?'Leia o código de barras, digite a TAG ou selecione um item disponível.':'Selecione somente os itens recebidos fisicamente.'}</p></div>{withdrawing&&<button className="button secondary" onClick={()=>setChoose(true)}>Selecionar item</button>}</div><div className="panel-content">{withdrawing?<form className="inline-form" onSubmit={scan}><input ref={scanner} value={materialCode} aria-label="Código do material" onChange={e=>setMaterialCode(e.target.value)} placeholder="TAG ou código de barras" maxLength={255}/><button className="button primary" disabled={busy||!materialCode.trim()}><ScanLine size={18}/>Adicionar</button></form>:<ReturnReadings person={person} items={scanItems} requiredItems={scanItems.filter(i=>i.selected)} value={readings} disabled={busy} onChange={value=>{setReadings(value);changed();}} onBarcodeRead={materialId=>{setItems(old=>old.map(i=>i.material_id===materialId?{...i,selected:true}:i));changed();}}/>}</div><div className="table-wrap"><table className="data-table"><thead><tr>{!withdrawing&&<th>Recebido</th>}<th>Material</th><th>{withdrawing?'Situação':'Retirada'}</th>{withdrawing&&<th>Ação</th>}</tr></thead><tbody>{items.map((item:any,index:number)=><tr key={item.codigo_interno} className={!withdrawing?'return-check '+(item.selected?'selected':''):''}>{!withdrawing&&<td><input aria-label={'Receber '+item.nome} type="checkbox" disabled={busy} checked={item.selected} onChange={()=>{setItems(old=>old.map((i,j)=>j===index?{...i,selected:!i.selected}:i));changed();}}/></td>}<td><MaterialIdentity code={item.codigo_interno} name={item.nome} photo={item.foto_url}/></td><td>{withdrawing?<Badge value={item.status}/>:dateTime(item.data_hora_saida)}</td>{withdrawing&&<td><button className="button secondary" disabled={busy} aria-label={'Remover '+item.nome} onClick={()=>{setItems(old=>old.filter((_,j)=>j!==index));changed();}}><Trash2 size={16}/>Remover</button></td>}</tr>)}</tbody></table></div>{!items.length&&<Empty>{withdrawing?'Nenhum material selecionado.':'Este colaborador não possui materiais em operação.'}</Empty>}</section>
    <aside className="panel summary-panel"><h2>Conferir atendimento</h2><div className="summary-count">Materiais selecionados<strong>{selected.length}</strong></div>{!withdrawing&&<ReturnCondition value={condition} disabled={busy} onChange={value=>{setCondition(value);changed();}}/>}<p className="summary-note">{withdrawing?'A disponibilidade será atualizada após a confirmação do servidor.':'Para condições diferentes, registre as devoluções em grupos separados.'}</p><button className="button primary full" data-tone={withdrawing?undefined:"success"} disabled={busy||!selected.length||(!withdrawing&&!returnReady)} onClick={()=>void submit()}>{withdrawing?<ArrowUpRight size={20}/>:<ArrowDownLeft size={20}/>} {busy?'Registrando…':withdrawing?'Confirmar retirada':'Confirmar devolução'}</button></aside></div></>}
    {choose&&<Modal title="Selecionar material disponível" onClose={()=>setChoose(false)}><input aria-label="Pesquisar material disponível" placeholder="Nome ou código" value={materialSearch} onChange={e=>setMaterialSearch(e.target.value)}/><Notice message={available.error}/><div className="compact-list">{available.data.items.map((m:any)=><button key={m.id} className="compact-row" style={{width:'100%',textAlign:'left'}} disabled={items.some(i=>i.id===m.id)} onClick={()=>{add(m);setChoose(false);}}><div><MaterialIdentity code={m.codigo_interno} name={m.nome} photo={m.foto_url}/><span>{m.categoria_nome||'Sem categoria'}</span></div><span className="text-link">Selecionar</span></button>)}</div>{!available.data.items.length&&<Empty>Nenhum material disponível para esta pesquisa.</Empty>}<p className="summary-note">{available.data.total>20?'Mostrando 20 resultados. Refine a pesquisa para localizar o material.':''}</p></Modal>}
  </Page>;
}
