import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  Boxes,
  FileText,
  History,
  Monitor,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { Usuario } from '../types';

interface MainMenuProps {
  user: Usuario | null;
}

export const MainMenu: React.FC<MainMenuProps> = ({ user }) => {
  const navigate = useNavigate();

  const handleOpenDashboardNewTab = () => {
    window.open('/dashboard', '_blank');
  };

  return (
    <div className="h-full flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 select-none gap-4 sm:gap-6 overflow-hidden">
      {/* 1. SEÇÃO PRINCIPAL DE OPERAÇÃO: ENTRADA E SAÍDA GRANDES (Ocupa a maior parte da altura) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* BOTÃO 1: SAÍDA — GRANDE DESTAQUE */}
        <button
          onClick={() => navigate('/saida')}
          className="btn-industrial bg-red-600 hover:bg-red-700 active:bg-red-800 text-white p-6 sm:p-10 flex flex-col items-center justify-center text-center rounded-xl border-4 border-red-500 group cursor-pointer shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-[0.99] h-full"
        >
          <div className="bg-white/20 p-5 sm:p-7 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner border border-white/30">
            <ArrowUpRight className="w-16 h-16 sm:w-24 sm:h-24 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-wider font-mono uppercase text-white drop-shadow-md">
            SAÍDA DE MATERIAL
          </h2>
          <p className="mt-2 text-red-100 text-sm sm:text-base font-mono font-medium opacity-90">
            Retirada por NFC / Código de Barras / Matrícula
          </p>
        </button>

        {/* BOTÃO 2: ENTRADA — GRANDE DESTAQUE */}
        <button
          onClick={() => navigate('/entrada')}
          className="btn-industrial bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white p-6 sm:p-10 flex flex-col items-center justify-center text-center rounded-xl border-4 border-emerald-500 group cursor-pointer shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-[0.99] h-full"
        >
          <div className="bg-white/20 p-5 sm:p-7 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner border border-white/30">
            <ArrowDownLeft className="w-16 h-16 sm:w-24 sm:h-24 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-wider font-mono uppercase text-white drop-shadow-md">
            ENTRADA DE MATERIAL
          </h2>
          <p className="mt-2 text-emerald-100 text-sm sm:text-base font-mono font-medium opacity-90">
            Devolução / Devolução Rápida por Tag NFC
          </p>
        </button>
      </div>

      {/* 2. SEÇÃO SECUNDÁRIA: ESTOQUE, CADASTRO E DASHBOARD (SEGUNDA TELA) MENORES */}
      <div className="h-32 sm:h-36 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 flex-shrink-0">
        {/* RETÂNGULO CADASTRO */}
        <button
          onClick={() => navigate('/cadastro')}
          className="btn-industrial bg-blue-600 hover:bg-blue-700 text-white p-4 flex flex-col justify-between rounded-lg border-2 border-blue-500 group cursor-pointer shadow-md hover:shadow-lg transition-all h-full"
        >
          <div className="flex items-center justify-between w-full">
            <div className="bg-white/20 p-3 rounded-lg group-hover:scale-105 transition-transform">
              <ClipboardList className="w-8 h-8 text-white" />
            </div>
            <ArrowRight className="w-6 h-6 text-blue-200 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="text-left">
            <h3 className="text-xl sm:text-2xl font-black tracking-wider font-mono uppercase text-white">
              CADASTROS
            </h3>
            <p className="text-xs text-blue-100 font-mono">Materiais, Colaboradores e Tags</p>
          </div>
        </button>

        {/* RETÂNGULO ESTOQUE */}
        <button
          onClick={() => navigate('/estoque')}
          className="btn-industrial bg-amber-500 hover:bg-amber-600 text-white p-4 flex flex-col justify-between rounded-lg border-2 border-amber-400 group cursor-pointer shadow-md hover:shadow-lg transition-all h-full"
        >
          <div className="flex items-center justify-between w-full">
            <div className="bg-white/20 p-3 rounded-lg group-hover:scale-105 transition-transform">
              <Boxes className="w-8 h-8 text-white" />
            </div>
            <ArrowRight className="w-6 h-6 text-amber-100 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="text-left">
            <h3 className="text-xl sm:text-2xl font-black tracking-wider font-mono uppercase text-white">
              ESTOQUE & CONSULTAS
            </h3>
            <p className="text-xs text-amber-100 font-mono">Saldos e Disponibilidade</p>
          </div>
        </button>

        {/* BOTÃO DASHBOARD (NOVA ABA) */}
        <button
          onClick={handleOpenDashboardNewTab}
          className="btn-industrial bg-slate-800 hover:bg-slate-900 text-white p-4 flex flex-col justify-between rounded-lg border-2 border-slate-600 group cursor-pointer shadow-md hover:shadow-lg transition-all h-full relative overflow-hidden"
        >
          <div className="flex items-center justify-between w-full">
            <div className="bg-amber-500/20 p-3 rounded-lg border border-amber-500/40 text-amber-400 group-hover:scale-105 transition-transform flex items-center gap-2">
              <Monitor className="w-8 h-8 text-amber-400" />
            </div>
            <div className="flex items-center gap-1 text-amber-400 bg-slate-700/80 px-2 py-1 rounded text-xs font-mono font-bold border border-slate-600 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <span>NOVA ABA</span>
              <ExternalLink className="w-4 h-4" />
            </div>
          </div>
          <div className="text-center w-full">
            <h3 className="text-xl sm:text-2xl font-black tracking-wider font-mono uppercase text-white">
              DASHBOARD
            </h3>
            <p className="text-xs text-slate-100 font-mono opacity-90">Veja quais colaboradores estão dentro da mina</p>
          </div>
        </button>
      </div>

      {/* 3. BARRA INFERIOR DE ACESSO RÁPIDO */}
      <div className="pt-3 border-t border-slate-300 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/historico')}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg border border-slate-300 font-bold text-xs uppercase flex items-center gap-2 cursor-pointer shadow-sm hover:border-slate-400 transition-all font-mono"
          >
            <History className="w-4 h-4 text-amber-600" />
            <span>Histórico Completo</span>
          </button>
          <button
            onClick={() => navigate('/relatorios')}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg border border-slate-300 font-bold text-xs uppercase flex items-center gap-2 cursor-pointer shadow-sm hover:border-slate-400 transition-all font-mono"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Relatórios & Exportação</span>
          </button>
        </div>

        <div className="text-right text-[11px] font-mono text-slate-500 font-normal">
          MINEX CASA DA LANTERNA v1.0 | MONITORAMENTO INDUSTRIAL ATIVO
        </div>
      </div>
    </div>
  );
};
