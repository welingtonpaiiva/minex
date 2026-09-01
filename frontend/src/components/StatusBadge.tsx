import React from 'react';
import { StatusMaterial, StatusColaborador } from '../types';

interface StatusBadgeProps {
  status: StatusMaterial | StatusColaborador | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normStatus = status?.toUpperCase() || '';

  let bgClass = 'bg-slate-200 text-slate-800 border-slate-400';
  let labelText = normStatus;

  if (normStatus === 'DISPONIVEL' || normStatus === 'GUARDADO') {
    bgClass = 'bg-slate-200 text-slate-800 border-slate-400 font-semibold';
    labelText = 'DISPONÍVEL / GUARDADO';
  } else if (normStatus === 'EM_USO') {
    bgClass = 'bg-emerald-600 text-white border-emerald-500 font-extrabold shadow-sm';
    labelText = 'EM USO';
  } else if (normStatus === 'MANUTENCAO') {
    bgClass = 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-sm';
    labelText = 'MANUTENÇÃO';
  } else if (normStatus === 'ATIVO') {
    bgClass = 'bg-emerald-600 text-white border-emerald-500 font-bold';
    labelText = 'ATIVO';
  } else if (normStatus === 'INATIVO') {
    bgClass = 'bg-red-600 text-white border-red-500 font-bold';
    labelText = 'INATIVO';
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm font-bold'
  }[size];

  return (
    <span className={`inline-flex items-center justify-center border font-mono tracking-wider rounded-sm uppercase ${bgClass} ${sizeClasses}`}>
      STATUS: {labelText}
    </span>
  );
};
