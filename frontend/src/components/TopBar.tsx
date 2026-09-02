import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Clock, User, ArrowLeft, Tv } from 'lucide-react';
import { Usuario } from '../types';

interface TopBarProps {
  user: Usuario | null;
  onLogout: () => void;
}

// Mapeamento de rotas para títulos e subtítulos de cada página
const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/saida': {
    title: 'SAÍDA DE MATERIAL',
    subtitle: 'Retirada automatizada de materiais e lanternas subterrâneas'
  },
  '/entrada': {
    title: 'ENTRADA DE MATERIAL',
    subtitle: 'Devolução de equipamentos e baixa de turno'
  },
  '/cadastro': {
    title: 'CADASTRO GERAL DO SISTEMA',
    subtitle: 'Gestão de materiais, colaboradores e cartões NFC'
  },
  '/estoque': {
    title: 'CONTROLE DE ESTOQUE E LOCALIZAÇÃO',
    subtitle: 'Saldos, inventário geral e rastreamento de materiais'
  },
  '/historico': {
    title: 'HISTÓRICO PERMANENTE',
    subtitle: 'Auditabilidade de saídas, devoluções e manutenções'
  },
  '/relatorios': {
    title: 'RELATÓRIOS E EXPORTAÇÃO',
    subtitle: 'Exportação de planilhas gerenciais e relatórios PDF'
  },
  '/dashboard': {
    title: 'DASHBOARD DE MONITORAMENTO',
    subtitle: 'Acompanhamento em tempo real de permanência na mina'
  }
};

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
  const isDashboard = location.pathname === '/dashboard';
  const pageInfo = PAGE_TITLES[location.pathname];

  return (
    <header className={`${isHome ? 'bg-[#190837]/95 border-b border-white/10 text-white' : 'bg-white border-b border-slate-200 text-slate-800'} px-6 py-3 flex items-center justify-between shadow-sm select-none shrink-0 z-30 transition-colors`}>
      
      {/* Esquerda: Logo + Título Dinâmico da Aplicação ou Página */}
      <div className="flex items-center gap-4">
        <img 
          src={isHome ? "/logowhite.png" : "/logo.svg"} 
          alt="CMOC Logo" 
          onClick={() => navigate('/')}
          className="h-7 object-contain cursor-pointer hover:opacity-90 transition-opacity"
          onError={(e) => {
            (e.target as HTMLElement).setAttribute('src', '/logowhite.png');
          }}
        />
        
        {isHome ? (
          <div onClick={() => navigate('/')} className="cursor-pointer">
            <h1 className="font-bold text-sm tracking-wider uppercase leading-none font-['Outfit'] text-white">
              CASA DA LANTERNA
            </h1>
            <span className="text-[10px] font-medium tracking-widest uppercase block mt-0.5 text-white/70">
              CONTROLE INDUSTRIAL DE MINERAÇÃO
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Botão de Voltar para a Home (Oculto no Dashboard de TV) */}
            {!isDashboard && (
              <>
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#331274] hover:bg-[#43208C] rounded-lg shadow-sm transition-all cursor-pointer group shrink-0"
                  title="Voltar ao Menu Principal"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="hidden sm:inline">VOLTAR</span>
                </button>
                <div className="h-5 w-[1px] bg-slate-300 hidden sm:block" />
              </>
            )}

            {isDashboard && (
              <div className="flex items-center gap-2 bg-[#331274]/10 text-[#331274] px-2.5 py-1 rounded-lg text-xs font-extrabold font-['Outfit'] border border-[#331274]/20 shrink-0">
                <Tv className="w-3.5 h-3.5 animate-pulse text-[#331274]" />
                <span className="hidden sm:inline">PAINEL TV</span>
              </div>
            )}

            <div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight uppercase leading-none font-['Outfit'] text-[#331274]">
                {pageInfo?.title || 'CASA DA LANTERNA'}
              </h1>
              {pageInfo?.subtitle && (
                <span className="text-[11px] font-medium text-slate-500 block mt-0.5 leading-none">
                  {pageInfo.subtitle}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Direita: Relógio + Informações do Usuário + Logout */}
      <div className="flex items-center gap-4 sm:gap-6">
        
        {/* Relógio e Data alinhados à direita */}
        <div className="hidden md:flex items-center gap-2 text-xs border-r border-slate-200 pr-4">
          <Clock className={`w-3.5 h-3.5 ${isHome ? 'text-white/70' : 'text-[#331274]'}`} />
          <span className={`font-medium text-xs tracking-wide ${isHome ? 'text-white/80' : 'text-slate-600'}`}>
            {date}
          </span>
          <span className={`mx-1 ${isHome ? 'text-white/30' : 'text-slate-300'}`}>•</span>
          <span className={`font-semibold text-sm tracking-wider font-['Outfit'] ${isHome ? 'text-white' : 'text-[#331274]'}`}>
            {time}
          </span>
        </div>

        {/* Informações do Operador & Logout */}
        {user && (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isHome ? 'bg-white/10 text-white' : 'bg-[#331274]/10 text-[#331274]'}`}>
              <User className="w-4 h-4" />
            </div>
            <div className="text-right hidden sm:block">
              <div className={`text-xs font-bold tracking-wide font-['Outfit'] ${isHome ? 'text-white' : 'text-slate-900'}`}>
                {user.nome}
              </div>
              <div className={`text-[10px] font-medium tracking-wider mt-0.5 ${isHome ? 'text-white/70' : 'text-slate-500'}`}>
                Mat: <span className="font-semibold">{user.matricula}</span> • <span className="font-semibold uppercase">{user.nivel_acesso}</span>
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
