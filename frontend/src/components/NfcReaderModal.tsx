import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wifi, CreditCard, X, CheckCircle2, LoaderCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { soundFX } from '../services/soundFX';
import { api } from '../services/api';
import { Colaborador } from '../types';
import { Notice, Person, errorMessage } from './ui';

interface NfcReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNfcRead: (nfcId: string, person?: Colaborador) => void | Promise<void>;
  title?: string;
  subtitle?: string;
  captureOnly?: boolean;
  requireActive?: boolean;
}

export function NfcReaderModal({isOpen, onClose, onNfcRead, title='APROXIME O CRACHÁ NFC', subtitle='Aproxime o cartão do leitor de balcão', captureOnly=false, requireActive=false}: NfcReaderModalProps) {
  const [state,setState] = useState<'waiting'|'reading'|'success'>('waiting');
  const [person,setPerson] = useState<Colaborador|null>(null);
  const [manual,setManual] = useState(false), [code,setCode] = useState(''), [error,setError] = useState('');
  const dialog=useRef<HTMLElement>(null), pending=useRef(false), generation=useRef(0);
  const callbacks=useRef({onClose,onNfcRead});
  callbacks.current={onClose,onNfcRead};
  const read=useCallback(async(value:string)=>{
    const clean=value.trim();
    if(!clean || clean.length>255 || pending.current)return;
    pending.current=true;const request=generation.current;setState('reading');setError('');soundFX.playScan();
    try{
      const found=captureOnly ? undefined : (await api.get<Colaborador>('/colaboradores/nfc/'+encodeURIComponent(clean))).data;
      if(request!==generation.current)return;
      if(requireActive && found?.status!=='ATIVO')throw new Error('Colaborador inativo. Retirada bloqueada.');
      setPerson(found||null);setState('success');soundFX.playSuccess();
      await new Promise(resolve=>setTimeout(resolve,850));
      if(request!==generation.current)return;
      await callbacks.current.onNfcRead(clean,found);
    }catch(e:any){
      if(request!==generation.current)return;
      setError(e.response ? errorMessage(e) : e.message || 'Não foi possível ler o crachá. Tente novamente.');
      setState('waiting');soundFX.playError();
    }finally{if(request===generation.current)pending.current=false;}
  },[captureOnly,requireActive]);

  useEffect(()=>{
    if(!isOpen)return;
    generation.current++;pending.current=false;setState('waiting');setError('');setManual(false);setCode('');setPerson(null);
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.focus();
    let buffer='',last=0;
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();callbacks.current.onClose();return;}
      if(event.key==='Tab'){
        const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')||[]);
        const first=controls[0],lastControl=controls[controls.length-1];
        if(!controls.length){event.preventDefault();return;}
        if(event.shiftKey && (document.activeElement===first || document.activeElement===dialog.current)){event.preventDefault();lastControl.focus();}
        else if(!event.shiftKey && (document.activeElement===lastControl || document.activeElement===dialog.current)){event.preventDefault();first.focus();}
        return;
      }
      if((event.target as HTMLElement).matches('input,textarea') || event.ctrlKey || event.metaKey || event.altKey)return;
      if(event.key==='Enter' && buffer){event.preventDefault();event.stopImmediatePropagation();void read(buffer);buffer='';return;}
      if(event.key.length===1){event.preventDefault();const now=Date.now();if(now-last>400)buffer='';last=now;buffer=(buffer+event.key).slice(-255);}
    };
    window.addEventListener('keydown',keys,true);
    return ()=>{generation.current++;pending.current=false;window.removeEventListener('keydown',keys,true);previous?.focus();};
  },[isOpen,read]);

  if(!isOpen)return null;
  return createPortal(<div className="nfc-backdrop">
    <motion.section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={'nfc-dialog '+state} initial={{opacity:0,scale:.94,y:18}} animate={{opacity:1,scale:1,y:0}}>
      <button type="button" className="nfc-close" aria-label="Fechar leitor NFC" onClick={onClose}><X size={22}/></button>
      <span className="nfc-eyebrow">LEITOR DE CRACHÁ · CASA DA LANTERNA</span>
      <div className="nfc-orbit" aria-hidden="true"><span/><span/><span/><div>{state==='success'?<CheckCircle2 size={48}/>:state==='reading'?<LoaderCircle className="spin" size={44}/>:<Wifi size={44} className="rotate-90"/>}</div></div>
      <div aria-live="polite"><h2>{state==='success' ? captureOnly?'CARTÃO LIDO!':'CRACHÁ IDENTIFICADO!' : state==='reading'?'IDENTIFICANDO CRACHÁ…':title}</h2><p>{state==='success'?'Leitura confirmada. Preparando o atendimento.':subtitle}</p></div>
      {person && <div className="nfc-person"><Person person={person}/></div>}
      <Notice message={error}/>
      {state==='waiting' && <>{manual ? <form className="inline-form" onSubmit={event=>{event.preventDefault();void read(code);}}><input aria-label="Código NFC ou matrícula" autoFocus autoComplete="off" placeholder="Código NFC ou matrícula" value={code} maxLength={255} required onChange={event=>setCode(event.target.value)}/><button className="button primary">Identificar crachá</button></form> : <button type="button" className="button secondary" onClick={()=>setManual(true)}><CreditCard size={18}/>Digitar código NFC ou matrícula</button>}<p className="nfc-hint">Aproxime o crachá do leitor USB conectado ao computador.</p></>}
    </motion.section>
  </div>,document.body);
}
