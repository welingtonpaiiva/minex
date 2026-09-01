import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, FileSpreadsheet, FileCheck, Boxes, Users, ShieldAlert } from 'lucide-react';
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
    <div className="flex-1 flex flex-col bg-slate-100 p-4 overflow-hidden select-none">
      {/* Topo / Voltar */}
      <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-300 mb-6 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded border border-slate-300 font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>VOLTAR</span>
          </button>
          <h2 className="text-xl font-extrabold text-blue-700 uppercase tracking-wider font-mono flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            RELATÓRIOS E EXPORTAÇÃO DE DADOS
          </h2>
        </div>
      </div>

      {/* Grid de Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-white border-2 border-slate-300 p-5 rounded shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase">TOTAL DE MATERIAIS:</span>
            <Boxes className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">{resumo.totalMateriais}</div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">Unidades individuais cadastradas</span>
        </div>

        <div className="bg-white border-2 border-emerald-300 p-5 rounded shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-emerald-700 uppercase">MATERIAIS EM USO:</span>
            <FileCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700 font-mono">{resumo.emUso}</div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">Em posse dos colaboradores na mina</span>
        </div>

        <div className="bg-white border-2 border-slate-300 p-5 rounded shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase">DISPONÍVEIS BALCÃO:</span>
            <Boxes className="w-6 h-6 text-slate-500" />
          </div>
          <div className="text-3xl font-black text-slate-800 font-mono">{resumo.disponiveis}</div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">Prontos para saída</span>
        </div>

        <div className="bg-white border-2 border-amber-300 p-5 rounded shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-amber-700 uppercase">EM MANUTENÇÃO:</span>
            <ShieldAlert className="w-6 h-6 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-700 font-mono">{resumo.manutencao}</div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">Aguardando/em reparo técnico</span>
        </div>
      </div>

      {/* Opções de Exportação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EXPORTAR EXCEL */}
        <div className="bg-white border-2 border-slate-300 p-6 rounded flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-emerald-50 p-3 rounded border border-emerald-300 text-emerald-700">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider font-mono">
                  RELATÓRIO COMPLETO EM EXCEL (.XLSX)
                </h3>
                <p className="text-xs text-slate-600">
                  Exporta todo o histórico de movimentações (Entradas, Saídas e Manutenções) com dados detalhados.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleExportarExcel}
            disabled={downloading}
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 uppercase tracking-wider text-base rounded border-2 border-emerald-500 cursor-pointer flex items-center justify-center gap-2 shadow-md"
          >
            <Download className="w-5 h-5" />
            <span>{downloading ? 'GERANDO EXCEL...' : 'BAIXAR PLANILHA EXCEL'}</span>
          </button>
        </div>

        {/* EXPORTAR PDF */}
        <div className="bg-white border-2 border-slate-300 p-6 rounded flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-50 p-3 rounded border border-blue-300 text-blue-700">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider font-mono">
                  RELATÓRIO EM PDF - MATERIAIS EM USO
                </h3>
                <p className="text-xs text-slate-600">
                  Gera um documento PDF oficial contendo a lista atualizada de materiais em uso e responsáveis.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleExportarPdf}
            disabled={downloading}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 uppercase tracking-wider text-base rounded border-2 border-blue-500 cursor-pointer flex items-center justify-center gap-2 shadow-md"
          >
            <Download className="w-5 h-5" />
            <span>{downloading ? 'GERANDO PDF...' : 'BAIXAR RELATÓRIO PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
