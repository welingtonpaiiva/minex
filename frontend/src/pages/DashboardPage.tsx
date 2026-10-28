import React from 'react';
import { DashboardAlertas } from '../components/DashboardAlertas';
import { canAccessMaterialOperations } from '../components/ui';
import { Usuario } from '../types';

export const DashboardPage: React.FC<{ user: Usuario }> = ({ user }) => {
  return (
    <div className="min-h-screen flex-1 flex flex-col bg-slate-100 text-slate-900 p-4 sm:p-8 overflow-y-auto select-none">
      <DashboardAlertas canRecordReturn={canAccessMaterialOperations(user.nivel_acesso)} />
    </div>
  );
};
