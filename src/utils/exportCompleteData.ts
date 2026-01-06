import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface ExportResult {
  success: boolean;
  error?: string;
}

// Formatação de data para Excel
function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Auth key for session token
const AUTH_KEY = 'auth_user';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    const userData = JSON.parse(stored);
    return userData.sessionToken || null;
  } catch {
    return null;
  }
}

export async function exportCompleteData(): Promise<ExportResult> {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return { success: false, error: 'Não autenticado. Faça login novamente.' };
    }

    // Call Edge Function to get all data (bypasses RLS with service role)
    const { data: result, error: invokeError } = await supabase.functions.invoke('data-operations', {
      body: {
        action: 'export_all_data',
        sessionToken,
      },
    });

    if (invokeError) {
      console.error('Edge function invoke error:', invokeError);
      return { success: false, error: invokeError.message || 'Erro ao chamar função de exportação' };
    }

    if (!result?.success) {
      return { success: false, error: result?.error || 'Erro ao buscar dados para exportação' };
    }

    const { data, errors } = result;

    // Check for any errors in individual queries
    if (errors?.catalogo) console.warn('Erro ao buscar catálogo:', errors.catalogo);
    if (errors?.enderecos) console.warn('Erro ao buscar endereços:', errors.enderecos);
    if (errors?.inventario) console.warn('Erro ao buscar inventário:', errors.inventario);
    if (errors?.fabricantes) console.warn('Erro ao buscar fabricantes:', errors.fabricantes);
    if (errors?.usuarios) console.warn('Erro ao buscar usuários:', errors.usuarios);
    if (errors?.logs) console.warn('Erro ao buscar logs:', errors.logs);

    // Preparar dados para cada aba (códigos como texto para manter zeros à esquerda)
    const catalogoData = (data.catalogo || []).map((item: any) => ({
      'Código': String(item.codigo), // Será formatado como texto na planilha
      'Descrição': item.descricao,
      'Ativo': item.ativo ? 'Sim' : 'Não',
      'Criado em': formatDate(item.created_at),
    }));

    const enderecosData = (data.enderecos || []).map((item: any) => ({
      'Código': String(item.codigo), // Mantém zeros à esquerda
      'Descrição': item.descricao,
      'Tipo Material': item.tipo_material,
      'Fabricante': item.fabricantes?.nome || 'N/A',
      'Peso (kg)': item.peso,
      'Rua': item.rua,
      'Coluna': item.coluna,
      'Nível': item.nivel,
      'Posição': item.posicao,
      'Endereço': `R${String(item.rua).padStart(2, '0')}.C${String(item.coluna).padStart(2, '0')}.N${String(item.nivel).padStart(2, '0')}.P${String(item.posicao).padStart(2, '0')}`,
      'Comentário': item.comentario || '',
      'Ativo': item.ativo ? 'Sim' : 'Não',
      'Inativado por': item.inativado_por || '',
      'Criado por': item.created_by,
      'Criado em': formatDate(item.created_at),
    }));

    const inventarioData = (data.inventario || []).map((item: any) => ({
      'Código': String(item.enderecos_materiais?.codigo || 'N/A'), // Mantém zeros à esquerda
      'Descrição': item.enderecos_materiais?.descricao || 'N/A',
      'Endereço': item.enderecos_materiais
        ? `R${String(item.enderecos_materiais.rua).padStart(2, '0')}.C${String(item.enderecos_materiais.coluna).padStart(2, '0')}.N${String(item.enderecos_materiais.nivel).padStart(2, '0')}.P${String(item.enderecos_materiais.posicao).padStart(2, '0')}`
        : 'N/A',
      'Quantidade': item.quantidade,
      'Contado por': item.contado_por,
      'Comentário': item.comentario || '',
      'Atualizado em': formatDate(item.updated_at),
      'Criado em': formatDate(item.created_at),
    }));

    const fabricantesData = (data.fabricantes || []).map((item: any) => ({
      'Nome': item.nome,
      'Cadastrado por': item.cadastrado_por || 'N/A',
      'Ativo': 'Sim',
      'Data Cadastro': formatDate(item.data_cadastro),
    }));

    const usuariosData = (data.usuarios || []).map((item: any) => ({
      'Nome': item.nome,
      'Email': item.email,
      'Tipo': item.tipo === 'admin' ? 'Administrador' : item.tipo === 'estoque' ? 'Estoque' : 'Usuário',
      'Status': item.status || (item.aprovado ? 'ativo' : 'pendente'),
      'Criado em': formatDate(item.created_at),
    }));

    const logsData = (data.logs || []).map((item: any) => ({
      'Usuário': item.user_nome,
      'Email': item.user_email,
      'Dispositivo': item.device_info || 'N/A',
      'Data/Hora': formatDate(item.logged_at),
    }));

    // Criar workbook
    const wb = XLSX.utils.book_new();

    // Função para forçar coluna como texto (mantém zeros à esquerda)
    const setColumnAsText = (ws: XLSX.WorkSheet, colIndex: number, rowCount: number) => {
      for (let r = 1; r <= rowCount; r++) { // Começa em 1 para pular header
        const cellRef = XLSX.utils.encode_cell({ r, c: colIndex });
        if (ws[cellRef]) {
          ws[cellRef].t = 's'; // Tipo texto
          ws[cellRef].z = '@'; // Formato texto
        }
      }
    };

    // Adicionar abas
    if (catalogoData.length > 0) {
      const wsCatalogo = XLSX.utils.json_to_sheet(catalogoData);
      setColumnAsText(wsCatalogo, 0, catalogoData.length); // Coluna Código
      XLSX.utils.book_append_sheet(wb, wsCatalogo, 'Catálogo');
    }

    if (enderecosData.length > 0) {
      const wsEnderecos = XLSX.utils.json_to_sheet(enderecosData);
      setColumnAsText(wsEnderecos, 0, enderecosData.length); // Coluna Código
      XLSX.utils.book_append_sheet(wb, wsEnderecos, 'Endereçamentos');
    }

    if (inventarioData.length > 0) {
      const wsInventario = XLSX.utils.json_to_sheet(inventarioData);
      setColumnAsText(wsInventario, 0, inventarioData.length); // Coluna Código
      XLSX.utils.book_append_sheet(wb, wsInventario, 'Inventário');
    }

    if (fabricantesData.length > 0) {
      const wsFabricantes = XLSX.utils.json_to_sheet(fabricantesData);
      XLSX.utils.book_append_sheet(wb, wsFabricantes, 'Fabricantes');
    }

    if (usuariosData.length > 0) {
      const wsUsuarios = XLSX.utils.json_to_sheet(usuariosData);
      XLSX.utils.book_append_sheet(wb, wsUsuarios, 'Usuários');
    }

    if (logsData.length > 0) {
      const wsLogs = XLSX.utils.json_to_sheet(logsData);
      XLSX.utils.book_append_sheet(wb, wsLogs, 'Logs de Acesso');
    }

    // Gerar arquivo e baixar
    const fileName = `backup_mrx_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    return { success: true };
  } catch (error: any) {
    console.error('Error exporting data:', error);
    return { success: false, error: error.message || 'Erro ao exportar dados' };
  }
}
