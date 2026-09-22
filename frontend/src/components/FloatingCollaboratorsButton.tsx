import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import clsx from 'clsx';

export const FloatingCollaboratorsButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/cracha-acesso-mina' || location.pathname === '/cadastro') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-end justify-end">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative group cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          navigate('/cadastro');
        }}
      >
        <div
          className={clsx(
            "w-16 h-16 rounded-full flex items-center justify-center shadow-xl shadow-fuchsia-900/30",
            "border border-white/10 backdrop-blur-sm"
          )}
          style={{
            background: 'linear-gradient(135deg, #1e0947 0%, #331274 50%, #4c1d95 100%)'
          }}
        >
          <Users className="text-white w-7 h-7" />
        </div>
        
        {/* Tooltip */}
        <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
          Cadastros & Colaboradores
        </div>
      </motion.div>
    </div>
  );
};
