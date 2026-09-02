import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, HardHat, Layers, QrCode } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { soundFX } from '../services/soundFX';
import { Usuario } from '../types';

interface LoginProps {
  onLoginSuccess: (user: Usuario, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div 
      className="min-h-screen w-screen flex items-center justify-center p-4 sm:p-6 bg-cover bg-center bg-no-repeat font-sans select-none relative overflow-y-auto"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(25, 8, 55, 0.88) 0%, rgba(51, 18, 116, 0.65) 50%, rgba(0, 0, 0, 0.85) 100%), url('/20250218LD0126.jpg')`
      }}
    >
      {/* Sombra sutil no fundo da tela */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* CONTAINER CENTRALIZADO EXPANDIDO (FRASE + CARD + INDICADORES + RODAPÉ) */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-2xl w-full my-auto py-6 space-y-7">
        
        {/* FRASE DE IMPACTO POSICIONADA DIRETAMENTE ACIMA DO CARD */}
        <motion.div 
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center px-4 max-w-md"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug font-['Outfit'] drop-shadow-md">
            A organização que mantém a operação acesa.
          </h2>
          <p className="text-xs text-white/75 font-normal mt-1 drop-shadow-sm">
            Gestão integrada de materiais da operação subterrânea
          </p>
        </motion.div>

        {/* CARD BRANCO SÓLIDO (COMPACTO E ELEGANTE) */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={error ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[390px] bg-white rounded-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-7 sm:p-8 relative overflow-hidden text-slate-900"
        >
          {/* TEXTURA DO TÚNEL ILUMINADO NO FUNDO DO CARD */}
          <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
            <svg className="w-[340px] h-[340px] text-slate-300" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="100,20 175,55 175,145 100,180 25,145 25,55" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="100,40 155,67 155,133 100,160 45,133 45,67" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="100,60 135,78 135,122 100,140 65,122 65,78" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="100,80 115,89 115,111 100,120 85,111 85,89" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          {/* CABEÇALHO DO CARD (Ícone + Casa da Lanterna + Título + Subtítulo) */}
          <div className="flex flex-col items-center text-center mb-6 relative z-10">
            
            {/* Ícone Iluminado da Lanterna */}
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-2 shadow-sm text-slate-800">
              <HardHat className="w-5 h-5 text-slate-800" />
            </div>

            <span className="text-sm font-semibold text-slate-900 tracking-tight font-['Outfit'] block">
              Casa da Lanterna
            </span>

            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-['Outfit'] mt-3 leading-snug">
              Bem-vindo à Casa da Lanterna
            </h1>
            
            <p className="text-xs text-slate-500 mt-1 font-normal">
              Acesse sua conta para continuar.
            </p>
          </div>

          {/* MENSAGEM DE ERRO */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* FORMULÁRIO */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            
            {/* CAMPO USUÁRIO */}
            <div className="space-y-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="USUÁRIO / MATRÍCULA"
                  autoFocus
                  className="w-full py-3.5 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* CAMPO SENHA */}
            <div className="space-y-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="SENHA ••••••••"
                  className="w-full py-3.5 pl-10 pr-10 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#331274] focus:ring-2 focus:ring-[#331274]/15 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* OPÇÕES */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300 text-[#331274] focus:ring-[#331274] accent-[#331274]"
                />
                <span className="text-slate-600">Lembrar acesso</span>
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Contate o Administrador de TI para redefinir sua senha.');
                }}
                className="font-medium text-slate-700 hover:text-[#331274] hover:underline transition-colors"
              >
                Esqueci minha senha
              </a>
            </div>

            {/* BOTÃO ENTRAR */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 bg-[#331274] hover:bg-[#43208C] text-white font-bold text-sm rounded-xl shadow-lg shadow-[#331274]/25 transition-all cursor-pointer disabled:opacity-60 tracking-wide mt-2 flex items-center justify-center gap-2"
            >
              <HardHat className="w-4 h-4" />
              <span>{loading ? 'Entrando...' : 'Entrar'}</span>
            </motion.button>
          </form>

          {/* ACESSO DE HOMOLOGAÇÃO */}
          <div className="mt-5 pt-3 border-t border-slate-100 text-center relative z-10">
            <div className="text-[11px] text-slate-400 font-normal">
              Acesso de teste:{' '}
              <button
                type="button"
                onClick={() => handleQuickLogin('999999', '123456')}
                className="text-slate-600 font-semibold hover:text-[#331274] hover:underline cursor-pointer ml-1"
              >
                Admin (999999)
              </button>
              <span className="mx-1.5 text-slate-300">•</span>
              <button
                type="button"
                onClick={() => handleQuickLogin('1001', '123456')}
                className="text-slate-600 font-semibold hover:text-[#331274] hover:underline cursor-pointer"
              >
                Operador (1001)
              </button>
            </div>
          </div>
        </motion.div>

        {/* INDICADORES INSTITUCIONAIS EXPANDIDOS E ESPAÇADOS ABAIXO DO CARD */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-[620px] grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 px-2 text-white"
        >
          {/* CONTROLE / Materiais */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/15 px-4 py-3.5 rounded-2xl shadow-lg hover:border-white/25 transition-all">
            <div className="w-9 h-9 rounded-xl bg-[#a78bfa]/20 text-[#a78bfa] flex items-center justify-center shrink-0">
              <HardHat className="w-4 h-4" />
            </div>
            <div className="text-left leading-none">
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">CONTROLE</p>
              <p className="text-xs sm:text-sm font-bold text-white tracking-tight mt-1">Materiais</p>
            </div>
          </div>

          {/* RASTREABILIDADE / Movimentações */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/15 px-4 py-3.5 rounded-2xl shadow-lg hover:border-white/25 transition-all">
            <div className="w-9 h-9 rounded-xl bg-[#a78bfa]/20 text-[#a78bfa] flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="text-left leading-none">
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">RASTREABILIDADE</p>
              <p className="text-xs sm:text-sm font-bold text-white tracking-tight mt-1">Movimentações</p>
            </div>
          </div>

          {/* OPERAÇÃO / Subterrânea */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/15 px-4 py-3.5 rounded-2xl shadow-lg hover:border-white/25 transition-all">
            <div className="w-9 h-9 rounded-xl bg-[#a78bfa]/20 text-[#a78bfa] flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="text-left leading-none">
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">OPERAÇÃO</p>
              <p className="text-xs sm:text-sm font-bold text-white tracking-tight mt-1">Subterrânea</p>
            </div>
          </div>
        </motion.div>

        {/* RODAPÉ COM COPYRIGHT E CRÉDITO "Dev by WP & EF" */}
        <div className="w-full text-center text-[11px] text-white/70 pt-1">
          <p>© {new Date().getFullYear()} Casa da Lanterna | Controle de Materiais de Mineração <span className="opacity-40 mx-1.5">|</span> <span className="font-semibold text-white/90">Dev by WP & EF</span></p>
        </div>

      </div>
    </div>
  );
};
