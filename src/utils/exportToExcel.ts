import type { Material, Movimentacao } from '@/types/material';
import { CATEGORIAS, STATUS, TIPOS_MOVIMENTACAO } from '@/types/material';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeCSV(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const stringValue = String(value);
  if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function exportMateriaisToCSV(materiais: Material[]): void {
  const headers = [
    'Código',
    'Descrição',
    'Categoria',
    'Localização',
    'Quantidade',
    'Unidade',
    'Status',
    'Data de Entrada',
    'Última Movimentação',
    'Responsável',
    'Lote',
    'Número de Série',
    'Observações',
  ];

  const rows = materiais.map((m) => [
    escapeCSV(m.codigo),
    escapeCSV(m.descricao),
    escapeCSV(CATEGORIAS[m.categoria]),
    escapeCSV(m.localizacao),
    m.quantidade,
    escapeCSV(m.unidade),
    escapeCSV(STATUS[m.status]),
    formatDate(m.dataEntrada),
    formatDate(m.dataUltimaMovimentacao),
    escapeCSV(m.responsavel),
    escapeCSV(m.lote),
    escapeCSV(m.numeroSerie),
    escapeCSV(m.observacoes),
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.join(';')),
  ].join('\n');

  // Adiciona BOM para suporte a caracteres especiais no Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `materiais_mrx_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportMovimentacoesToCSV(
  movimentacoes: Movimentacao[],
  materiais: Material[]
): void {
  const headers = [
    'Data',
    'Tipo',
    'Código Material',
    'Descrição Material',
    'Quantidade',
    'Origem',
    'Destino',
    'Responsável',
    'Observações',
  ];

  const rows = movimentacoes.map((mov) => {
    const material = materiais.find((m) => m.id === mov.materialId);
    return [
      formatDate(mov.data),
      escapeCSV(TIPOS_MOVIMENTACAO[mov.tipo]),
      escapeCSV(material?.codigo || 'N/A'),
      escapeCSV(material?.descricao || 'Material não encontrado'),
      mov.quantidade,
      escapeCSV(mov.origem),
      escapeCSV(mov.destino),
      escapeCSV(mov.responsavel),
      escapeCSV(mov.observacoes),
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.join(';')),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `movimentacoes_mrx_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
