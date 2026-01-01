import { supabase } from '@/integrations/supabase/client';

const AUTH_KEY = 'imex_auth_user';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      return user.sessionToken || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

interface DataOperationResult<T = any> {
  success: boolean;
  error?: string;
  data?: T;
  count?: number;
}

async function invokeDataOperation<T = any>(
  action: string,
  params: Record<string, any> = {}
): Promise<DataOperationResult<T>> {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    return { success: false, error: 'Sessão expirada. Faça login novamente.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('data-operations', {
      body: { action, sessionToken, ...params },
    });

    if (error) {
      throw new Error(error.message || 'Erro ao executar operação');
    }

    return data as DataOperationResult<T>;
  } catch (err: any) {
    console.error(`Data operation ${action} failed:`, err);
    return { success: false, error: err.message || 'Erro desconhecido' };
  }
}

// ========== READ OPERATIONS ==========

export async function listFabricantes(): Promise<DataOperationResult> {
  return invokeDataOperation('fabricantes_list');
}

export async function listCatalogo(search?: string, limit?: number): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_list', { search, limit });
}

export async function getCatalogoDescricao(codigo: string): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_get', { codigo });
}

export async function checkCatalogoDuplicates(codigos: string[]): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_check_duplicates', { codigos });
}

export async function listEnderecos(search?: string, limit?: number): Promise<DataOperationResult> {
  return invokeDataOperation('enderecos_list', { search, limit });
}

export async function getEndereco(id: string): Promise<DataOperationResult> {
  return invokeDataOperation('enderecos_get', { id });
}

export async function listInventario(search?: string, limit?: number): Promise<DataOperationResult> {
  return invokeDataOperation('inventario_list', { search, limit });
}

export async function getInventarioByEndereco(endereco_material_id: string): Promise<DataOperationResult> {
  return invokeDataOperation('inventario_get', { endereco_material_id });
}

// ========== FABRICANTES ==========
export async function insertFabricante(nome: string, codigo: string): Promise<DataOperationResult> {
  return invokeDataOperation('fabricantes_insert', { nome, codigo });
}

export async function deleteFabricante(id: string): Promise<DataOperationResult> {
  return invokeDataOperation('fabricantes_delete', { id });
}

// ========== CATALOGO ==========
export async function insertCatalogo(codigo: string, descricao: string): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_insert', { codigo, descricao });
}

export async function upsertCatalogo(items: { codigo: string; descricao: string }[], overwrite: boolean): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_upsert', { items, overwrite });
}

export async function deleteCatalogo(id: string): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_delete', { id });
}

// ========== ENDERECOS MATERIAIS ==========
export interface EnderecoInsertParams {
  codigo: string;
  descricao: string;
  tipo_material: string;
  fabricante_id: string;
  peso: string;
  rua: string;
  coluna: string;
  nivel: string;
  posicao: string;
  comentario?: string;
}

export async function insertEndereco(params: EnderecoInsertParams): Promise<DataOperationResult> {
  return invokeDataOperation('enderecos_insert', params);
}

export async function deleteEndereco(id: string): Promise<DataOperationResult> {
  return invokeDataOperation('enderecos_delete', { id });
}

export async function updateEndereco(id: string, params: Partial<EnderecoInsertParams>): Promise<DataOperationResult> {
  return invokeDataOperation('enderecos_update', { id, ...params });
}

export async function toggleEnderecoAtivo(id: string, ativo: boolean): Promise<DataOperationResult> {
  return invokeDataOperation('enderecos_toggle_ativo', { id, ativo });
}

// ========== INVENTARIO ==========
export async function insertInventario(
  endereco_material_id: string,
  quantidade: string,
  comentario?: string
): Promise<DataOperationResult> {
  return invokeDataOperation('inventario_insert', { endereco_material_id, quantidade, comentario });
}

export async function updateInventario(
  id: string,
  quantidade: string,
  comentario?: string
): Promise<DataOperationResult> {
  return invokeDataOperation('inventario_update', { id, quantidade, comentario });
}

export async function deleteInventario(id: string): Promise<DataOperationResult> {
  return invokeDataOperation('inventario_delete', { id });
}

// ========== CATALOGO INATIVAR ==========
export async function toggleCatalogoAtivo(id: string, ativo: boolean): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_toggle_ativo', { id, ativo });
}

export async function updateCatalogo(id: string, codigo: string, descricao: string): Promise<DataOperationResult> {
  return invokeDataOperation('catalogo_update', { id, codigo, descricao });
}
