export type NivelAcesso = 'ADMINISTRADOR' | 'SUPERVISOR' | 'OPERADOR' | 'OPERADOR_ESTOQUE' | 'CADASTRO' | 'CONSULTA';

export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  nivel_acesso: NivelAcesso;
}

export type StatusColaborador = 'ATIVO' | 'INATIVO';

export interface Colaborador {
  id: number;
  nome: string;
  matricula: string;
  setor?: string;
  cargo?: string;
  empresa?: string;
  turma?: string;
  brigadista?: boolean | number;
  brigada_especialidade?: string;
  brigada_validade?: string | null;
  foto_url?: string;
  nfc_id?: string | null;
  status: StatusColaborador;
  created_at?: string;
  updated_at?: string;
}

export type StatusMaterial = 'DISPONIVEL' | 'EM_USO' | 'MANUTENCAO' | 'AGUARDANDO_CONFERENCIA' | 'BLOQUEADO' | 'INATIVO';

export interface Categoria {
  id: number;
  nome: string;
  descricao?: string;
}

export interface Material {
  id: number;
  nome: string;
  codigo_interno: string;
  categoria_id?: number;
  categoria_nome?: string;
  foto_url?: string;
  status: StatusMaterial;
  observacao?: string;
  colaborador_id?: number;
  colaborador_nome?: string;
  colaborador_matricula?: string;
  data_hora_saida?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmprestimoAtivo {
  emprestimo_id: number;
  data_hora_saida: string;
  colaborador_id: number;
  colaborador_nome: string;
  colaborador_matricula: string;
  setor?: string;
  cargo?: string;
  material_id: number;
  material_nome: string;
  codigo_interno: string;
  categoria_nome?: string;
  operador_saida_nome?: string;
}

export type TipoMovimentacao = 'SAIDA' | 'ENTRADA' | 'MANUTENCAO';

export interface Movimentacao {
  id: number;
  material_id: number;
  material_codigo: string;
  material_nome: string;
  colaborador_id?: number;
  colaborador_nome: string;
  colaborador_matricula: string;
  operador_id: number;
  operador_nome: string;
  tipo: TipoMovimentacao;
  data_hora: string;
  observacao?: string;
}

export type SaidaStep = 'WAITING_NFC' | 'SCANNING_ITEMS' | 'CONFIRMING' | 'PROCESSING' | 'SUCCESS';

export type EntradaStep = 'WAITING_NFC' | 'LOADING_LOANS' | 'SCANNING_RETURNS' | 'CONFIRMING' | 'PROCESSING' | 'SUCCESS';

export type NivelAlertaTurno = 'NORMAL' | 'ATENCAO' | 'CRITICO';

export interface AlertaTurnoItem {
  emprestimo_id: number;
  data_hora_saida: string;
  colaborador_id: number;
  colaborador_nome: string;
  colaborador_matricula: string;
  setor?: string;
  cargo?: string;
  material_id: number;
  material_nome: string;
  codigo_interno: string;
  categoria_nome?: string;
  minutos_em_uso: number;
  horas_em_uso: number;
  tempo_formatado: string;
  nivel_alerta: NivelAlertaTurno;
  mensagem_alerta: string;
}

export interface ResumoAlertasTurno {
  totalEmUso: number;
  normalCount: number;
  atencaoCount: number;
  criticoCount: number;
  alertas: AlertaTurnoItem[];
}
export interface KitItem {
  foto_url?: string;
  id: number;
  nome: string;
  codigo_interno: string;
  status: string;
  categoria_nome?: string;
}

export interface Kit {
  id: number;
  nome: string;
  descricao?: string;
  status: string;
  criado_por_id?: number;
  criado_por_nome?: string;
  created_at: string;
  updated_at?: string;
  materiais: KitItem[];
  total_itens?: number;
}

export interface PendingReturnItem {
  foto_url?: string;
  emprestimo_id: number;
  colaborador_id: number;
  material_id: number;
  tipo: 'INDIVIDUAL' | 'QUANTIDADE';
  material_nome: string;
  codigo_interno: string;
  retirada: string;
  quantidade: number;
  kit_nome?: string;
}

export interface PendingReturnPerson extends Colaborador {
  primeira_retirada: string;
  total_itens: number;
  total_unidades: number;
  materiais: PendingReturnItem[];
}

export interface PendingReturns {
  horario_servidor?: string;
  items: PendingReturnPerson[];
  total: number;
  resumo: { pessoas: number; itens: number; unidades: number };
}
