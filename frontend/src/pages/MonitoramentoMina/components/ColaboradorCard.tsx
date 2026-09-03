import React, { useState, useEffect } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface ColaboradorCardProps {
  acesso: any;
  onExibirMais: () => void;
}

export const ColaboradorCard: React.FC<ColaboradorCardProps> = ({ acesso, onExibirMais }) => {
  const [tempo, setTempo] = useState('');
  const [horasEmUso, setHorasEmUso] = useState(0);

  useEffect(() => {
    const calcularTempo = () => {
      const entrada = new Date(acesso.data_hora_entrada);
      let saida = acesso.data_hora_saida ? new Date(acesso.data_hora_saida) : new Date();
      
      const diffMs = Math.max(0, saida.getTime() - entrada.getTime());
      const minutosTotal = Math.floor(diffMs / (1000 * 60));
      const horas = Math.floor(minutosTotal / 60);
      const minutos = minutosTotal % 60;
      
      setHorasEmUso(horas);
      setTempo(`${horas.toString().padStart(2, '0')}h ${minutos.toString().padStart(2, '0')}min`);
    };

    calcularTempo();
    
    // Atualiza a cada 1 minuto se estiver ativo
    if (acesso.status === 'ATIVO') {
      const interval = setInterval(calcularTempo, 60000);
      return () => clearInterval(interval);
    }
  }, [acesso.data_hora_entrada, acesso.data_hora_saida, acesso.status]);

  // Verificar pendências de materiais
  const isPendente = acesso.status === 'ATIVO' && acesso.materiais && acesso.materiais.length > 0;
  // Regra de tempo longo
  const isTempoElevado = horasEmUso >= 7;

  return (
    <div className="bg-white rounded-2xl p-5 flex items-center justify-between shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      
      {/* Esquerda: Foto + Info */}
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border-2 border-slate-100">
          {acesso.foto_url ? (
            <img src={acesso.foto_url} alt={acesso.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xl">
              {acesso.nome.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx("w-2 h-2 rounded-full", acesso.status === 'ATIVO' ? "bg-emerald-500" : "bg-slate-400")}></span>
            <span className={clsx("text-xs font-bold tracking-wider uppercase", acesso.status === 'ATIVO' ? "text-emerald-600" : "text-slate-500")}>
              {acesso.status === 'ATIVO' ? 'NA MINA' : 'ENCERRADO'}
            </span>
          </div>
          <h3 className="font-bold text-slate-800 text-lg leading-tight">{acesso.nome}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            <span>Matrícula: {acesso.matricula}</span>
            <span>•</span>
            <span>{acesso.cargo}</span>
            <span>•</span>
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium">{acesso.setor}</span>
          </div>
        </div>
      </div>

      {/* Direita: Tempo + Botão */}
      <div className="flex items-center gap-8">
        
        {/* Entrada */}
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Entrada</span>
          <span className="text-slate-700 font-medium">
            {new Date(acesso.data_hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
          </span>
          <span className="text-xs text-slate-400">{new Date(acesso.data_hora_entrada).toLocaleDateString()}</span>
        </div>

        {/* Tempo na Mina */}
        <div className="flex flex-col items-end min-w-[120px]">
          <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Tempo na mina</span>
          <span className={clsx(
            "text-2xl font-bold font-mono tracking-tight",
            isTempoElevado ? "text-amber-500" : "text-emerald-600"
          )}>
            {tempo}
          </span>
          {isPendente ? (
            <span className="text-xs text-rose-500 font-medium flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> Materiais em uso
            </span>
          ) : (
            <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              Atualizado em tempo real
            </span>
          )}
        </div>

        {/* Ação */}
        <button 
          onClick={onExibirMais}
          className="flex items-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-4 py-3 rounded-xl transition-colors"
        >
          EXIBIR MAIS <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
