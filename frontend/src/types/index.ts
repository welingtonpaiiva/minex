export type NivelAcesso = 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA';

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
  foto_url?: string;
  nfc_id?: string | null;
  status: StatusColaborador;
  created_at?: string;
  updated_at?: string;
}

export type StatusMaterial = 'DISPONIVEL' | 'EM_USO' | 'MANUTENCAO';

export interface Categoria {
  id: number;
  nome: string;
  descricao?: string;
}

export interface Material {
  id: number;
  nome: string;
  codigo_interno: string;
  codigo_barras: string;
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
  codigo_barras: string;
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
