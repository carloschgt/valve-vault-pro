import * as XLSX from 'xlsx';

interface EstoqueItem {
  codigo: string;
  descricao: string;
  tipo_material: string;
  enderecos: {
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
    quantidade: number;
    endereco_id: string;
  }[];
  qtd_total: number;
}

/**
 * Exporta os dados de estoque para Excel com formatação profissional
 * incluindo bordas, cabeçalhos formatados e colunas auto-ajustadas
 */
export function exportEstoqueToExcel(estoque: EstoqueItem[]): void {
  // Preparar dados expandidos (uma linha por endereço)
  const rows: any[] = [];
  
  estoque.forEach((item) => {
    item.enderecos.forEach((end, idx) => {
      rows.push({
        'Código': item.codigo,
        'Descrição': item.descricao,
        'Tipo': item.tipo_material,
        'Rua': String(end.rua).padStart(2, '0'),
        'Coluna': String(end.coluna).padStart(2, '0'),
        'Nível': String(end.nivel).padStart(2, '0'),
        'Posição': String(end.posicao).padStart(2, '0'),
        'Quantidade': end.quantidade,
        'Total Geral': idx === 0 ? item.qtd_total : '',
      });
    });
  });

  // Criar workbook e worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Definir larguras das colunas
  const colWidths = [
    { wch: 12 },  // Código
    { wch: 60 },  // Descrição
    { wch: 10 },  // Tipo
    { wch: 6 },   // Rua
    { wch: 8 },   // Coluna
    { wch: 6 },   // Nível
    { wch: 8 },   // Posição
    { wch: 12 },  // Quantidade
    { wch: 12 },  // Total Geral
  ];
  ws['!cols'] = colWidths;

  // Definir range de dados
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Aplicar estilos de borda a todas as células
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { v: '', t: 's' };
      }
      
      // Adicionar borda
      ws[cellAddress].s = {
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
        alignment: { 
          vertical: 'center',
          horizontal: C >= 3 && C <= 7 ? 'center' : 'left',
        },
      };

      // Estilo especial para cabeçalho (primeira linha)
      if (R === 0) {
        ws[cellAddress].s = {
          ...ws[cellAddress].s,
          fill: { fgColor: { rgb: '4472C4' } },
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { vertical: 'center', horizontal: 'center' },
        };
      }

      // Estilo para coluna Total Geral
      if (C === 8 && R > 0) {
        ws[cellAddress].s = {
          ...ws[cellAddress].s,
          fill: { fgColor: { rgb: 'E2EFDA' } },
          font: { bold: true },
        };
      }
    }
  }

  // Adicionar a planilha ao workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Estoque Atual');

  // Gerar nome do arquivo com data
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  const filename = `Estoque_Atual_${dateStr}_${timeStr}.xlsx`;

  // Escrever arquivo com opções de formatação
  XLSX.writeFile(wb, filename, {
    bookType: 'xlsx',
    cellStyles: true,
  });
}
