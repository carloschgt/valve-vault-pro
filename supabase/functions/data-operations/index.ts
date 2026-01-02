import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS configuration with origin validation
const ALLOWED_ORIGINS = [
  'https://bdetejjahokasedpghlp.lovableproject.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const LOVABLE_PATTERN = /^https:\/\/[a-z0-9-]+\.lovable\.app$/;
const LOVABLE_PROJECT_PATTERN = /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (LOVABLE_PATTERN.test(origin)) return true;
  if (LOVABLE_PROJECT_PATTERN.test(origin)) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

// Sanitize search term to prevent ILIKE pattern injection
function sanitizeSearchTerm(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') return '';
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);
  return cleaned.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// Verify session token and get user info
async function verifySession(supabase: any, sessionToken: string): Promise<{ 
  success: boolean; 
  error?: string; 
  user?: { id: string; email: string; nome: string; tipo: string } 
}> {
  if (!sessionToken) {
    return { success: false, error: 'Token de sessão não fornecido' };
  }

  // Validate session token against database
  const { data: session, error: sessionError } = await supabase
    .from("session_tokens")
    .select("user_id, user_email, expires_at")
    .eq("token", sessionToken)
    .maybeSingle();

  if (sessionError || !session) {
    console.log("Session token not found");
    return { success: false, error: 'Token inválido ou expirado' };
  }

  // Check if token is expired
  if (new Date(session.expires_at) < new Date()) {
    console.log("Session token expired");
    await supabase.from("session_tokens").delete().eq("token", sessionToken);
    return { success: false, error: 'Sessão expirada. Faça login novamente.' };
  }

  // Get user details
  const { data: usuario, error: findError } = await supabase
    .from("usuarios")
    .select("id, email, nome, tipo, aprovado")
    .eq("email", session.user_email.toLowerCase())
    .maybeSingle();

  if (findError || !usuario) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  if (!usuario.aprovado) {
    return { success: false, error: 'Usuário não aprovado' };
  }

  return { 
    success: true, 
    user: { 
      id: usuario.id, 
      email: usuario.email, 
      nome: usuario.nome, 
      tipo: usuario.tipo 
    } 
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin
  if (!isAllowedOrigin(origin)) {
    console.warn(`Rejected request from unauthorized origin: ${origin}`);
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, sessionToken, ...params } = await req.json();

    console.log(`Data operation: ${action}`);

    // Verify session for all operations
    const authResult = await verifySession(supabase, sessionToken);
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = authResult.user!;
    const isAdmin = user.tipo === 'admin';

    console.log(`User: ${user.email}, Admin: ${isAdmin}`);

    // ========== READ OPERATIONS (available to all authenticated users) ==========
    
    if (action === "fabricantes_list") {
      const { data, error } = await supabase
        .from("fabricantes")
        .select("*")
        .order("nome");
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "catalogo_list") {
      const { search, limit = 100 } = params;
      let query = supabase
        .from("catalogo_produtos")
        .select("*")
        .order("codigo");
      
      if (search) {
        const safeSearch = sanitizeSearchTerm(search);
        if (safeSearch) {
          query = query.or(`codigo.ilike.%${safeSearch}%,descricao.ilike.%${safeSearch}%`);
        }
      }
      
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "catalogo_get") {
      const { codigo } = params;
      const { data, error } = await supabase
        .from("catalogo_produtos")
        .select("descricao")
        .eq("codigo", codigo?.trim())
        .maybeSingle();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "catalogo_check_duplicates") {
      const { codigos } = params;
      const { data, error } = await supabase
        .from("catalogo_produtos")
        .select("codigo, descricao")
        .in("codigo", codigos);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "enderecos_list") {
      const { search, limit = 100 } = params;
      let query = supabase
        .from("enderecos_materiais")
        .select("*, fabricantes(nome)")
        .order("created_at", { ascending: false });
      
      if (search) {
        const safeSearch = sanitizeSearchTerm(search);
        if (safeSearch) {
          query = query.or(`codigo.ilike.%${safeSearch}%,descricao.ilike.%${safeSearch}%`);
        }
      }
      
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "enderecos_get") {
      const { id } = params;
      const { data, error } = await supabase
        .from("enderecos_materiais")
        .select("*, fabricantes(nome)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "inventario_list") {
      const { search, limit = 100 } = params;
      let query = supabase
        .from("inventario")
        .select("*, enderecos_materiais(codigo, descricao, rua, coluna, nivel, posicao)")
        .order("created_at", { ascending: false });
      
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      
      let result = data;
      if (search) {
        result = data?.filter((i: any) => 
          i.enderecos_materiais?.codigo?.toLowerCase().includes(search.toLowerCase()) ||
          i.enderecos_materiais?.descricao?.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "inventario_get") {
      const { endereco_material_id } = params;
      const { data, error } = await supabase
        .from("inventario")
        .select("*")
        .eq("endereco_material_id", endereco_material_id)
        .maybeSingle();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FABRICANTES ==========
    if (action === "fabricantes_insert") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem adicionar fabricantes' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { nome, codigo } = params;
      const { data, error } = await supabase
        .from("fabricantes")
        .insert({
          nome: nome.trim().toUpperCase(),
          codigo: codigo.trim().toUpperCase(),
          cadastrado_por: user.nome,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fabricantes_delete") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem excluir fabricantes' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id } = params;
      
      // Check if there are materials using this manufacturer
      const { data: materiaisVinculados, error: checkError } = await supabase
        .from("enderecos_materiais")
        .select("id")
        .eq("fabricante_id", id)
        .limit(1);
      
      if (checkError) throw checkError;
      
      if (materiaisVinculados && materiaisVinculados.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Não é possível excluir este fabricante pois existem materiais vinculados a ele. Remova os materiais primeiro.' 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { error } = await supabase.from("fabricantes").delete().eq("id", id);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CATALOGO PRODUTOS ==========
    if (action === "catalogo_insert") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem adicionar produtos' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { codigo, descricao } = params;
      const { data, error } = await supabase
        .from("catalogo_produtos")
        .insert({ 
          codigo: codigo.trim().toUpperCase(), 
          descricao: descricao.trim().toUpperCase(),
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "catalogo_upsert") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem importar produtos' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { items, overwrite } = params;
      
      if (overwrite) {
        const { error } = await supabase
          .from("catalogo_produtos")
          .upsert(items, { onConflict: 'codigo', ignoreDuplicates: false });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("catalogo_produtos")
          .insert(items);
        if (error) throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true, count: items.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "catalogo_delete") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem excluir produtos' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id } = params;
      const { error } = await supabase.from("catalogo_produtos").delete().eq("id", id);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ENDERECOS MATERIAIS ==========
    if (action === "enderecos_insert") {
      // Any approved user can add addresses
      const { codigo, descricao, tipo_material, fabricante_id, peso, rua, coluna, nivel, posicao, comentario } = params;
      
      const { data, error } = await supabase
        .from("enderecos_materiais")
        .insert({
          codigo: codigo.trim().toUpperCase(),
          descricao: descricao.trim().toUpperCase(),
          tipo_material,
          fabricante_id,
          peso: parseFloat(peso),
          rua: parseInt(rua),
          coluna: parseInt(coluna),
          nivel: parseInt(nivel),
          posicao: parseInt(posicao),
          comentario: comentario?.trim().toUpperCase() || null,
          created_by: user.nome,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "enderecos_delete") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem excluir endereços' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id } = params;
      // Delete related inventory first
      await supabase.from("inventario").delete().eq("endereco_material_id", id);
      const { error } = await supabase.from("enderecos_materiais").delete().eq("id", id);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INVENTARIO ==========
    if (action === "inventario_insert") {
      // Any approved user can create inventory counts
      const { endereco_material_id, quantidade, comentario } = params;
      
      const { data, error } = await supabase
        .from("inventario")
        .insert({
          endereco_material_id,
          quantidade: parseInt(quantidade),
          comentario: comentario?.trim() || null,
          contado_por: user.nome,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "inventario_update") {
      // Only admin can update existing counts
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem atualizar contagens existentes' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id, quantidade, comentario } = params;
      const { data, error } = await supabase
        .from("inventario")
        .update({
          quantidade: parseInt(quantidade),
          comentario: comentario?.trim() || null,
          contado_por: user.nome,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "inventario_delete") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem excluir contagens' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id } = params;
      const { error } = await supabase.from("inventario").delete().eq("id", id);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CLEAR TABLE (ADMIN ONLY) ==========
    if (action === "clear_table") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem limpar dados' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { table } = params;
      const allowedTables = ['fabricantes', 'catalogo_produtos', 'enderecos_materiais', 'inventario'];
      
      if (!allowedTables.includes(table)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tabela não permitida' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Para enderecos_materiais, primeiro deletar inventário relacionado
      if (table === 'enderecos_materiais') {
        await supabase.from("inventario").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      
      console.log(`Table ${table} cleared by ${user.email}`);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INATIVAR/ATIVAR ENDERECO ==========
    if (action === "enderecos_toggle_ativo") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem inativar/ativar endereços' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id, ativo } = params;
      const updateData: Record<string, any> = { ativo };
      
      if (!ativo) {
        updateData.inativado_por = user.nome;
        updateData.data_inativacao = new Date().toISOString();
      } else {
        updateData.inativado_por = null;
        updateData.data_inativacao = null;
      }

      const { data, error } = await supabase
        .from("enderecos_materiais")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ATUALIZAR ENDERECO ==========
    if (action === "enderecos_update") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem editar endereços' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id, codigo, descricao, tipo_material, fabricante_id, peso, rua, coluna, nivel, posicao, comentario } = params;
      
      const updateData: Record<string, any> = {};
      if (codigo !== undefined) updateData.codigo = codigo.trim().toUpperCase();
      if (descricao !== undefined) updateData.descricao = descricao.trim().toUpperCase();
      if (tipo_material !== undefined) updateData.tipo_material = tipo_material;
      if (fabricante_id !== undefined) updateData.fabricante_id = fabricante_id;
      if (peso !== undefined) updateData.peso = parseFloat(peso);
      if (rua !== undefined) updateData.rua = parseInt(rua);
      if (coluna !== undefined) updateData.coluna = parseInt(coluna);
      if (nivel !== undefined) updateData.nivel = parseInt(nivel);
      if (posicao !== undefined) updateData.posicao = parseInt(posicao);
      if (comentario !== undefined) updateData.comentario = comentario?.trim().toUpperCase() || null;

      const { data, error } = await supabase
        .from("enderecos_materiais")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INATIVAR/ATIVAR CATALOGO ==========
    if (action === "catalogo_toggle_ativo") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem inativar/ativar produtos' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id, ativo } = params;
      const updateData: Record<string, any> = { ativo };
      
      if (!ativo) {
        updateData.inativado_por = user.nome;
        updateData.data_inativacao = new Date().toISOString();
      } else {
        updateData.inativado_por = null;
        updateData.data_inativacao = null;
      }

      const { data, error } = await supabase
        .from("catalogo_produtos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ATUALIZAR CATALOGO ==========
    if (action === "catalogo_update") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem editar produtos' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id, codigo, descricao } = params;
      
      const updateData: Record<string, any> = {};
      if (codigo !== undefined) updateData.codigo = codigo.trim().toUpperCase();
      if (descricao !== undefined) updateData.descricao = descricao.trim().toUpperCase();

      const { data, error } = await supabase
        .from("catalogo_produtos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EXPORT ENDERECOS (ADMIN ONLY) ==========
    if (action === "enderecos_export") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem exportar dados' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("enderecos_materiais")
        .select("*, fabricantes(nome)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const formatted = (data || []).map((d: any) => ({
        id: d.id,
        codigo: d.codigo,
        descricao: d.descricao,
        tipo_material: d.tipo_material,
        fabricante_nome: d.fabricantes?.nome || 'N/A',
        peso: d.peso,
        rua: d.rua,
        coluna: d.coluna,
        nivel: d.nivel,
        posicao: d.posicao,
        created_by: d.created_by,
        created_at: d.created_at,
      }));
      
      return new Response(
        JSON.stringify({ success: true, data: formatted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EXPORT INVENTARIO (ADMIN ONLY) ==========
    if (action === "inventario_export") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem exportar dados' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("inventario")
        .select(`
          id,
          quantidade,
          contado_por,
          created_at,
          enderecos_materiais (
            codigo,
            descricao,
            peso,
            rua,
            coluna,
            nivel,
            posicao,
            fabricantes (nome)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const formatted = (data || []).map((d: any) => ({
        id: d.id,
        codigo: d.enderecos_materiais?.codigo || '',
        descricao: d.enderecos_materiais?.descricao || '',
        fabricante_nome: d.enderecos_materiais?.fabricantes?.nome || 'N/A',
        peso: d.enderecos_materiais?.peso || 0,
        rua: d.enderecos_materiais?.rua || 0,
        coluna: d.enderecos_materiais?.coluna || 0,
        nivel: d.enderecos_materiais?.nivel || 0,
        posicao: d.enderecos_materiais?.posicao || 0,
        quantidade: d.quantidade,
        contado_por: d.contado_por,
        data_contagem: d.created_at,
      }));
      
      return new Response(
        JSON.stringify({ success: true, data: formatted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ESTOQUE ATUAL (ADMIN ONLY) ==========
    if (action === "estoque_atual") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem acessar esta funcionalidade' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { search } = params;
      
      // Buscar inventário com quantidade > 0, ordenado por código e rua
      let query = supabase
        .from("inventario")
        .select(`
          id,
          quantidade,
          endereco_material_id,
          enderecos_materiais (
            id,
            codigo,
            descricao,
            tipo_material,
            rua,
            coluna,
            nivel,
            posicao
          )
        `)
        .gt("quantidade", 0);

      const { data: inventarioData, error: invError } = await query;
      
      if (invError) throw invError;

      // Filtrar por busca se fornecida
      let filteredData = inventarioData || [];
      if (search) {
        const safeSearch = sanitizeSearchTerm(search).toLowerCase();
        if (safeSearch) {
          filteredData = filteredData.filter((inv: any) => 
            inv.enderecos_materiais?.codigo?.toLowerCase().includes(safeSearch) ||
            inv.enderecos_materiais?.descricao?.toLowerCase().includes(safeSearch)
          );
        }
      }

      // Agrupar por código de material
      const grouped: Record<string, {
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
      }> = {};

      for (const inv of filteredData) {
        const mat = inv.enderecos_materiais as any;
        if (!mat) continue;

        const matCodigo = mat.codigo;
        if (!grouped[matCodigo]) {
          grouped[matCodigo] = {
            codigo: matCodigo,
            descricao: mat.descricao,
            tipo_material: mat.tipo_material,
            enderecos: [],
            qtd_total: 0,
          };
        }

        grouped[matCodigo].enderecos.push({
          rua: mat.rua,
          coluna: mat.coluna,
          nivel: mat.nivel,
          posicao: mat.posicao,
          quantidade: inv.quantidade,
          endereco_id: mat.id,
        });
        grouped[matCodigo].qtd_total += inv.quantidade;
      }

      // Converter para array e ordenar por código (menor para maior) e rua (menor para maior)
      const result = Object.values(grouped)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }))
        .map(item => ({
          ...item,
          enderecos: item.enderecos.sort((a, b) => a.rua - b.rua || a.coluna - b.coluna || a.nivel - b.nivel || a.posicao - b.posicao),
        }));

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ação inválida: ${action}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Data operation error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
