export interface Material {
  id: string;
  codigo: string;
  descricao: string;
  categoria: 'valvula' | 'atuador' | 'acessorio' | 'instrumento' | 'outro';
  localizacao: string;
  quantidade: number;
  unidade: string;
  dataEntrada: string;
  dataUltimaMovimentacao: string;
  observacoes?: string;
  status: 'disponivel' | 'reservado' | 'em_uso' | 'manutencao';
  responsavel?: string;
  lote?: string;
  numeroSerie?: string;
}

export interface Movimentacao {
  id: string;
  materialId: string;
  tipo: 'entrada' | 'saida' | 'transferencia';
  quantidade: number;
  data: string;
  origem?: string;
  destino?: string;
  responsavel: string;
  observacoes?: string;
}

export type CategoriaType = Material['categoria'];
export type StatusType = Material['status'];
export type TipoMovimentacaoType = Movimentacao['tipo'];

export const CATEGORIAS: Record<CategoriaType, string> = {
  valvula: 'Válvula',
  atuador: 'Atuador',
  acessorio: 'Acessório',
  instrumento: 'Instrumento',
  outro: 'Outro',
};

export const STATUS: Record<StatusType, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  em_uso: 'Em Uso',
  manutencao: 'Manutenção',
};

export const TIPOS_MOVIMENTACAO: Record<TipoMovimentacaoType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  transferencia: 'Transferência',
};
