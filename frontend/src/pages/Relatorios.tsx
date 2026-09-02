import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, FileSpreadsheet, FileCheck, Boxes, Wrench } from 'lucide-react';
import { api } from '../services/api';

export const Relatorios: React.FC = () => {
  const navigate = useNavigate();

  const [resumo, setResumo] = useState({
    totalMateriais: 0,
    disponiveis: 0,
    emUso: 0,
    manutencao: 0,
    totalColaboradoresAtivos: 0
  });

  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    carregarResumo();
  }, []);

  const carregarResumo = async () => {
    try {
      const res = await api.get('/relatorios/resumo');
      setResumo(res.data);
    } catch (err) {
      console.error('Erro ao carregar resumo:', err);
    }
  };

  const handleExportarExcel = async () => {
    setDownloading(true);
    try {
      const response = await api.get('/relatorios/excel', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_movimentacoes_casa_da_lanterna_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Erro ao gerar relatório Excel');
    } finally {
      setDownloading(false);
    }
  };

  const handleExportarPdf = async () => {
    setDownloading(true);
    try {
      const response = await api.get('/relatorios/pdf/em-uso', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      alert('Erro ao gerar relatório PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans select-none overflow-y-auto min-h-screen">
      <div className="max-w-[1380px] w-full mx-auto flex flex-col gap-6 flex-1">
        


        {/* CARDS DE KPIS DA OPERAÇÃO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">TOTAL DE MATERIAIS</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-[#331274] mt-1">{resumo.totalMateriais}</div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Unidades cadastradas</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#331274]/10 text-[#331274] flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">MATERIAIS EM USO</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-[#331274] mt-1">{resumo.emUso}</div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Em posse na mina</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#331274]/10 text-[#331274] flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">DISPONÍVEIS BALCÃO</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-emerald-700 mt-1">{resumo.disponiveis}</div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Prontos para saída</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider font-['Outfit']">EM MANUTENÇÃO</span>
              <div className="text-3xl font-extrabold font-['Outfit'] text-amber-700 mt-1">{resumo.manutencao}</div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Em reparo técnico</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* OPÇÕES DE EXPORTAÇÃO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* EXPORTAR EXCEL */}
          <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-emerald-700">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#331274] uppercase tracking-tight font-['Outfit']">
                    Relatório Completo em Excel (.xlsx)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                    Exporta todo o histórico de movimentações (Entradas, Saídas e Manutenções) com dados detalhados.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleExportarExcel}
              disabled={downloading}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-4 uppercase tracking-wider text-xs sm:text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'GERANDO EXCEL...' : 'BAIXAR PLANILHA EXCEL'}</span>
            </button>
          </div>

          {/* EXPORTAR PDF */}
          <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-[#331274]/10 p-4 rounded-2xl border border-[#331274]/20 text-[#331274]">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#331274] uppercase tracking-tight font-['Outfit']">
                    Relatório em PDF — Materiais em Uso
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                    Gera um documento PDF oficial contendo a lista atualizada de materiais em uso e responsáveis.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleExportarPdf}
              disabled={downloading}
              className="w-full mt-6 bg-[#331274] hover:bg-[#43208C] disabled:opacity-50 text-white font-extrabold py-4 uppercase tracking-wider text-xs sm:text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'GERANDO PDF...' : 'BAIXAR RELATÓRIO PDF'}</span>
            </button>
          </div>

        </div>

        {/* RODAPÉ INSTITUCIONAL */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-sans shrink-0">
          <p>© {new Date().getFullYear()} Casa da Lanterna | Controle de Materiais de Mineração</p>
          <p><span className="opacity-40 mx-1.5">|</span> <span className="font-semibold text-slate-700">Dev by WP & EF</span></p>
        </div>

      </div>
    </div>
  );
};
