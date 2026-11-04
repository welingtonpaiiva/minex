import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { useElapsedClock } from '../hooks/useElapsedClock';
import { materialHoldingTime } from '../utils/materialHoldingTime';
import { Avatar } from './ui';
import './MaterialHoldingAlert.css';

type HoldingPerson = { id: number; nome: string; matricula: string; foto_url: string; primeira_retirada: string | null; total_unidades: number };
type HoldingSnapshot = { horario_servidor?: string; colaboradores: HoldingPerson[] };

export function MaterialHoldingAlert() {
  const { data, error } = useResource<HoldingSnapshot>('/emprestimos/alertas-posse', {}, { colaboradores: [] }, 15000);
  const now = useElapsedClock(data.horario_servidor);
  const [expanded, setExpanded] = useState(true);
  const alerts = data.colaboradores.map(person => ({ ...person, time: materialHoldingTime(person.primeira_retirada, now) }))
    .filter(person => person.time.overdue).sort((a, b) => (b.time.seconds || 0) - (a.time.seconds || 0));
  if (!alerts.length && !error) return null;
  return <section className={'material-holding-alert' + (!alerts.length ? ' has-data-warning' : '')} aria-label="Alerta de materiais há mais de 8 horas" role="alert">
    <div className="material-holding-heading"><AlertTriangle size={24} /><div><strong>{alerts.length ? 'ATENÇÃO — MATERIAIS HÁ MAIS DE 8 HORAS COM O COLABORADOR' : 'NÃO FOI POSSÍVEL ATUALIZAR OS ALERTAS DE MATERIAIS'}</strong>
      <p>{error ? 'Os dados podem estar desatualizados. Tentando reconectar.' : `${alerts.length} colaborador(es) com materiais acima de 8 horas desde a retirada.`}</p></div>
      {alerts.length > 0 && <button className="button danger" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Recolher alerta de materiais' : 'Ver alerta de materiais'}{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>}</div>
    {expanded && alerts.length > 0 && <div className="material-holding-people">{alerts.map(person => <article key={person.id} aria-label={'Alerta de materiais de ' + person.nome}>
      <Avatar name={person.nome} src={person.foto_url} /><div><strong>{person.nome}</strong><span>{person.matricula} · {person.total_unidades} unidade(s) a devolver</span>
        <time aria-live="off" aria-label={'Tempo com materiais de ' + person.nome}>{person.time.label}</time></div></article>)}
      <p>Tempo desde a retirada mais antiga ainda pendente, sem somar horas simultâneas. <Link to="/entrada">Conferir pessoas e materiais</Link></p></div>}
  </section>;
}
