import React from 'react';
import { X, Clock, Package, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface ColaboradorSidePanelProps {
  acesso: any | null;
  onClose: () => void;
}

export const ColaboradorSidePanel: React.FC<ColaboradorSidePanelProps> = ({ acesso, onClose }) => {
  if (!acesso) return null;

  const temMateriais = acesso.materiais && acesso.materiais.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex justify-end"
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

        {/* Painel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800">Detalhes do Acesso</h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            
            {/* Perfil */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full bg-slate-200 overflow-hidden border-4 border-white shadow-lg mb-4">
                {acesso.foto_url ? (
                  <img src={acesso.foto_url} alt={acesso.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-3xl">
                    {acesso.nome.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center">{acesso.nome}</h3>
              <p className="text-slate-500 font-medium mt-1">Matrícula: {acesso.matricula}</p>
              
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                  {acesso.cargo}
                </span>
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
                  {acesso.setor}
                </span>
              </div>
            </div>

            {/* Informações de Acesso */}
            <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Registro de Acesso
              </h4>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Status</span>
                  <span className={clsx("text-sm font-bold px-2 py-1 rounded-md", acesso.status === 'ATIVO' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700")}>
                    {acesso.status === 'ATIVO' ? 'NA MINA' : 'ENCERRADO'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Data</span>
                  <span className="text-sm font-medium text-slate-800">
                    {new Date(acesso.data_hora_entrada).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Horário de Entrada</span>
                  <span className="text-sm font-medium text-slate-800">
                    {new Date(acesso.data_hora_entrada).toLocaleTimeString()}
                  </span>
                </div>
                {acesso.data_hora_saida && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Horário de Saída</span>
                    <span className="text-sm font-medium text-slate-800">
                      {new Date(acesso.data_hora_saida).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Materiais */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" /> Materiais Retirados
                </h4>
                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                  {acesso.materiais?.length || 0}
                </span>
              </div>
              
              <div className="p-0">
                {!temMateriais ? (
                  <div className="p-6 text-center text-sm text-slate-500 flex flex-col items-center">
                    <Package className="w-8 h-8 text-slate-300 mb-2" />
                    Nenhum material em posse no momento.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {acesso.materiais.map((mat: any, index: number) => (
                      <li key={index} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{mat.nome}</p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">Cod: {mat.codigo_interno}</p>
                        </div>
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md flex items-center gap-1">
                          EM USO
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
            {temMateriais && acesso.status === 'ATIVO' && (
              <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700 font-medium">
                  Existe material pendente para devolução. A sessão de acesso só será encerrada quando todos os itens forem devolvidos.
                </p>
              </div>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
