import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { Login } from './pages/Login';
import { MainMenu } from './pages/MainMenu';
import { Saida } from './pages/Saida';
import { Entrada } from './pages/Entrada';
import { Cadastro } from './pages/Cadastro';
import { Estoque } from './pages/Estoque';
import { Historico } from './pages/Historico';
import { Relatorios } from './pages/Relatorios';
import { Usuario } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('casa_da_lanterna_user');
    const token = localStorage.getItem('casa_da_lanterna_token');

    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      // Validar token com backend
      api
        .get('/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => handleLogout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLoginSuccess = (userData: Usuario, token: string) => {
    setUser(userData);
    localStorage.setItem('casa_da_lanterna_user', JSON.stringify(userData));
    localStorage.setItem('casa_da_lanterna_token', token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('casa_da_lanterna_user');
    localStorage.removeItem('casa_da_lanterna_token');
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-100 text-amber-600 font-mono font-bold text-xl uppercase">
        Carregando Casa da Lanterna...
      </div>
    );
  }

  return (
    <Router>
      <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden">
        {user && <TopBar user={user} onLogout={handleLogout} />}

        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route
              path="/login"
              element={!user ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/"
              element={user ? <MainMenu user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/saida"
              element={user ? <Saida /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/entrada"
              element={user ? <Entrada /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/cadastro"
              element={user ? <Cadastro user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/estoque"
              element={user ? <Estoque /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/historico"
              element={user ? <Historico /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/relatorios"
              element={user ? <Relatorios /> : <Navigate to="/login" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
