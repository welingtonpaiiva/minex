import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield, Clock, User, HardHat } from 'lucide-react';
import { Usuario } from '../types';

interface TopBarProps {
  user: Usuario | null;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onLogout }) => {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR'));
      setDate(now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).toUpperCase());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b-2 border-slate-300 text-slate-800 px-4 py-2 flex items-center justify-between shadow-sm select-none shrink-0">
      {/* Esquerda: Logo e Título */}
      <div
        onClick={() => navigate('/')}
        className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
      >
        <div className="bg-amber-500 text-slate-950 p-1.5 rounded-sm flex items-center justify-center font-bold shadow-sm">
          <HardHat className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-wider text-slate-900 uppercase leading-none font-mono">
            CASA DA LANTERNA
          </h1>
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mt-0.5">
            CONTROLE INDUSTRIAL DE MINERAÇÃO
          </span>
        </div>
      </div>

      {/* Centro: Relógio Industrial */}
      <div className="flex items-center gap-4 bg-slate-100 px-4 py-1.5 rounded border border-slate-300 font-mono shadow-inner">
        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span className="font-semibold">{date}</span>
        </div>
        <div className="text-amber-700 font-bold text-base tracking-widest">
          {time}
        </div>
      </div>

      {/* Direita: Operador & Logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded border border-slate-300">
            <User className="w-4 h-4 text-blue-600" />
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800 uppercase leading-none">
                {user.nome}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                MAT: <span className="text-blue-600 font-bold">{user.matricula}</span> | <span className="text-amber-600 font-bold">{user.nivel_acesso}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          title="Sair do Sistema"
          className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded border border-red-200 hover:border-red-600 transition-colors flex items-center justify-center cursor-pointer shadow-sm"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
