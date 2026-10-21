import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Check, RotateCcw } from 'lucide-react';
import { Avatar, Notice } from './ui';
function compress(source: CanvasImageSource, width: number, height: number) {
  const canvas=document.createElement('canvas'), ratio=Math.min(640/width,640/height,1);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const context=canvas.getContext('2d');if(!context)throw new Error('Não foi possível processar a foto');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.82);
}
export function PhotoCapture({value,name,onChange}:{value?:string;name:string;onChange:(photo:string)=>void}){
  const [active,setActive]=useState(false),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),mounted=useRef(true),file=useRef<HTMLInputElement>(null);
  function stop(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setActive(false);}
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stream.current?.getTracks().forEach(t=>t.stop());};},[]);
  useEffect(()=>{if(active&&video.current&&stream.current){video.current.srcObject=stream.current;void video.current.play().catch(()=>setError('Não foi possível reproduzir a câmera.'));}},[active]);
  async function camera(){setError('');setBusy(true);setPreview('');try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Câmera indisponível. Use localhost ou HTTPS e verifique a webcam.');
    const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:640}},audio:false});
    if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;setActive(true);
  }catch(e:any){setError(e.name==='NotAllowedError'?'Permita o acesso à câmera no navegador.':e.name==='NotFoundError'?'Nenhuma webcam encontrada.':e.message||'Não foi possível acessar a câmera.');}finally{if(mounted.current)setBusy(false);}}
  function capture(){if(!video.current?.videoWidth)return;setPreview(compress(video.current,video.current.videoWidth,video.current.videoHeight));stop();}
  async function select(selected?:File){setError('');if(!selected)return;try{if(!['image/jpeg','image/png','image/webp'].includes(selected.type))throw new Error('Selecione uma imagem JPEG, PNG ou WebP.');if(selected.size>8*1024*1024)throw new Error('Selecione uma foto de até 8 MB.');const bitmap=await createImageBitmap(selected);if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('A imagem é muito grande. Use até 25 megapixels.');}const photo=compress(bitmap,bitmap.width,bitmap.height);bitmap.close();stop();setPreview(photo);}catch(e:any){setError(e.message||'Arquivo de imagem inválido.');}if(file.current)file.current.value='';}
  return <div className="photo-editor"><div className="photo-editor-top"><Avatar src={value} name={name||'Colaborador'} large/><div className="photo-actions"><button type="button" className="button secondary" disabled={busy} onClick={camera}><Camera size={18}/>{busy?'Abrindo câmera…':'Tirar foto'}</button><button type="button" className="button secondary" onClick={()=>file.current?.click()}><Upload size={18}/>Selecionar foto</button><input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void select(e.target.files?.[0])}/></div></div><Notice message={error}/>{active&&<><video ref={video} autoPlay playsInline muted/><div className="photo-actions"><button className="button primary" type="button" onClick={capture}><Camera size={18}/>Capturar</button><button className="button secondary" type="button" onClick={stop}>Fechar câmera</button></div></>}{preview&&<><img className="photo-preview" src={preview} alt="Prévia da fotografia"/><div className="photo-actions"><button className="button primary" type="button" onClick={()=>{onChange(preview);setPreview('');}}><Check size={18}/>Usar esta foto</button><button className="button secondary" type="button" onClick={()=>{setPreview('');void camera();}}><RotateCcw size={18}/>Refazer</button></div></>}<small className="summary-note">A foto será associada ao colaborador ao salvar o cadastro.</small></div>;
}
