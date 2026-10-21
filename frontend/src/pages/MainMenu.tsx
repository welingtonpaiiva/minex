import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  ClipboardList, 
  Boxes, 
  Monitor, 
  FileText, 
  ExternalLink,
  ArrowRight, DoorOpen, GraduationCap, SearchCheck, Package, History, Shield, Archive
} from 'lucide-react';
import { Usuario } from '../types';
import { canOperate } from '../components/ui';
import { useResource } from '../hooks/useResource';
import { motion } from 'framer-motion';

interface MainMenuProps {
  user: Usuario;
}

export const MainMenu: React.FC<MainMenuProps> = ({ user }) => {
  const navigate = useNavigate();
  const connection = useResource<any>('/operacao/status', {}, {});
  const manager = ['ADMINISTRADOR', 'SUPERVISOR'].includes(user.nivel_acesso);
  const modules = [
    {to:'/cadastro', title:'Cadastros', description:'Materiais, colaboradores, fotos e cartões NFC.', icon:ClipboardList},
    {to:'/estoque', title:'Estoque & consultas', description:'Inventário, disponibilidade e conferência dos materiais.', icon:Boxes},
    {to:'/dashboard', title:'Dashboard', description:'Monitoramento de presença na mina em uma nova aba.', icon:Monitor, external:true},
    {to:'/relatorios', title:'Relatórios', description:'Exportação de planilhas e relatórios PDF.', icon:FileText},
    {to:'/acessos', title:'Acesso à mina', description:'Registro de entrada, saída e permanência de pessoas.', icon:DoorOpen},
    {to:'/conformidade', title:'Treinamentos', description:'Conformidade e requisitos de cada colaborador.', icon:GraduationCap},
    {to:'/extravios', title:'Extravios', description:'Pendências, ocorrências e devoluções atrasadas.', icon:SearchCheck},
    {to:'/quantidades', title:'Materiais por quantidade', description:'Saldos, retiradas e devoluções parciais.', icon:Package},
    {to:'/historico', title:'Histórico', description:'Consulte as movimentações e seus responsáveis.', icon:History},
    ...(manager ? [
      {to:'/administracao', title:'Administração', description:'Contas, permissões e auditoria da operação.', icon:Shield},
      {to:'/legado', title:'Dados anteriores', description:'Consulta aos registros preservados na migração.', icon:Archive}
    ] : [])
  ];


  return (
    <div 
      className="navigation-panel min-h-full flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-y-auto bg-cover bg-center bg-fixed font-sans select-none"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(25, 8, 55, 0.95) 0%, rgba(51, 18, 116, 0.85) 50%, rgba(0, 0, 0, 0.75) 100%), url('/20250218LD0126.jpg')`
      }}
    >
      {/* Overlay sutil */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      <div className="relative z-10 max-w-[1380px] w-full mx-auto flex flex-col justify-between flex-1 space-y-8 py-2">
        
        {/* CABEÇALHO INTERNO */}
        <div className="flex flex-wrap gap-4 items-center justify-between border-b border-white/15 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-['Outfit'] tracking-tight">
              Painel de Operações Subterrâneas
            </h2>
            <span className="text-white/40 text-lg font-normal">|</span>
            <span className="text-white/80 text-sm lg:text-base font-medium">
              Casa da Lanterna — CMOC Brasil
            </span>
          </div>
        </div>


        <span role="status" className="self-start rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white">{connection.error ? 'Sem comunicação com o servidor' : connection.data.conectado ? 'Sistema conectado' : 'Verificando conexão'}</span>
        {/* 1. BOTÕES PRINCIPAIS EXPANDIDOS E MAIORES — SAÍDA E ENTRADA DE MATERIAL */}
        {canOperate(user.nivel_acesso) && <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          
          {/* BOTÃO GRANDE — SAÍDA DE MATERIAL */}
          <motion.button
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/saida')}
            className="w-full bg-white rounded-2xl p-8 sm:p-10 lg:p-12 text-left border border-slate-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer flex flex-col justify-between group min-h-[260px] lg:min-h-[280px] relative overflow-hidden"
          >
            {/* Brilho decorativo no hover */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#331274]/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-125" />

            <div className="flex items-start justify-between w-full relative z-10 mb-6">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-16 h-16 rounded-2xl bg-[#331274] text-white flex items-center justify-center shadow-lg shadow-[#331274]/30 group-hover:scale-110 transition-transform shrink-0">
                  <ArrowUpRight className="w-8 h-8" />
                </div>
                <div>
                  <span className="bg-[#331274]/10 text-[#331274] text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-1.5">
                    RETIRADA RÁPIDA
                  </span>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
                    SAÍDA DE MATERIAL
                  </h3>
                </div>
              </div>
              <div className="w-11 h-11 rounded-full bg-slate-100 group-hover:bg-[#331274] group-hover:text-white text-slate-400 flex items-center justify-center transition-all shrink-0">
                <ArrowRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed relative z-10 max-w-lg">
              Retirada automatizada e identificação instantânea por Tag NFC, Código de Barras ou Matrícula de colaborador.
            </p>
          </motion.button>

          {/* BOTÃO GRANDE — ENTRADA DE MATERIAL */}
          <motion.button
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/entrada')}
            className="w-full bg-white rounded-2xl p-8 sm:p-10 lg:p-12 text-left border border-slate-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer flex flex-col justify-between group min-h-[260px] lg:min-h-[280px] relative overflow-hidden"
          >
            {/* Brilho decorativo no hover */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#331274]/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-125" />

            <div className="flex items-start justify-between w-full relative z-10 mb-6">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-16 h-16 rounded-2xl bg-[#331274] text-white flex items-center justify-center shadow-lg shadow-[#331274]/30 group-hover:scale-110 transition-transform shrink-0">
                  <ArrowDownLeft className="w-8 h-8" />
                </div>
                <div>
                  <span className="bg-[#331274]/10 text-[#331274] text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-1.5">
                    DEVOLUÇÃO RÁPIDA
                  </span>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#331274] tracking-tight font-['Outfit']">
                    ENTRADA DE MATERIAL
                  </h3>
                </div>
              </div>
              <div className="w-11 h-11 rounded-full bg-slate-100 group-hover:bg-[#331274] group-hover:text-white text-slate-400 flex items-center justify-center transition-all shrink-0">
                <ArrowRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed relative z-10 max-w-lg">
              Devolução de equipamentos e lanternas com confirmação de presença e baixa automática no sistema.
            </p>
          </motion.button>

        </div>}

        <nav aria-label="Módulos do sistema" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {modules.map(({to,title,description,icon:Icon,external}) => <motion.a
            key={to} href={to} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
            onClick={event => {if(!external && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey){event.preventDefault();navigate(to);}}}
            whileHover={{y:-3,scale:1.01}} whileTap={{scale:0.98}}
            className="bg-white rounded-2xl p-7 lg:p-8 text-left border border-slate-200 shadow-md hover:shadow-xl transition-shadow flex flex-col justify-between group min-h-[190px]">
            <div className="flex items-center justify-between gap-3 mb-5"><span className="w-12 h-12 rounded-2xl bg-[#331274]/10 text-[#331274] flex items-center justify-center group-hover:bg-[#331274] group-hover:text-white transition-colors shrink-0"><Icon size={24}/></span>{external ? <span className="text-[11px] font-bold text-[#331274] flex items-center gap-1">NOVA ABA <ExternalLink size={14}/></span> : <ArrowRight className="text-slate-300 group-hover:text-[#331274]" size={20}/>}</div>
            <div><h3 className="text-lg font-bold text-[#331274] uppercase tracking-wide mb-1.5">{title}</h3><p className="text-sm text-slate-600 leading-relaxed">{description}</p></div>
          </motion.a>)}
        </nav>
      </div>
      <footer className="relative z-10 max-w-[1380px] w-full mx-auto mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-white/70 gap-2">
        <p>© {new Date().getFullYear()} Casa da Lanterna | Controle de Materiais de Mineração</p><p>Dev by WP & EF</p>
      </footer>
    </div>
  );
};
