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

export async function exportCompleteData(): Promise<ExportResult> {
  try {
    // Buscar todos os dados em paralelo
    const [
      catalogoResult,
      enderecosResult,
      inventarioResult,
      fabricantesResult,
      usuariosResult,
      logsResult,
    ] = await Promise.all([
      supabase.from('catalogo_produtos').select('*').order('codigo'),
      supabase.from('enderecos_materiais').select('*, fabricantes(nome)').order('created_at', { ascending: false }),
      supabase.from('inventario').select('*, enderecos_materiais(codigo, descricao, rua, coluna, nivel, posicao)').order('created_at', { ascending: false }),
      supabase.from('fabricantes').select('*').order('nome'),
      supabase.from('usuarios').select('id, nome, email, tipo, status, aprovado, created_at').order('nome'),
      supabase.from('login_logs').select('*').order('logged_at', { ascending: false }).limit(500),
    ]);

    // Verificar erros
    if (catalogoResult.error) throw new Error('Erro ao buscar catálogo: ' + catalogoResult.error.message);
    if (enderecosResult.error) throw new Error('Erro ao buscar endereços: ' + enderecosResult.error.message);
    if (inventarioResult.error) throw new Error('Erro ao buscar inventário: ' + inventarioResult.error.message);
    if (fabricantesResult.error) throw new Error('Erro ao buscar fabricantes: ' + fabricantesResult.error.message);
    if (usuariosResult.error) throw new Error('Erro ao buscar usuários: ' + usuariosResult.error.message);
    if (logsResult.error) throw new Error('Erro ao buscar logs: ' + logsResult.error.message);

    // Preparar dados para cada aba
    const catalogoData = (catalogoResult.data || []).map(item => ({
      'Código': item.codigo,
      'Descrição': item.descricao,
      'Ativo': item.ativo ? 'Sim' : 'Não',
      'Criado em': formatDate(item.created_at),
    }));

    const enderecosData = (enderecosResult.data || []).map(item => ({
      'Código': item.codigo,
      'Descrição': item.descricao,
      'Tipo Material': item.tipo_material,
      'Fabricante': (item as any).fabricantes?.nome || 'N/A',
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

    const inventarioData = (inventarioResult.data || []).map(item => ({
      'Código': (item as any).enderecos_materiais?.codigo || 'N/A',
      'Descrição': (item as any).enderecos_materiais?.descricao || 'N/A',
      'Endereço': (item as any).enderecos_materiais
        ? `R${String((item as any).enderecos_materiais.rua).padStart(2, '0')}.C${String((item as any).enderecos_materiais.coluna).padStart(2, '0')}.N${String((item as any).enderecos_materiais.nivel).padStart(2, '0')}.P${String((item as any).enderecos_materiais.posicao).padStart(2, '0')}`
        : 'N/A',
      'Quantidade': item.quantidade,
      'Contado por': item.contado_por,
      'Comentário': item.comentario || '',
      'Atualizado em': formatDate(item.updated_at),
      'Criado em': formatDate(item.created_at),
    }));

    const fabricantesData = (fabricantesResult.data || []).map(item => ({
      'Nome': item.nome,
      'Cadastrado por': item.cadastrado_por || 'N/A',
      'Ativo': 'Sim',
      'Data Cadastro': formatDate(item.data_cadastro),
    }));

    const usuariosData = (usuariosResult.data || []).map((item: any) => ({
      'Nome': item.nome,
      'Email': item.email,
      'Tipo': item.tipo === 'admin' ? 'Administrador' : item.tipo === 'estoque' ? 'Estoque' : 'Usuário',
      'Status': item.status || (item.aprovado ? 'ativo' : 'pendente'),
      'Criado em': formatDate(item.created_at),
    }));

    const logsData = (logsResult.data || []).map(item => ({
      'Usuário': item.user_nome,
      'Email': item.user_email,
      'Dispositivo': item.device_info || 'N/A',
      'Data/Hora': formatDate(item.logged_at),
    }));

    // Criar workbook
    const wb = XLSX.utils.book_new();

    // Adicionar abas
    if (catalogoData.length > 0) {
      const wsCatalogo = XLSX.utils.json_to_sheet(catalogoData);
      XLSX.utils.book_append_sheet(wb, wsCatalogo, 'Catálogo');
    }

    if (enderecosData.length > 0) {
      const wsEnderecos = XLSX.utils.json_to_sheet(enderecosData);
      XLSX.utils.book_append_sheet(wb, wsEnderecos, 'Endereçamentos');
    }

    if (inventarioData.length > 0) {
      const wsInventario = XLSX.utils.json_to_sheet(inventarioData);
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
