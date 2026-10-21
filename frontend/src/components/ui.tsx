import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, UserRound, X } from 'lucide-react';
import { api } from '../services/api';

export const labels: Record<string, string> = {
  CONFORME: 'Conforme', PENDENTE: 'Pendente', NAO_CONFORME: 'Não conforme', EM_ANALISE: 'Em análise',
  DISPONIVEL: 'Disponível', EM_USO: 'Em operação', MANUTENCAO: 'Manutenção', AGUARDANDO_CONFERENCIA: 'Aguardando conferência',
  BLOQUEADO: 'Bloqueado', INATIVO: 'Inativo', ATIVO: 'Ativo', DEVOLUCAO_ATRASADA: 'Devolução atrasada',
  EXTRAVIO_EM_APURACAO: 'Extravio em apuração', LOCALIZADO: 'Localizado', DEVOLVIDO: 'Devolvido', ENCERRADO: 'Encerrado', EM_OPERACAO: 'Em operação',
  ADMINISTRADOR: 'Administrador', SUPERVISOR: 'Supervisor', OPERADOR: 'Operador', OPERADOR_ESTOQUE: 'Operador de estoque', CADASTRO: 'Responsável por cadastros', CONSULTA: 'Consulta'
};
export function Badge({ value }: { value: string }) {
  const tone = ['CONFORME', 'DISPONIVEL', 'DEVOLVIDO', 'ATIVO', 'LOCALIZADO'].includes(value) ? 'good'
    : ['NAO_CONFORME', 'EXTRAVIO_EM_APURACAO', 'BLOQUEADO', 'INATIVO'].includes(value) ? 'bad'
    : ['PENDENTE', 'DEVOLUCAO_ATRASADA', 'AGUARDANDO_CONFERENCIA', 'MANUTENCAO'].includes(value) ? 'warn' : 'neutral';
  return <span className={`badge ${tone}`}>{labels[value] || value.replaceAll('_', ' ')}</span>;
}
export function Avatar({ src, name, large = false }: { src?: string; name: string; large?: boolean }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true, object = '';
    setUrl('');
    if (src?.startsWith('data:image/')) { setUrl(src); return; }
    if (src?.startsWith('/api/fotos/')) api.get(src.replace('/api', ''), { responseType: 'blob' }).then(res => {
      object = URL.createObjectURL(res.data); if (active) setUrl(object); else URL.revokeObjectURL(object);
    }).catch(() => {});
    return () => { active = false; if (object) URL.revokeObjectURL(object); };
  }, [src]);
  return <span className={`avatar ${large ? 'large' : ''}`}>{url ? <img src={url} alt={`Foto de ${name}`} onError={() => setUrl('')} /> : <UserRound aria-hidden="true" />}</span>;
}
export function Person({ person }: { person: any }) {
  return <div className="person"><Avatar name={person.nome} src={person.foto_url} /><div><strong>{person.nome}</strong><span>{person.matricula} · {person.setor || 'Setor não informado'}</span>{person.conformidade && <Badge value={person.conformidade} />}</div></div>;
}
export function Page({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="page"><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>{children}</div>;
}
export function Notice({ message, type = 'error' }: { message: string; type?: 'error' | 'success' }) { return message ? <div className={`notice ${type}`} role={type === 'error' ? 'alert' : 'status'}>{message}</div> : null; }
export function Empty({ children = 'Nenhum registro encontrado.' }: { children?: React.ReactNode }) { return <div className="empty">{children}</div>; }
export function Pager({ page, total, limit = 30, onChange }: { page: number; total: number; limit?: number; onChange: (page: number) => void }) {
  return <div className="pager"><span>{total} registro{total !== 1 ? 's' : ''} · Página {page} de {Math.max(1, Math.ceil(total / limit))}</span><div><button className="button secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={18} />Anterior</button><button className="button secondary" disabled={page * limit >= total} onClick={() => onChange(page + 1)}>Próxima<ChevronRight size={18} /></button></div></div>;
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="button icon secondary" type="button" aria-label="Fechar" onClick={onClose}><X size={20} /></button></header>{children}</section></div>;
}
export function Reload({ onClick, loading }: { onClick: () => void; loading?: boolean }) { return <button className="button secondary" onClick={onClick} disabled={loading}><RefreshCw size={18} className={loading ? 'spin' : ''} />Atualizar</button>; }
export const errorMessage = (error: any) => error.response?.data?.error || 'Não foi possível comunicar com o servidor. Tente novamente.';
export function dateTime(value?: string) {
  if (!value) return '—';
  // New API records use ISO. Historical unzoned dates came from São Paulo.
  const date = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + '-03:00');
  return Number.isNaN(date.getTime()) ? 'Data não disponível' : date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}
export const canOperate = (role: string) => ['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR', 'OPERADOR_ESTOQUE'].includes(role);
export const canRegister = (role: string) => ['ADMINISTRADOR', 'SUPERVISOR', 'CADASTRO'].includes(role);
