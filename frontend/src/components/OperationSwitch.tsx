import { useState } from 'react';
import { MaterialOperation } from './MaterialOperation';
import { QuantityOperation } from './QuantityOperation';
export function OperationSwitch({type}:{type:'saida'|'entrada'}){const [mode,setMode]=useState('INDIVIDUAL');return <><div className="tabs" style={{padding:'22px 34px 0'}}><button className={'tab '+(mode==='INDIVIDUAL'?'active':'')} onClick={()=>setMode('INDIVIDUAL')}>Equipamentos individuais</button><button className={'tab '+(mode==='QUANTIDADE'?'active':'')} onClick={()=>setMode('QUANTIDADE')}>Materiais por quantidade</button></div>{mode==='INDIVIDUAL'?<MaterialOperation type={type}/>:<QuantityOperation type={type}/>}</>;}
