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
      {/* 4 Botões Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* BOTÃO ENTRADA (DEVOLUÇÃO) */}
        <button
          onClick={() => navigate('/entrada')}
          className="btn-industrial bg-emerald-600 hover:bg-emerald-700 text-white p-4 flex flex-col items-center justify-center text-center rounded-md border border-emerald-500 group cursor-pointer shadow-md hover:shadow-lg transition-all"
        >
          <div className="bg-white/15 p-3 rounded-full mb-2 group-hover:scale-105 transition-transform">
            <ArrowDownLeft className="w-8 h-8 text-white stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold tracking-wider font-mono uppercase text-white">
            ENTRADA
          </h2>
          <span className="text-[11px] font-medium uppercase mt-1 text-white/90 tracking-wider">
            Devolução de Material
          </span>
        </button>

        {/* BOTÃO SAÍDA (RETIRADA) */}
        <button
          onClick={() => navigate('/saida')}
          className="btn-industrial bg-red-600 hover:bg-red-700 text-white p-4 flex flex-col items-center justify-center text-center rounded-md border border-red-500 group cursor-pointer shadow-md hover:shadow-lg transition-all"
        >
          <div className="bg-white/15 p-3 rounded-full mb-2 group-hover:scale-105 transition-transform">
            <ArrowUpRight className="w-8 h-8 text-white stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold tracking-wider font-mono uppercase text-white">
            SAÍDA
          </h2>
          <span className="text-[11px] font-medium uppercase mt-1 text-white/90 tracking-wider">
            Saída de Material
          </span>
        </button>

        {/* BOTÃO CADASTRO */}
        <button
          onClick={() => navigate('/cadastro')}
          className="btn-industrial bg-blue-600 hover:bg-blue-700 text-white p-4 flex flex-col items-center justify-center text-center rounded-md border border-blue-500 group cursor-pointer shadow-md hover:shadow-lg transition-all"
        >
          <div className="bg-white/15 p-3 rounded-full mb-2 group-hover:scale-105 transition-transform">
            <ClipboardList className="w-8 h-8 text-white stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold tracking-wider font-mono uppercase text-white">
            CADASTRO
          </h2>
          <span className="text-[11px] font-medium uppercase mt-1 text-white/90 tracking-wider">
            Cadastrar Itens/Pessoas
          </span>
        </button>

        {/* BOTÃO ESTOQUE */}
        <button
          onClick={() => navigate('/estoque')}
          className="btn-industrial bg-amber-500 hover:bg-amber-600 text-white p-4 flex flex-col items-center justify-center text-center rounded-md border border-amber-400 group cursor-pointer shadow-md hover:shadow-lg transition-all"
        >
          <div className="bg-white/15 p-3 rounded-full mb-2 group-hover:scale-105 transition-transform">
            <Boxes className="w-8 h-8 text-white stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold tracking-wider font-mono uppercase text-white">
            ESTOQUE
          </h2>
          <span className="text-[11px] font-semibold uppercase mt-1 text-white tracking-wider">
            Consultar Estoque
          </span>
        </button>
      </div>

      {/* DASHBOARD INDUSTRIAL E ALERTAMENTO DE TURNO */}
      <DashboardAlertas />

      {/* Barra Inferior de Acesso Rápido para Histórico e Relatórios */}
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

