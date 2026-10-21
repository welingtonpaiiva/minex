import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { CursorFollower } from './components/CursorFollower';
import { motion, MotionConfig } from 'framer-motion';
import { Login } from './pages/Login';
import { MainMenu } from './pages/MainMenu';
import { Saida } from './pages/Saida';
import { Entrada } from './pages/Entrada';
import { Cadastro } from './pages/Cadastro';
import { Estoque } from './pages/Estoque';
import { Historico } from './pages/Historico';
import { Relatorios } from './pages/Relatorios';
import { DashboardPage } from './pages/DashboardPage';
import { Conformidade } from './pages/Conformidade';
import { Extravios } from './pages/Extravios';
import { Acessos } from './pages/Acessos';
import { Administracao } from './pages/Administracao';
import { Quantidades } from './pages/Quantidades';
import { Legado } from './pages/Legado';
import { MineAlert } from './components/MineAlert';
import { canOperate } from './components/ui';
import { Usuario } from './types';
import { api } from './services/api';

export default function App() {
  const [user, setUser] = useState<Usuario | null>(null), [loading, setLoading] = useState(true);
  const logout = () => { setUser(null); localStorage.removeItem('casa_da_lanterna_user'); localStorage.removeItem('casa_da_lanterna_token'); };
  useEffect(() => {
    if (!localStorage.getItem('casa_da_lanterna_token')) { setLoading(false); return; }
    api.get('/auth/me').then(res => setUser(res.data.user)).catch(logout).finally(() => setLoading(false));
  }, []);
  const login = (account: Usuario, token: string) => { localStorage.setItem('casa_da_lanterna_token', token); localStorage.setItem('casa_da_lanterna_user', JSON.stringify(account)); setUser(account); };
  if (loading) return <div className="app-loading">Carregando Casa da Lanterna…</div>;
  const operator = user && canOperate(user.nivel_acesso), manager = user && ['ADMINISTRADOR', 'SUPERVISOR'].includes(user.nivel_acesso);
  return <BrowserRouter><MotionConfig reducedMotion="user"><CursorFollower />{user ? <OperatorShell user={user} logout={logout}><Routes>
      <Route path="/" element={<MainMenu user={user} />} />
      <Route path="/saida" element={operator ? <Saida /> : <Navigate to="/" replace />} />
      <Route path="/entrada" element={operator ? <Entrada /> : <Navigate to="/" replace />} />
      <Route path="/acessos" element={<Acessos user={user} />} />
      <Route path="/cadastro" element={<Cadastro user={user} />} />
      <Route path="/estoque" element={<Estoque user={user} />} />
      <Route path="/quantidades" element={<Quantidades user={user} />} />
      <Route path="/historico" element={<Historico />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/conformidade" element={<Conformidade user={user} />} />
      <Route path="/extravios" element={<Extravios user={user} />} />
      <Route path="/administracao" element={manager ? <Administracao user={user} /> : <Navigate to="/" replace />} />
      <Route path="/legado" element={manager ? <Legado /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></OperatorShell> : <Routes><Route path="/login" element={<Login onLoginSuccess={login} />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>}</MotionConfig></BrowserRouter>;
}

function OperatorShell({user, logout, children}: {user: Usuario; logout: () => void; children: React.ReactNode}) {
  const location = useLocation();
  return <div className={'operator-shell ' + (location.pathname === '/' ? 'operator-home' : '')}>
    <TopBar user={user} onLogout={logout} />
    <MineAlert />
    <motion.main key={location.pathname} className="operator-content" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.2,ease:'easeOut'}}>{children}</motion.main>
  </div>;
}
