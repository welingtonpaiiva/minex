import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, HardHat, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Usuario } from '../types';

interface LoginProps {
  onLoginSuccess: (user: Usuario, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricula || !senha) {
      setError('Informe a matrícula e a senha');
      soundFX.playError();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/login', { matricula, senha });
      soundFX.playSuccess();
      onLoginSuccess(res.data.user, res.data.token);
      navigate('/');
    } catch (err: any) {
      soundFX.playError();
      setError(err.response?.data?.error || 'Erro ao realizar login. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (mat: string, pass: string) => {
    setMatricula(mat);
    setSenha(pass);
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-slate-100 p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white border-4 border-slate-300 rounded-sm shadow-xl p-6">
        {/* Cabeçalho do Sistema Corporativo */}
        <div className="text-center pb-6 mb-6 border-b-2 border-slate-200">
          <div className="w-16 h-16 bg-amber-500 text-slate-950 mx-auto rounded-sm flex items-center justify-center mb-3 shadow-md">
            <HardHat className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-wider uppercase font-mono">
            CASA DA LANTERNA
          </h1>
          <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1">
            SISTEMA DE CONTROLE DE MATERIAIS DE MINERAÇÃO
          </p>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mb-4 bg-red-50 border-2 border-red-400 text-red-700 p-3 rounded text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário Corporativo Tradicional */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              MATRÍCULA
            </label>
            <div className="relative">
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Digite sua matrícula"
                autoFocus
                className="input-industrial"
              />
              <User className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              SENHA
            </label>
            <div className="relative">
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                className="input-industrial"
              />
              <Lock className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 px-6 uppercase tracking-wider text-lg rounded-sm border-2 border-blue-500 cursor-pointer transition-colors shadow-md active:scale-[0.99] mt-6"
          >
            {loading ? 'AUTENTICANDO...' : 'ENTRAR'}
          </button>
        </form>

        {/* Opções Rápidas de Desenvolvimento */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-center">
          <span className="text-[11px] text-slate-500 font-bold uppercase block mb-2">
            Acesso Rápido de Homologação:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickLogin('999999', '123456')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-amber-700 text-xs font-mono font-bold py-2 border border-slate-300 rounded cursor-pointer"
            >
              ADMIN (999999)
            </button>
            <button
              onClick={() => handleQuickLogin('1001', '123456')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-blue-700 text-xs font-mono font-bold py-2 border border-slate-300 rounded cursor-pointer"
            >
              OPERADOR (1001)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
