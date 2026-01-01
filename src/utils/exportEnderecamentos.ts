interface EnderecoMaterial {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: string;
  fabricante_nome?: string;
  peso: number;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  created_by: string;
  created_at: string;
}

interface InventarioItem {
  id: string;
  codigo: string;
  descricao: string;
  fabricante_nome?: string;
  peso: number;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  quantidade: number;
  contado_por: string;
  data_contagem: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeCSV(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const stringValue = String(value);
  if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Remove accents for better Excel compatibility
function removeAccents(str: string | undefined | null): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function exportEnderecamentosToCSV(dados: EnderecoMaterial[]): void {
  const headers = [
    'Codigo',
    'Descricao',
    'Tipo Material',
    'Fabricante',
    'Peso (kg)',
    'Rua',
    'Coluna',
    'Nivel',
    'Posicao',
    'Cadastrado Por',
    'Data Cadastro',
  ];

  const rows = dados.map((d) => [
    escapeCSV(d.codigo),
    escapeCSV(removeAccents(d.descricao)),
    escapeCSV(removeAccents(d.tipo_material)),
    escapeCSV(removeAccents(d.fabricante_nome || 'N/A')),
    d.peso,
    d.rua,
    d.coluna,
    d.nivel,
    d.posicao,
    escapeCSV(removeAccents(d.created_by)),
    formatDate(d.created_at),
  ]);

  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `enderecamentos_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportInventarioToCSV(dados: InventarioItem[]): void {
  const headers = [
    'Codigo',
    'Descricao',
    'Fabricante',
    'Peso (kg)',
    'Rua',
    'Coluna',
    'Nivel',
    'Posicao',
    'Quantidade',
    'Contado Por',
    'Data Contagem',
  ];

  const rows = dados.map((d) => [
    escapeCSV(d.codigo),
    escapeCSV(removeAccents(d.descricao)),
    escapeCSV(removeAccents(d.fabricante_nome || 'N/A')),
    d.peso,
    d.rua,
    d.coluna,
    d.nivel,
    d.posicao,
    d.quantidade,
    escapeCSV(removeAccents(d.contado_por)),
    formatDate(d.data_contagem),
  ]);

  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
