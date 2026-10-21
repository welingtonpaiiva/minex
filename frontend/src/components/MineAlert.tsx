import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { Avatar, dateTime } from './ui';
export function MineAlert() {
  const { data, error, updated } = useResource<any>('/operacao/acessos', {}, { quantidade: 0, colaboradores: [] }, 15000);
  const [expanded, setExpanded] = useState(false);
  const alerts = data.colaboradores.filter((c: any) => c.excedido);
  if (!alerts.length && !error) return null;
  return <section className="mine-alert" aria-live="polite"><div className="mine-alert-heading"><AlertTriangle size={23} /><div><strong>ATENÇÃO — COLABORADORES HÁ MAIS DE 8 HORAS NA MINA</strong><p>{error ? 'Falha de comunicação. Os dados abaixo podem estar desatualizados.' : `${data.quantidade} colaborador(es) com permanência excedida.`} {updated && `Última atualização: ${updated}.`}</p></div><button className="button danger" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Recolher' : 'Ver colaboradores'}{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button></div>{expanded && <div className="alert-people">{alerts.map((c: any) => <div key={c.id} className="person"><Avatar name={c.nome} src={c.foto_url} /><div><strong>{c.nome}</strong><span>Entrada: {dateTime(c.entrada)} · {c.tempo}</span></div></div>)}<small>Alerta de apoio operacional. Siga os procedimentos oficiais de segurança da mina.</small></div>}</section>;
}
