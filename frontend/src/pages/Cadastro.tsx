import { useState, useRef } from 'react';
import { Plus, Pencil, Users, Boxes, Search } from 'lucide-react';
import { Usuario } from '../types';
import { api } from '../services/api';
import { useResource, notifyChange } from '../hooks/useResource';
import { Page, Notice, Person, Badge, Empty, Pager, Modal, canRegister, errorMessage } from '../components/ui';
import { PhotoCapture } from '../components/PhotoCapture';
import { NfcReaderModal } from '../components/NfcReaderModal';
export function Cadastro({user}:{user:Usuario|null}){
  const [tab,setTab]=useState('colaboradores'),[search,setSearch]=useState(''),[page,setPage]=useState(1),[form,setForm]=useState<any>(null),[message,setMessage]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[photo,setPhoto]=useState(''),[nfc,setNfc]=useState(false);
  const pending=useRef(false),editable=!!user&&canRegister(user.nivel_acesso);
  const collaborators=useResource<any>('/operacao/conformidade',{busca:search,page},{items:[],total:0});
  const stock=useResource<any>('/estoque',{busca:search,page},{items:[],total:0});
  const categories=useResource<any[]>('/materiais/categorias',{},[]);
  const list=tab==='colaboradores'?collaborators:stock;
  function open(value:any){setMessage('');setSuccess('');setPhoto('');setForm({...value});}
  async function save(e:React.FormEvent){
    e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setMessage('');setSuccess('');
    try{
      const payload={...form};delete payload.conformidade;delete payload.foto_url;
      let result;
      if(form.id)result=await api.put('/'+tab+'/'+form.id,payload);
      else {result=await api.post('/'+tab,payload);setForm({...form,id:result.data.id});}
      if(photo&&tab==='colaboradores'){
        try{await api.post('/fotos/'+result.data.id,{imagem:photo});}
        catch(e){setForm({...form,id:result.data.id});setMessage('Cadastro salvo, mas a foto não foi enviada. '+errorMessage(e));notifyChange();return;}
      }
      setForm(null);setPhoto('');setSuccess('Cadastro salvo com sucesso.');notifyChange();
    }catch(e){setMessage(errorMessage(e));}finally{pending.current=false;setBusy(false);}
  }
  return <Page title="Cadastros" description="Mantenha pessoas e equipamentos identificados e atualizados." action={editable?<button className="button primary" onClick={()=>open(tab==='colaboradores'?{nome:'',matricula:'',setor:'',cargo:'',nfc_id:'',status:'ATIVO'}:{nome:'',codigo_interno:'',codigo_barras:'',categoria_id:'',patrimonio:'',observacao:''})}><Plus size={18}/>{tab==='colaboradores'?'Novo colaborador':'Novo material'}</button>:undefined}>
    <Notice message={message||list.error||categories.error}/><Notice message={success} type="success"/>
    <div className="filters"><div className="tabs"><button className={'tab '+(tab==='colaboradores'?'active':'')} onClick={()=>{setTab('colaboradores');setPage(1);setSearch('');}}><Users size={17} style={{display:'inline',marginRight:8}}/>Colaboradores</button><button className={'tab '+(tab==='materiais'?'active':'')} onClick={()=>{setTab('materiais');setPage(1);setSearch('');}}><Boxes size={17} style={{display:'inline',marginRight:8}}/>Materiais</button></div><div className="search-field search"><Search/><input aria-label="Pesquisar cadastros" placeholder={tab==='colaboradores'?'Nome ou matrícula':'Nome, código ou responsável'} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div></div>
    <section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>{tab==='colaboradores'?'Colaborador':'Material'}</th><th>{tab==='colaboradores'?'Cargo / setor':'Categoria / patrimônio'}</th><th>Situação</th>{editable&&<th>Ação</th>}</tr></thead><tbody>{list.data.items.map((item:any)=><tr key={item.id}><td>{tab==='colaboradores'?<Person person={item}/>:<><strong>{item.nome}</strong><small>{item.codigo_interno} · Código de barras: {item.codigo_barras}</small></>}</td><td>{tab==='colaboradores'?<>{item.cargo||'—'}<small>{item.setor||'Setor não informado'} · NFC: {item.nfc_id||'Não vinculado'}</small></>:<>{item.categoria_nome||'Sem categoria'}<small>{item.patrimonio||'Sem patrimônio'}</small></>}</td><td><Badge value={item.status}/></td>{editable&&<td><button className="button secondary" onClick={()=>open(item)}><Pencil size={15}/>Editar</button></td>}</tr>)}</tbody></table></div>{!list.data.items.length&&<Empty>{list.loading?'Consultando cadastros…':'Nenhum registro encontrado.'}</Empty>}<Pager page={page} total={list.data.total} onChange={setPage}/></section>
    {form&&<Modal title={(form.id?'Editar ':'Cadastrar ')+(tab==='colaboradores'?'colaborador':'material')} onClose={()=>{if(!busy){setForm(null);setNfc(false);}}}><Notice message={message}/><form onSubmit={save}><div className="form-grid">{tab==='colaboradores'&&<div className="wide"><PhotoCapture value={photo||form.foto_url} name={form.nome} onChange={setPhoto}/></div>}<label className="wide">{tab==='colaboradores'?'Nome completo':'Nome do material'}<input required value={form.nome||''} maxLength={255} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
    {tab==='colaboradores'?<><label>Matrícula<input required disabled={!!form.id} value={form.matricula||''} maxLength={255} onChange={e=>setForm({...form,matricula:e.target.value})}/></label><label>Situação<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label><label>Setor<input value={form.setor||''} maxLength={255} onChange={e=>setForm({...form,setor:e.target.value})}/></label><label>Cargo<input value={form.cargo||''} maxLength={255} onChange={e=>setForm({...form,cargo:e.target.value})}/></label><label className="wide">Cartão NFC<div className="inline-form"><input value={form.nfc_id||''} maxLength={255} onChange={e=>setForm({...form,nfc_id:e.target.value})} placeholder="Sem cartão vinculado"/><button className="button secondary" type="button" onClick={()=>setNfc(true)}>Ler cartão</button></div></label></>:<><label>Código interno<input required disabled={!!form.id} value={form.codigo_interno||''} maxLength={255} onChange={e=>setForm({...form,codigo_interno:e.target.value})}/></label><label>Código de barras<input disabled={!!form.id} value={form.codigo_barras||''} maxLength={255} onChange={e=>setForm({...form,codigo_barras:e.target.value})} placeholder="Usar código interno"/></label><label>Categoria<select value={form.categoria_id||''} onChange={e=>setForm({...form,categoria_id:e.target.value?Number(e.target.value):null})}><option value="">Sem categoria</option>{categories.data.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><label>Patrimônio<input value={form.patrimonio||''} maxLength={255} onChange={e=>setForm({...form,patrimonio:e.target.value})}/></label><label className="wide">Observações<textarea value={form.observacao||''} maxLength={4000} onChange={e=>setForm({...form,observacao:e.target.value})}/></label><p className="summary-note wide">A disponibilidade é controlada pelas retiradas, devoluções e conferências no estoque.</p></>}
    </div><div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setForm(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy?'Salvando…':'Salvar cadastro'}</button></div></form><NfcReaderModal captureOnly isOpen={nfc} onClose={()=>setNfc(false)} onNfcRead={code=>{setForm({...form,nfc_id:code});setNfc(false);}} title="Ler cartão do colaborador"/></Modal>}
  </Page>;
}
