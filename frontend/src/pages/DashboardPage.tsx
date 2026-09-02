import React from 'react';
import { DashboardAlertas } from '../components/DashboardAlertas';

export const DashboardPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col bg-slate-100 text-slate-900 p-4 sm:p-6 overflow-y-auto select-none min-h-screen">
      <DashboardAlertas />
    </div>
  );
};
