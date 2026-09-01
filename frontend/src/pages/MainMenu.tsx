import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ClipboardList, Boxes, FileText, History, ArrowRight } from 'lucide-react';
import { Usuario } from '../types';
import { DashboardAlertas } from '../components/DashboardAlertas';

interface MainMenuProps {
  user: Usuario | null;
}

export const MainMenu: React.FC<MainMenuProps> = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 overflow-y-auto select-none gap-6">
      {/* 1. DOIS GRANDES BOTÕES LADO A LADO (SAÍDA PRIMEIRO, ENTRADA DEPOIS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* BOTÃO 1: SAÍDA — PRIMEIRO */}
        <button
          onClick={() => navigate('/saida')}
          className="btn-industrial bg-red-600 hover:bg-red-700 text-white p-6 sm:p-8 flex flex-col items-center justify-center text-center rounded-lg border-2 border-red-500 group cursor-pointer shadow-lg hover:shadow-xl transition-all active:scale-[0.99]"
        >
          <div className="bg-white/15 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform shadow-inner">
            <ArrowUpRight className="w-14 h-14 sm:w-18 sm:h-18 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-wider font-mono uppercase text-white">
            SAÍDA DE MATERIAL
          </h2>
        </button>

        {/* BOTÃO 2: ENTRADA — SEGUNDO */}
        <button
          onClick={() => navigate('/entrada')}
          className="btn-industrial bg-emerald-600 hover:bg-emerald-700 text-white p-6 sm:p-8 flex flex-col items-center justify-center text-center rounded-lg border-2 border-emerald-500 group cursor-pointer shadow-lg hover:shadow-xl transition-all active:scale-[0.99]"
        >
          <div className="bg-white/15 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform shadow-inner">
            <ArrowDownLeft className="w-14 h-14 sm:w-18 sm:h-18 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-wider font-mono uppercase text-white">
            ENTRADA DE MATERIAL
          </h2>
        </button>
      </div>

      {/* 2. DOIS RETÂNGULOS MENORES EMBAIXO LADO A LADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RETÂNGULO CADASTRO */}
        <button
          onClick={() => navigate('/cadastro')}
          className="btn-industrial bg-blue-600 hover:bg-blue-700 text-white p-4 flex items-center justify-between rounded-md border border-blue-500 group cursor-pointer shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-2.5 rounded-md group-hover:scale-105 transition-transform">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-black tracking-wider font-mono uppercase text-white">
              CADASTRO
            </h3>
          </div>
          <ArrowRight className="w-5 h-5 text-blue-200 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* RETÂNGULO ESTOQUE */}
        <button
          onClick={() => navigate('/estoque')}
          className="btn-industrial bg-amber-500 hover:bg-amber-600 text-white p-4 flex items-center justify-between rounded-md border border-amber-400 group cursor-pointer shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-2.5 rounded-md group-hover:scale-105 transition-transform">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-black tracking-wider font-mono uppercase text-white">
              ESTOQUE & CONSULTAS
            </h3>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-100 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 3. DASHBOARD INDUSTRIAL E ALERTAMENTO DE TURNO */}
      <DashboardAlertas />

      {/* 4. BARRA INFERIOR DE ACESSO RÁPIDO */}
      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/historico')}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded border border-slate-300 font-semibold text-xs uppercase flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <History className="w-4 h-4 text-amber-600" />
            <span>Histórico Completo</span>
          </button>
          <button
            onClick={() => navigate('/relatorios')}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded border border-slate-300 font-semibold text-xs uppercase flex items-center gap-2 cursor-pointer shadow-sm"
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
