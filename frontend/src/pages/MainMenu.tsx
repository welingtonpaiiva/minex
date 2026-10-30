import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Archive, Boxes, ClipboardCheck, ClipboardList, DoorOpen, ExternalLink, FileText, Layers, LayoutList, Monitor, Shield, UsersRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { Usuario } from '../types';
import { canAccessMaterialOperations, canAccessRegistration, canAccessLegacy, canAccessReports } from '../components/ui';
import { useResource } from '../hooks/useResource';
import './MainMenu.css';

type Summary = { pessoas_com_materiais: number; unidades_conferencia: number; kits_prontos: number };

export function MainMenu({ user }: { user: Usuario }) {
  const navigate = useNavigate();
  const connection = useResource<{ conectado?: boolean }>('/operacao/status', {}, {});
  const summary = useResource<Summary | null>('/operacao/resumo', {}, null);
  const operator = canAccessMaterialOperations(user.nivel_acesso);
  const manager = ['ADMINISTRADOR', 'SUPERVISOR'].includes(user.nivel_acesso);
  const welcomeTitle = user.nivel_acesso === 'OPERADOR' ? 'Operador de Balcão' : user.nivel_acesso === 'OPERADOR_ESTOQUE' ? 'Operador de Estoque' : user.nome;
  const modules = [
    ...(canAccessRegistration(user.nivel_acesso) ? [{ to: '/cadastro', title: 'Cadastros', description: 'Pessoas, materiais e identificação NFC.', icon: ClipboardList }] : []),
    { to: '/estoque', title: 'Estoque & consultas', description: 'Disponibilidade, categorias e conferência.', icon: Boxes },
    { to: '/dashboard', title: 'Dashboard', description: 'Acompanhe a presença na mina.', icon: Monitor, external: true },
    ...(canAccessReports(user.nivel_acesso) ? [{ to: '/relatorios', title: 'Relatórios', description: 'Planilhas e relatórios da operação.', icon: FileText }] : []),
    { to: '/acessos', title: 'Acesso à mina', description: 'Entrada, saída e permanência de pessoas.', icon: DoorOpen },
    { to: '/operacoes', title: 'Operações', description: 'Extravios, quantidades e movimentações.', icon: LayoutList },
    ...(manager ? [{ to: '/administracao', title: 'Administração', description: 'Usuários, permissões e auditoria.', icon: Shield }] : []),
    ...(canAccessLegacy(user.nivel_acesso) ? [{ to: '/legado', title: 'Dados anteriores', description: 'Registros preservados na migração.', icon: Archive }] : [])
  ];
  const metrics = [
    { key: 'pessoas_com_materiais' as const, title: 'Pessoas com materiais', detail: 'Com devoluções em aberto', icon: UsersRound, tone: 'purple' },
    { key: 'unidades_conferencia' as const, title: 'Unidades em conferência', detail: 'Aguardando liberação no estoque', icon: ClipboardCheck, tone: 'amber' },
    { key: 'kits_prontos' as const, title: 'Kits prontos', detail: 'Montados e aguardando entrega', icon: Layers, tone: 'green' }
  ];

  return <div className="navigation-panel home-workspace">
    <header className="home-intro">
      <div><span className="home-eyebrow">BEM-VINDO</span><h2>{welcomeTitle}</h2><p>Controle rápido e seguro de equipamentos, materiais e kits.</p></div>
      <span role="status" className={'home-connection ' + (connection.error ? 'offline' : connection.data.conectado ? 'online' : 'waiting')}><i />{connection.error ? 'Sem comunicação com o servidor' : connection.data.conectado ? 'Sistema conectado' : 'Verificando conexão'}</span>
    </header>

    {operator && <section className="home-actions" aria-label="Atendimento no balcão">
      <motion.button className="home-operation withdrawal" whileHover={{ y: -2 }} whileTap={{ scale: .99 }} onClick={() => navigate('/saida')}>
        <span className="home-operation-icon"><ArrowUpRight size={30} /></span><div><span className="home-action-label">RETIRADA RÁPIDA</span><h3>SAÍDA DE MATERIAL</h3><p>Identifique o colaborador e entregue equipamentos, materiais ou kits.</p><span className="home-action-link">Iniciar retirada<ArrowRight size={17} /></span></div><span className="home-operation-arrow" aria-hidden="true"><ArrowRight /></span>
      </motion.button>
      <motion.button className="home-operation return" whileHover={{ y: -2 }} whileTap={{ scale: .99 }} onClick={() => navigate('/entrada')}>
        <span className="home-operation-icon"><ArrowDownLeft size={30} /></span><div><span className="home-action-label">DEVOLUÇÃO RÁPIDA</span><h3>ENTRADA DE MATERIAL</h3><p>Receba os materiais identificando o colaborador pelo NFC e selecionando os itens devolvidos.</p><span className="home-action-link">Ver pessoas e devoluções<ArrowRight size={17} /></span></div><span className="home-operation-arrow" aria-hidden="true"><ArrowRight /></span>
      </motion.button>
    </section>}

    <section className="home-modules"><div className="home-section-heading"><div><h3>Acesso aos módulos</h3><p>Consulte informações e organize a operação.</p></div>{summary.updated && !summary.error && <span>Resumo atualizado às {summary.updated}</span>}</div>
      <nav aria-label="Módulos do sistema" className={'home-module-grid' + (modules.length === 5 ? ' has-five' : '')}>{modules.map(({ to, title, description, icon: Icon, external }) =>
        <motion.a key={to} href={to} className="home-module" target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
          whileHover={{ y: -2 }} onClick={event => { if (!external && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(to); } }}>
          <span className="home-module-icon"><Icon size={23} /></span><div><h3>{title}</h3><p>{description}</p></div>{external ? <span className="home-module-external">NOVA ABA<ExternalLink size={13} aria-label="Abrir em nova aba" /></span> : <span className="home-module-arrow" aria-hidden="true"><ArrowRight size={20} /></span>}
        </motion.a>)}
      </nav>
    </section>
    <section className="home-metrics" aria-label="Resumo da operação">
      {metrics.map(({ key, title, detail, icon: Icon, tone }) => <article className={'home-metric ' + tone} key={key} aria-label={title}>
        <span className="home-metric-icon"><Icon size={22} /></span><div><span>{title}</span><strong>{summary.error ? '—' : summary.data ? summary.data[key] : '…'}</strong><small>{detail}</small></div>
      </article>)}
    </section>
    {summary.error && <p className="home-summary-error" role="alert">Não foi possível atualizar os contadores. Tente novamente em instantes.</p>}
    <footer className="home-footer"><span>© {new Date().getFullYear()} Casa da Lanterna | CMOC Brasil</span><span>Operação segura, pessoas protegidas, mineração que transforma.</span></footer>
  </div>;
}
