import { useEffect, useRef } from 'react';
import { ExternalLink, ShieldPlus } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { useMonitoringPhotos } from '../hooks/useMineMonitoring';
import { Modal, dateTime } from './ui';
import { MonitorPerson } from './monitoringModel';
import { MonitoringPortrait } from './MonitoringPortrait';

interface ProfileData {
  colaborador: { id: number; nome: string; matricula: string; cargo: string; setor: string; empresa: string; turma: string; status: string; foto_url: string; brigadista: boolean; brigada_especialidade?: string; brigada_validade?: string | null };
  acesso_ativo: { id: number; entrada: string | null; destino: string; origem?: string; possui_mascara_fuga?: boolean } | null;
  historico: { id: number; entrada: string | null; saida: string | null; destino: string; em_aberto: boolean }[];
}

function ProfileDetails({ data, onOpenAccess, demo = false }: { data: ProfileData; onOpenAccess?: () => void; demo?: boolean }) {
  const person = data.colaborador;
  const photo = useMonitoringPhotos([person.foto_url]);
  return <div className="mine-profile">
    {data.acesso_ativo?.possui_mascara_fuga && <p className="summary-note">Máscara de fuga em posse. A presença na mina é mantida até a devolução da máscara e o encerramento de eventual acesso manual.</p>}
    {demo && <p className="mine-profile-demo">DADOS DE TESTE · Pessoa e fotografia fictícias. Nenhum acesso real será alterado.</p>}
    <div className="mine-profile-identity"><MonitoringPortrait name={person.nome} src={photo(person.foto_url)} /><div><span className={'mine-profile-presence ' + (data.acesso_ativo ? 'inside' : '')}>{data.acesso_ativo ? 'NA MINA' : 'FORA DA MINA'}</span><h3>{person.nome}</h3><p>{person.cargo || 'Função não informada'}</p><p>Matrícula: <strong>{person.matricula}</strong></p></div></div>
    <dl className="mine-profile-fields">{[['Empresa', person.empresa], ['Turma', person.turma], ['Setor', person.setor], ['Cadastro', person.status], ['Entrada atual', data.acesso_ativo ? dateTime(data.acesso_ativo.entrada || undefined) : 'Sem acesso em aberto'], ['Destino', data.acesso_ativo?.destino]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Não informado'}</dd></div>)}</dl>
    {person.brigadista && <div className="mine-profile-brigade"><ShieldPlus size={22} /><div><strong>Integrante da brigada</strong><p>{person.brigada_especialidade || 'Especialidade não informada'} · Validade: {person.brigada_validade ? person.brigada_validade.split('-').reverse().join('/') : 'não informada'}</p></div></div>}
    <section className="mine-profile-history"><h3>Últimos acessos à mina</h3>{data.historico.length ? <ol>{data.historico.map(entry => <li key={entry.id}><div><strong>Entrada: {dateTime(entry.entrada || undefined)}</strong><span>{entry.em_aberto ? 'Dentro da mina' : 'Saída: ' + dateTime(entry.saida || undefined)}</span></div><p>{entry.destino || 'Destino não informado'}</p></li>)}</ol> : <p>Nenhum acesso registrado.</p>}</section>
    {onOpenAccess && !demo && <div className="form-actions"><button type="button" className="button primary" onClick={onOpenAccess}>Ver em Acesso à Mina<ExternalLink size={16} /></button></div>}
  </div>;
}

function RealProfile({ personId, onOpenAccess }: { personId: number; onOpenAccess?: () => void }) {
  const profile = useResource<ProfileData | null>('/operacao/monitoramento/perfil/' + personId, {}, null, 10000);
  return <>{profile.error && <p className="notice error" role="alert">{profile.error}</p>}{profile.data ? <ProfileDetails data={profile.data} onOpenAccess={onOpenAccess} /> : <p className="empty">{profile.loading ? 'Consultando perfil e acessos…' : 'Perfil indisponível.'}</p>}</>;
}

export function MonitoringProfile({ personId, demoPerson, onClose, onOpenAccess }: { personId: number; demoPerson?: MonitorPerson; onClose: () => void; onOpenAccess?: () => void }) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = content.current?.closest('[role="dialog"]');
    (modal?.querySelector('button') as HTMLButtonElement | null)?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !modal) return;
      const elements = Array.from(modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'));
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    modal?.addEventListener('keydown', trap as EventListener);
    return () => { modal?.removeEventListener('keydown', trap as EventListener); previous?.focus(); };
  }, []);
  const data: ProfileData | null = demoPerson ? { colaborador: { ...demoPerson, id: demoPerson.colaborador_id, status: 'ATIVO' },
    acesso_ativo: { id: demoPerson.acesso_id, entrada: demoPerson.entrada, destino: demoPerson.destino || '' },
    historico: [{ id: demoPerson.acesso_id, entrada: demoPerson.entrada, saida: null, destino: demoPerson.destino || '', em_aberto: true }] } : null;
  return <Modal title="Perfil do colaborador" onClose={onClose}><div ref={content}>{data ? <ProfileDetails data={data} demo /> : <RealProfile personId={personId} onOpenAccess={onOpenAccess} />}</div></Modal>;
}
