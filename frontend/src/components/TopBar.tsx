import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Clock, User } from 'lucide-react';
import { Usuario } from '../types';

interface TopBarProps {
  user: Usuario | null;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onLogout }) => {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR'));
      
      const dayName = now.toLocaleDateString('pt-BR', { weekday: 'short' });
      const dayFormatted = dayName.charAt(0).toUpperCase() + dayName.slice(1).replace('.', '');
      const dateFormatted = now.toLocaleDateString('pt-BR');
      
      setDate(`${dayFormatted}, ${dateFormatted}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isHome = location.pathname === '/';

  return (
    <header className={`${isHome ? 'bg-[#190837]/90 border-b border-white/10 text-white' : 'bg-white border-b border-slate-200 text-slate-800'} px-6 py-3 flex items-center justify-between shadow-sm select-none shrink-0 z-30 transition-colors`}>
      
      {/* Esquerda: Logo e Título da Aplicação */}
      <div
        onClick={() => navigate('/')}
        className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
      >
        <img 
          src={isHome ? "/logowhite.png" : "/logo.svg"} 
          alt="CMOC Logo" 
          className="h-7 object-contain"
          onError={(e) => {
            (e.target as HTMLElement).setAttribute('src', '/logowhite.png');
          }}
        />
        
        <div>
          <h1 className={`font-bold text-sm tracking-wider uppercase leading-none font-['Outfit'] ${isHome ? 'text-white' : 'text-slate-900'}`}>
            CASA DA LANTERNA
          </h1>
          <span className={`text-[10px] font-medium tracking-widest uppercase block mt-0.5 ${isHome ? 'text-white/70' : 'text-slate-500'}`}>
            CONTROLE INDUSTRIAL DE MINERAÇÃO
          </span>
        </div>
      </div>

      {/* Centro: Relógio Limpo e Sem Contorno */}
      <div className="flex items-center gap-2 text-xs">
        <Clock className={`w-3.5 h-3.5 ${isHome ? 'text-white/70' : 'text-[#331274]'}`} />
        <span className={`font-medium text-xs tracking-wide ${isHome ? 'text-white/80' : 'text-slate-600'}`}>
          {date}
        </span>
        <span className={`mx-1 ${isHome ? 'text-white/30' : 'text-slate-300'}`}>•</span>
        <span className={`font-semibold text-sm tracking-wider font-['Outfit'] ${isHome ? 'text-white' : 'text-[#331274]'}`}>
          {time}
        </span>
      </div>

      {/* Direita: Informações do Operador (Sem Contorno) & Logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isHome ? 'bg-white/10 text-white' : 'bg-slate-100 text-[#331274]'}`}>
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="text-right">
              <div className={`text-xs font-semibold tracking-wide font-['Outfit'] ${isHome ? 'text-white' : 'text-slate-900'}`}>
                {user.nome}
              </div>
              <div className={`text-[11px] font-normal tracking-wider mt-0.5 ${isHome ? 'text-white/70' : 'text-slate-500'}`}>
                Mat: <span className="font-semibold">{user.matricula}</span> • <span className="font-medium uppercase">{user.nivel_acesso}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          title="Sair do Sistema"
          className={`p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${isHome ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
