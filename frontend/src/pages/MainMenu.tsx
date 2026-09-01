import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ClipboardList, Boxes, FileText, History } from 'lucide-react';
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
        {/* BOTÃO 1: SAÍDA (RETIRADA) — PRIMEIRO */}
        <button
          onClick={() => navigate('/saida')}
          className="btn-industrial bg-red-600 hover:bg-red-700 text-white p-6 sm:p-8 flex flex-col items-center justify-center text-center rounded-lg border-2 border-red-500 group cursor-pointer shadow-lg hover:shadow-xl transition-all active:scale-[0.99]"
        >
          <div className="bg-white/15 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform shadow-inner">
            <ArrowUpRight className="w-12 h-12 sm:w-16 sm:h-16 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-wider font-mono uppercase text-white">
            SAÍDA DE MATERIAL
          </h2>
          <span className="text-xs sm:text-sm font-bold uppercase mt-2 text-white/90 tracking-widest bg-red-800/40 px-3 py-1 rounded-full border border-white/20">
            1. Registrar Retirada (Crachá NFC + Código)
          </span>
        </button>

        {/* BOTÃO 2: ENTRADA (DEVOLUÇÃO) — SEGUNDO */}
        <button
          onClick={() => navigate('/entrada')}
          className="btn-industrial bg-emerald-600 hover:bg-emerald-700 text-white p-6 sm:p-8 flex flex-col items-center justify-center text-center rounded-lg border-2 border-emerald-500 group cursor-pointer shadow-lg hover:shadow-xl transition-all active:scale-[0.99]"
        >
          <div className="bg-white/15 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform shadow-inner">
            <ArrowDownLeft className="w-12 h-12 sm:w-16 sm:h-16 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-wider font-mono uppercase text-white">
            ENTRADA DE MATERIAL
          </h2>
          <span className="text-xs sm:text-sm font-bold uppercase mt-2 text-white/90 tracking-widest bg-emerald-800/40 px-3 py-1 rounded-full border border-white/20">
            2. Registrar Devolução (Retorno ao Estoque)
          </span>
        </button>
      </div>

      {/* 2. DOIS RETÂNGULOS MENORES EMBAIXO LADO A LADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RETÂNGULO CADASTRO */}
        <button
          onClick={() => navigate('/cadastro')}
          className="btn-industrial bg-blue-600 hover:bg-blue-700 text-white p-3.5 sm:p-4 flex items-center justify-between rounded-md border border-blue-500 group cursor-pointer shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="bg-white/15 p-2.5 rounded-md group-hover:scale-105 transition-transform">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold tracking-wider font-mono uppercase text-white">
                CADASTRO
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                Cadastrar novos equipamentos e colaboradores
              </p>
            </div>
          </div>
          <span className="text-xs font-bold font-mono text-blue-200 uppercase bg-blue-800/50 px-2.5 py-1 rounded">
            GERENCIAR →
          </span>
        </button>

        {/* RETÂNGULO ESTOQUE */}
        <button
          onClick={() => navigate('/estoque')}
          className="btn-industrial bg-amber-500 hover:bg-amber-600 text-white p-3.5 sm:p-4 flex items-center justify-between rounded-md border border-amber-400 group cursor-pointer shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="bg-white/15 p-2.5 rounded-md group-hover:scale-105 transition-transform">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold tracking-wider font-mono uppercase text-white">
                ESTOQUE & CONSULTAS
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                Consultar materiais, status e localizações
              </p>
            </div>
          </div>
          <span className="text-xs font-bold font-mono text-amber-100 uppercase bg-amber-700/50 px-2.5 py-1 rounded">
            CONSULTAR →
          </span>
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
          MINEX CASA DA LANTERNA v1.0 | TERMINAL BALCÃO 01
        </div>
      </div>
    </div>
  );
};
