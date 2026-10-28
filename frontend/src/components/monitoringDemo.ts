import { MonitoringSnapshot, MonitorPerson } from './monitoringModel';

// Presentation-only fixtures. Negative IDs never refer to operational records.
export function monitoringDemo(started: number): MonitoringSnapshot {
  const names = ['Rafael Souza', 'Ana Martins', 'Diego Santos', 'Marcos Oliveira', 'Bruno Lima', 'Camila Alves', 'Paulo Ribeiro', 'André Costa'];
  const roles = ['Operador de equipamentos', 'Técnica de manutenção', 'Resgate e emergência', 'Eletricista', 'Primeiros socorros', 'Técnica de segurança', 'Combate a incêndio', 'Operador de equipamentos'];
  const people: MonitorPerson[] = Array.from({ length: 25 }, (_, index) => ({
    acesso_id: -1001 - index, colaborador_id: -1001 - index,
    nome: names[index % 8] + (index >= 8 ? ` · Teste ${index + 1}` : ''), matricula: `DEMO-${1001 + index}`,
    cargo: roles[index % 8], setor: 'Demonstração', empresa: 'Empresa de demonstração', turma: ['A', 'B', 'C', 'D'][index % 4],
    foto_url: `/images/demonstracao-equipe.webp#portrait-${index % 8}`,
    entrada: new Date(started - (index < 4 ? (6 * 60 + 13 + index * 17) : (45 + index * 9)) * 60000).toISOString(),
    horario_inconsistente: false, brigadista: [2, 4, 6].includes(index),
    brigada_especialidade: [2, 4, 6].includes(index) ? roles[index] : '', brigada_validade: '2099-12-31', destino: 'Frente de trabalho · demonstração'
  }));
  return { horario_servidor: new Date(started).toISOString(), fuso_horario: 'America/Sao_Paulo', limite_segundos: 21600, inconsistencias: 0,
    colaboradores: people, brigadistas: { total: 5, na_mina: 3, fora_mina: 2, presentes: people.filter(person => person.brigadista).map(person => ({
      colaborador_id: person.colaborador_id, nome: person.nome, matricula: person.matricula, cargo: person.cargo, foto_url: person.foto_url,
      turma: person.turma, brigada_especialidade: person.brigada_especialidade || '', habilitacao: 'VIGENTE', na_mina: true, status: 'ATIVO'
    })) }
  };
}
