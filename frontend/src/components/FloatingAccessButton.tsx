import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export const FloatingAccessButton: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Se já estiver na página do crachá, podemos esconder ou manter o botão como indicador
  if (location.pathname === '/cracha-acesso-mina') {
    return null; // Oculta o botão se já estiver na página
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpanded) {
      navigate('/cracha-acesso-mina');
    } else {
      setIsExpanded(true);
    }
  };

  const handleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-end justify-end">
      <AnimatePresence initial={false} mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative cursor-pointer"
            onClick={handleClick}
          >
            <div 
              className={clsx(
                "flex items-center gap-4 px-5 py-4 rounded-2xl shadow-xl shadow-fuchsia-900/30",
                "border border-white/10 backdrop-blur-sm",
                "hover:brightness-110 transition-all duration-300"
              )}
              style={{
                background: 'linear-gradient(135deg, #331274 0%, #5A2AD6 50%, #8B2BE2 100%)'
              }}
            >
              <div className="bg-white/20 p-2 rounded-xl">
                <BadgeCheck className="text-white w-6 h-6" />
              </div>
              
              <div className="flex flex-col pr-6">
                <span className="text-white font-bold text-sm tracking-wide leading-tight">CRACHÁ DE ACESSO</span>
                <span className="text-fuchsia-100 font-medium text-sm leading-tight">À MINA</span>
              </div>

              <button 
                onClick={handleCollapse}
                className="absolute right-3 p-1 text-white/70 hover:text-white bg-white/5 hover:bg-white/20 rounded-full transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative group cursor-pointer"
            onClick={handleClick}
          >
            <div
              className={clsx(
                "w-16 h-16 rounded-full flex items-center justify-center shadow-xl shadow-fuchsia-900/30",
                "border border-white/10 backdrop-blur-sm",
                "hover:scale-105 transition-transform duration-300"
              )}
              style={{
                background: 'linear-gradient(135deg, #331274 0%, #5A2AD6 50%, #8B2BE2 100%)'
              }}
            >
              <BadgeCheck className="text-white w-7 h-7" />
            </div>
            
            {/* Tooltip */}
            <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
              Crachá de Acesso à Mina
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
