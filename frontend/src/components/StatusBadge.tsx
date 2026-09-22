import React from 'react';
import { StatusMaterial, StatusColaborador } from '../types';

interface StatusBadgeProps {
  status: StatusMaterial | StatusColaborador | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normStatus = status?.toUpperCase() || '';

  let bgClass = 'text-slate-500 font-semibold';
  let labelText = normStatus;

  if (normStatus === 'DISPONIVEL' || normStatus === 'GUARDADO') {
    bgClass = 'text-slate-500 font-extrabold';
    labelText = 'DISPONÍVEL / GUARDADO';
  } else if (normStatus === 'EM_USO') {
    bgClass = 'bg-emerald-100 text-emerald-800 font-extrabold rounded-full px-3 py-1';
    labelText = 'EM USO';
  } else if (normStatus === 'MANUTENCAO') {
    bgClass = 'bg-amber-100 text-amber-800 font-extrabold rounded-full px-3 py-1';
    labelText = 'MANUTENÇÃO';
  } else if (normStatus === 'ATIVO') {
    bgClass = 'bg-emerald-100 text-emerald-800 font-bold rounded-full px-3 py-1';
    labelText = 'ATIVO';
  } else if (normStatus === 'INATIVO') {
    bgClass = 'bg-red-100 text-red-800 font-bold rounded-full px-3 py-1';
    labelText = 'INATIVO';
  } else if (normStatus === 'EXTRAVIADO') {
    bgClass = 'bg-red-100 text-red-800 font-extrabold rounded-full px-3 py-1';
    labelText = 'EXTRAVIADO';
  }

  const sizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm font-bold'
  }[size];

  return (
    <span className={`inline-flex items-center justify-center font-mono tracking-wider uppercase ${bgClass} ${sizeClasses}`}>
      {labelText}
    </span>
  );
};
