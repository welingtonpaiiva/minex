import React, { useState, useEffect } from 'react';
import { ChevronRight, AlertTriangle, User } from 'lucide-react';
import clsx from 'clsx';

interface ColaboradorCardCompactoProps {
  acesso: any;
  onExibirMais: () => void;
}

export const ColaboradorCardCompacto: React.FC<ColaboradorCardCompactoProps> = ({ acesso, onExibirMais }) => {
  const [tempo, setTempo] = useState('');
  const [horasEmUso, setHorasEmUso] = useState(0);

  useEffect(() => {
    const calc = () => {
      const entrada = new Date(acesso.data_hora_entrada);
      const saida = acesso.data_hora_saida ? new Date(acesso.data_hora_saida) : new Date();
      const diffMs = Math.max(0, saida.getTime() - entrada.getTime());
      const minutosTotal = Math.floor(diffMs / 60000);
      const h = Math.floor(minutosTotal / 60);
      const m = minutosTotal % 60;
      setHorasEmUso(h);
      setTempo(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}min`);
    };
    calc();
    if (acesso.status === 'ATIVO') {
      const iv = setInterval(calc, 60000);
      return () => clearInterval(iv);
    }
  }, [acesso]);

  const excedido = horasEmUso >= 7;
  const temMateriais = acesso.materiais && acesso.materiais.length > 0;
  const materialTexto = !temMateriais
    ? 'Sem material'
    : acesso.materiais.length === 1
      ? acesso.materiais[0].nome
      : `${acesso.materiais.length} materiais retirados`;

  const horaEntrada = new Date(acesso.data_hora_entrada)
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border flex flex-col overflow-hidden h-full transition-shadow hover:shadow-md',
        excedido ? 'border-rose-200' : 'border-slate-200'
      )}
    >
      {/* Topo: status + entrada */}
      <div className={clsx(
        'flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-b flex-shrink-0',
        excedido ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
      )}>
        <span className="flex items-center gap-1">
          <span className={clsx('w-1.5 h-1.5 rounded-full', excedido ? 'bg-rose-500' : 'bg-emerald-500')} />
          {excedido ? 'EXCEDIDO' : 'NA MINA'}
        </span>
        <span className="text-slate-400 font-medium normal-case">{horaEntrada}</span>
      </div>

      {/* Corpo: foto + info */}
      <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-0 flex-shrink-0">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {acesso.foto_url ? (
            <img src={acesso.foto_url} alt={acesso.nome} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-slate-400" />
          )}
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <p className="font-black text-slate-900 text-[12px] leading-tight line-clamp-2 uppercase break-words">
            {acesso.nome}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Mat: <span className="font-semibold text-slate-700">{acesso.matricula}</span>
            {acesso.setor && <> &bull; <span className="text-[#331274] font-semibold">{acesso.setor}</span></>}
          </p>
          <p className="text-[10px] text-slate-500 truncate">{acesso.cargo}</p>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Material + Tempo */}
      <div className="px-3 pb-1 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className={clsx(
            'text-[10px] truncate max-w-[55%]',
            temMateriais ? 'text-amber-600 font-semibold flex items-center gap-1' : 'text-slate-400'
          )}>
            {temMateriais && <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />}
            <span className="truncate">{materialTexto}</span>
          </p>
          <p className={clsx(
            'text-sm font-black tabular-nums flex-shrink-0',
            excedido ? 'text-rose-500' : 'text-emerald-600'
          )}>
            {tempo}
          </p>
        </div>
      </div>

      {/* Botão */}
      <button
        onClick={onExibirMais}
        className="w-full flex items-center justify-end gap-1 px-3 py-1.5 border-t border-slate-100 text-[10px] font-bold text-[#331274] hover:bg-indigo-50 transition-colors flex-shrink-0"
      >
        EXIBIR MAIS <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};
