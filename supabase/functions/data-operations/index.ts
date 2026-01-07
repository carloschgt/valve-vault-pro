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
      // Return 200 with success: false so the client can handle the error properly
      return new Response(
        JSON.stringify({ success: false, error: authResult.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ success: true, data: data || [] }),
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
        .select("id, codigo, descricao, peso_kg, ativo")
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
        .eq("ativo", true)
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
        JSON.stringify({ success: true, data: data || [] }),
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

    // Verificar duplicidade de endereçamento
    if (action === "enderecos_check_duplicate") {
      const { codigo, rua, coluna, nivel, posicao } = params;
      const { data: existentes, error } = await supabase
        .from("enderecos_materiais")
        .select("id, codigo, descricao, rua, coluna, nivel, posicao")
        .eq("codigo", codigo?.trim().toUpperCase())
        .eq("rua", parseInt(rua))
        .eq("coluna", parseInt(coluna))
        .eq("nivel", parseInt(nivel))
        .eq("posicao", parseInt(posicao))
        .eq("ativo", true)
        .limit(1);
      
      if (error) throw error;
      // Retorna o primeiro registro encontrado ou null
      const data = existentes && existentes.length > 0 ? existentes[0] : null;
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
      
      let result = data || [];
      if (search) {
        result = result.filter((i: any) => 
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
      const { endereco_material_id, contagem_num } = params;
      
      // Get current active counting phase if not specified
      let targetContagem = contagem_num;
      if (!targetContagem) {
        const { data: config } = await supabase
          .from("inventario_config")
          .select("contagem_ativa")
          .single();
        targetContagem = config?.contagem_ativa || 1;
      }
      
      const { data, error } = await supabase
        .from("inventario")
        .select("*")
        .eq("endereco_material_id", endereco_material_id)
        .eq("contagem_num", targetContagem)
        .maybeSingle();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List distinct ruas for dropdown
    if (action === "enderecos_list_ruas") {
      const { data, error } = await supabase
        .from("enderecos_materiais")
        .select("rua")
        .eq("ativo", true);
      
      if (error) throw error;
      
      // Extract unique ruas and sort
      const ruasUnicas = [...new Set((data || []).map((d: any) => d.rua))].sort((a, b) => a - b);
      
      return new Response(
        JSON.stringify({ success: true, data: ruasUnicas }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List enderecos by rua with optional filters (coluna, nivel, posicao)
    if (action === "enderecos_list_by_rua") {
      const { rua, coluna, nivel, posicao } = params;
      
      if (!rua) {
        return new Response(
          JSON.stringify({ success: false, error: "Rua é obrigatória" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      let query = supabase
        .from("enderecos_materiais")
        .select("*, fabricantes(nome)")
        .eq("ativo", true)
        .eq("rua", parseInt(rua))
        .order("coluna", { ascending: true })
        .order("nivel", { ascending: true })
        .order("posicao", { ascending: true });
      
      if (coluna) {
        query = query.eq("coluna", parseInt(coluna));
      }
      if (nivel) {
        query = query.eq("nivel", parseInt(nivel));
      }
      if (posicao) {
        query = query.eq("posicao", parseInt(posicao));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Extract unique values for filter dropdowns
      const todasColunas = [...new Set((data || []).map((d: any) => d.coluna))].sort((a, b) => a - b);
      const todosNiveis = [...new Set((data || []).map((d: any) => d.nivel))].sort((a, b) => a - b);
      const todasPosicoes = [...new Set((data || []).map((d: any) => d.posicao))].sort((a, b) => a - b);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: data || [],
          filters: {
            colunas: todasColunas,
            niveis: todosNiveis,
            posicoes: todasPosicoes
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get filter options for a specific rua (without applying filters)
    if (action === "enderecos_get_rua_filters") {
      const { rua } = params;
      
      if (!rua) {
        return new Response(
          JSON.stringify({ success: false, error: "Rua é obrigatória" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("enderecos_materiais")
        .select("coluna, nivel, posicao")
        .eq("ativo", true)
        .eq("rua", parseInt(rua));
      
      if (error) throw error;
      
      const colunas = [...new Set((data || []).map((d: any) => d.coluna))].sort((a, b) => a - b);
      const niveis = [...new Set((data || []).map((d: any) => d.nivel))].sort((a, b) => a - b);
      const posicoes = [...new Set((data || []).map((d: any) => d.posicao))].sort((a, b) => a - b);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { colunas, niveis, posicoes }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inventory config
    if (action === "inventario_config_get") {
      const { data, error } = await supabase
        .from("inventario_config")
        .select("*")
        .single();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update inventory config (admin only)
    if (action === "inventario_config_update") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem alterar configurações' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { contagem_ativa, bloquear_visualizacao_estoque } = params;
      
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
        updated_by: user.nome
      };
      
      if (contagem_ativa !== undefined) {
        updateData.contagem_ativa = contagem_ativa;
      }
      
      if (bloquear_visualizacao_estoque !== undefined) {
        updateData.bloquear_visualizacao_estoque = bloquear_visualizacao_estoque;
      }
      
      const { data, error } = await supabase
        .from("inventario_config")
        .update(updateData)
        .eq("id", (await supabase.from("inventario_config").select("id").single()).data?.id)
        .select()
        .single();
      
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

      const { codigo, descricao, peso_kg } = params;
      const insertData: Record<string, any> = { 
        codigo: codigo.trim().toUpperCase(), 
        descricao: descricao.trim().toUpperCase(),
        ativo: true,
      };
      
      if (peso_kg !== undefined && peso_kg !== null && peso_kg !== '') {
        insertData.peso_kg = parseFloat(peso_kg);
      }
      
      const { data, error } = await supabase
        .from("catalogo_produtos")
        .insert(insertData)
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
      
      const codigoNorm = codigo?.trim().toUpperCase();
      const ruaNum = parseInt(rua);
      const colunaNum = parseInt(coluna);
      const nivelNum = parseInt(nivel);
      const posicaoNum = parseInt(posicao);
      
      // VERIFICAR DUPLICIDADE NO BACKEND antes de inserir
      const { data: existentes, error: checkError } = await supabase
        .from("enderecos_materiais")
        .select("id, codigo, descricao, rua, coluna, nivel, posicao")
        .eq("codigo", codigoNorm)
        .eq("rua", ruaNum)
        .eq("coluna", colunaNum)
        .eq("nivel", nivelNum)
        .eq("posicao", posicaoNum)
        .eq("ativo", true)
        .limit(1);
      
      if (checkError) {
        console.error("Erro ao verificar duplicidade:", checkError);
        throw checkError;
      }
      
      const existente = existentes && existentes.length > 0 ? existentes[0] : null;
      
      if (existente) {
        console.log("Duplicidade encontrada:", existente);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Este código já está cadastrado neste endereço (R${String(existente.rua).padStart(2, '0')}.C${String(existente.coluna).padStart(2, '0')}.N${String(existente.nivel).padStart(2, '0')}.P${String(existente.posicao).padStart(2, '0')}). Edite o registro existente.`,
            duplicateId: existente.id
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data, error } = await supabase
        .from("enderecos_materiais")
        .insert({
          codigo: codigoNorm,
          descricao: descricao.trim().toUpperCase(),
          tipo_material,
          fabricante_id,
          peso: parseFloat(peso),
          rua: ruaNum,
          coluna: colunaNum,
          nivel: nivelNum,
          posicao: posicaoNum,
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
      const { endereco_material_id, quantidade, comentario, contagem_num: requestedContagem } = params;
      
      // Get current active counting phase
      const { data: config } = await supabase
        .from("inventario_config")
        .select("contagem_ativa")
        .single();
      
      const contagemAtiva = config?.contagem_ativa || 1;
      const targetContagem = requestedContagem || contagemAtiva;
      
      // Non-admin users can only insert for active counting phase
      if (!isAdmin && targetContagem !== contagemAtiva) {
        return new Response(
          JSON.stringify({ success: false, error: `Somente contagem ${contagemAtiva} está ativa no momento` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Check if already exists for this material/phase (backend protection)
      const { data: existing } = await supabase
        .from("inventario")
        .select("id")
        .eq("endereco_material_id", endereco_material_id)
        .eq("contagem_num", targetContagem)
        .maybeSingle();
      
      if (existing) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Já existe uma contagem ${targetContagem} para este material. Use a opção de editar.`,
            existingId: existing.id
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data, error } = await supabase
        .from("inventario")
        .insert({
          endereco_material_id,
          quantidade: parseInt(quantidade),
          comentario: comentario?.trim() || null,
          contado_por: user.nome,
          contagem_num: targetContagem,
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          return new Response(
            JSON.stringify({ success: false, error: 'Já existe uma contagem para este material nesta fase.' }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }
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

      const { id, quantidade, comentario, motivo } = params;
      
      // Get current value for audit
      const { data: current } = await supabase
        .from("inventario")
        .select("quantidade")
        .eq("id", id)
        .single();
      
      const quantidadeAnterior = current?.quantidade || 0;
      const quantidadeNova = parseInt(quantidade);
      
      // Update inventory
      const { data, error } = await supabase
        .from("inventario")
        .update({
          quantidade: quantidadeNova,
          comentario: comentario?.trim() || null,
          contado_por: user.nome,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      
      // Create audit record if quantity changed
      if (quantidadeAnterior !== quantidadeNova) {
        await supabase
          .from("inventario_audit")
          .insert({
            inventario_id: id,
            quantidade_anterior: quantidadeAnterior,
            quantidade_nova: quantidadeNova,
            motivo: motivo?.trim() || 'Correção administrativa',
            editado_por: user.nome,
          });
      }
      
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

    // ========== GET TABLE COUNTS (ADMIN ONLY) ==========
    if (action === "get_table_counts") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem acessar esta informação' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [fabRes, catRes, endRes, invRes] = await Promise.all([
        supabase.from("fabricantes").select("id", { count: 'exact', head: true }),
        supabase.from("catalogo_produtos").select("id", { count: 'exact', head: true }),
        supabase.from("enderecos_materiais").select("id", { count: 'exact', head: true }),
        supabase.from("inventario").select("id", { count: 'exact', head: true }),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          counts: {
            fabricantes: fabRes.count || 0,
            catalogo_produtos: catRes.count || 0,
            enderecos_materiais: endRes.count || 0,
            inventario: invRes.count || 0,
          },
        }),
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

      const { id, codigo, descricao, peso_kg } = params;
      
      const updateData: Record<string, any> = {};
      if (codigo !== undefined) updateData.codigo = codigo.trim().toUpperCase();
      if (descricao !== undefined) updateData.descricao = descricao.trim().toUpperCase();
      if (peso_kg !== undefined && peso_kg !== null && peso_kg !== '') {
        updateData.peso_kg = parseFloat(peso_kg);
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

    // ========== ESTOQUE DETALHE (busca por QR Code) ==========
    if (action === "estoque_detalhe") {
      const { codigo, endereco } = params;

      if (!codigo) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código do material não fornecido' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar endereço do material com os atributos completos
      let enderecoQuery = supabase
        .from("enderecos_materiais")
        .select(`
          id,
          codigo,
          descricao,
          tipo_material,
          peso,
          rua,
          coluna,
          nivel,
          posicao,
          fabricante_id,
          fabricantes (nome)
        `)
        .eq("codigo", codigo)
        .eq("ativo", true);

      // Se tiver endereço específico no QR, filtrar por ele
      if (endereco) {
        // Parse do endereço formatado (ex: "01-02-03-04")
        const parts = endereco.split('-');
        if (parts.length === 4) {
          enderecoQuery = enderecoQuery
            .eq("rua", parseInt(parts[0]))
            .eq("coluna", parseInt(parts[1]))
            .eq("nivel", parseInt(parts[2]))
            .eq("posicao", parseInt(parts[3]));
        }
      }

      const { data: endData, error: endError } = await enderecoQuery.maybeSingle();
      
      if (endError) throw endError;

      if (!endData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Material não encontrado', data: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar quantidade no inventário
      const { data: invData, error: invError } = await supabase
        .from("inventario")
        .select("quantidade")
        .eq("endereco_material_id", endData.id)
        .maybeSingle();

      if (invError && invError.code !== 'PGRST116') throw invError;

      // Formatar endereço
      const enderecoFormatado = `${String(endData.rua).padStart(2, '0')}-${String(endData.coluna).padStart(2, '0')}-${String(endData.nivel).padStart(2, '0')}-${String(endData.posicao).padStart(2, '0')}`;

      const result = {
        codigo: endData.codigo,
        descricao: endData.descricao,
        tipo_material: endData.tipo_material,
        peso: endData.peso || 0,
        fabricante: (endData.fabricantes as any)?.nome || 'N/A',
        endereco: enderecoFormatado,
        rua: endData.rua,
        coluna: endData.coluna,
        nivel: endData.nivel,
        posicao: endData.posicao,
        quantidade: invData?.quantidade || 0,
        endereco_id: endData.id,
      };

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CONSULTA MATERIAL COM TODAS ALOCAÇÕES ==========
    if (action === "material_consulta") {
      const { codigo, endereco } = params;

      if (!codigo) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código do material não fornecido' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar todas as alocações desse código (ativas)
      const { data: todasAlocacoes, error: alocError } = await supabase
        .from("enderecos_materiais")
        .select(`
          id,
          codigo,
          descricao,
          tipo_material,
          peso,
          rua,
          coluna,
          nivel,
          posicao,
          fabricante_id,
          fabricantes (nome)
        `)
        .eq("codigo", codigo)
        .eq("ativo", true)
        .order("rua")
        .order("coluna")
        .order("nivel")
        .order("posicao");

      if (alocError) throw alocError;

      if (!todasAlocacoes || todasAlocacoes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Material não encontrado', data: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar inventário para todas as alocações
      const enderecoIds = todasAlocacoes.map(a => a.id);
      const { data: inventarioData, error: invError } = await supabase
        .from("inventario")
        .select("endereco_material_id, quantidade")
        .in("endereco_material_id", enderecoIds);

      if (invError && invError.code !== 'PGRST116') throw invError;

      // Criar mapa de quantidade por endereço
      const quantidadeMap = new Map<string, number>();
      (inventarioData || []).forEach((inv: any) => {
        quantidadeMap.set(inv.endereco_material_id, inv.quantidade || 0);
      });

      // Formatar alocações
      const alocacoes = todasAlocacoes.map((a: any) => {
        const enderecoFormatado = `${String(a.rua).padStart(2, '0')}-${String(a.coluna).padStart(2, '0')}-${String(a.nivel).padStart(2, '0')}-${String(a.posicao).padStart(2, '0')}`;
        return {
          id: a.id,
          endereco: enderecoFormatado,
          rua: a.rua,
          coluna: a.coluna,
          nivel: a.nivel,
          posicao: a.posicao,
          quantidade: quantidadeMap.get(a.id) || 0,
        };
      });

      // Determinar alocação principal (do QR escaneado)
      let alocacaoPrincipal = alocacoes[0];
      if (endereco) {
        // Parse do endereço formatado (ex: "01-02-03-04" ou "R01.C02.N03.P04")
        let parts = endereco.split('-');
        if (parts.length !== 4) {
          // Tentar formato R01.C02.N03.P04
          const match = endereco.match(/R?(\d+)\.?C?(\d+)\.?N?(\d+)\.?P?(\d+)/i);
          if (match) {
            parts = [match[1], match[2], match[3], match[4]];
          }
        }
        if (parts.length === 4) {
          const rua = parseInt(parts[0]);
          const coluna = parseInt(parts[1]);
          const nivel = parseInt(parts[2]);
          const posicao = parseInt(parts[3]);
          
          const found = alocacoes.find(a => 
            a.rua === rua && a.coluna === coluna && a.nivel === nivel && a.posicao === posicao
          );
          if (found) {
            alocacaoPrincipal = found;
          }
        }
      }

      // Dados do material (usar primeiro registro)
      const first = todasAlocacoes[0];
      
      const result = {
        codigo: first.codigo,
        descricao: first.descricao,
        tipo_material: first.tipo_material,
        peso: first.peso || 0,
        fabricante: (first.fabricantes as any)?.nome || 'N/A',
        alocacao_principal: alocacaoPrincipal,
        todas_alocacoes: alocacoes,
        total_alocacoes: alocacoes.length,
        quantidade_total: alocacoes.reduce((sum, a) => sum + a.quantidade, 0),
      };

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ADMIN LIST OPERATIONS ==========
    if (action === "admin_enderecos_list") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso restrito a administradores' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "admin_inventario_list") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso restrito a administradores' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { search, limit = 100 } = params;
      let query = supabase
        .from("inventario")
        .select("*, enderecos_materiais(codigo, descricao, rua, coluna, nivel, posicao, ativo, inativado_por)")
        .order("created_at", { ascending: false });
      
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      
      let result = data || [];
      if (search) {
        result = result.filter((i: any) => 
          i.enderecos_materiais?.codigo?.toLowerCase().includes(search.toLowerCase()) ||
          i.enderecos_materiais?.descricao?.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "admin_catalogo_list") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso restrito a administradores' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== MATERIAIS POR RUA ==========
    if (action === "materiais_por_rua") {
      const { rua } = params;
      
      if (!rua || isNaN(parseInt(rua))) {
        return new Response(
          JSON.stringify({ success: false, error: 'Número da rua inválido' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ruaNum = parseInt(rua);

      // Buscar todos os endereços na rua especificada
      const { data: enderecos, error: endError } = await supabase
        .from("enderecos_materiais")
        .select(`
          id,
          codigo,
          descricao,
          tipo_material,
          coluna,
          nivel,
          posicao,
          peso,
          fabricante_id,
          fabricantes (nome)
        `)
        .eq("rua", ruaNum)
        .eq("ativo", true)
        .order("coluna")
        .order("nivel")
        .order("posicao");

      if (endError) throw endError;

      // Buscar a configuração de contagem ativa
      const { data: configData } = await supabase
        .from("inventario_config")
        .select("contagem_ativa")
        .limit(1)
        .single();

      const contagemAtiva = configData?.contagem_ativa || 1;

      // Buscar inventário da contagem ativa para esses endereços
      const enderecoIds = (enderecos || []).map((e: any) => e.id);
      
      let inventarioMap: Record<string, number> = {};
      if (enderecoIds.length > 0) {
        const { data: invData } = await supabase
          .from("inventario")
          .select("endereco_material_id, quantidade")
          .in("endereco_material_id", enderecoIds)
          .eq("contagem_num", contagemAtiva);

        (invData || []).forEach((inv: any) => {
          inventarioMap[inv.endereco_material_id] = inv.quantidade;
        });
      }

      // Formatar resultado
      const result = (enderecos || []).map((e: any) => ({
        id: e.id,
        codigo: e.codigo,
        descricao: e.descricao,
        tipo_material: e.tipo_material,
        coluna: e.coluna,
        nivel: e.nivel,
        posicao: e.posicao,
        peso: e.peso,
        fabricante_nome: e.fabricantes?.nome || null,
        quantidade_inventario: inventarioMap[e.id] ?? null,
      }));

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INVENTARIO CONFIG BY RUA ==========
    
    // Get all rua configs
    if (action === "inventario_config_rua_list") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso restrito a administradores' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("inventario_config_rua")
        .select("*")
        .order("rua");
      
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert rua config (set contagem for specific rua)
    if (action === "inventario_config_rua_upsert") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem alterar configurações' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { rua, contagem_ativa } = params;
      
      const { data, error } = await supabase
        .from("inventario_config_rua")
        .upsert({ 
          rua: parseInt(rua), 
          contagem_ativa: parseInt(contagem_ativa),
          updated_by: user.nome 
        }, { onConflict: 'rua' })
        .select()
        .single();
      
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete rua config (revert to global config)
    if (action === "inventario_config_rua_delete") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem alterar configurações' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { rua } = params;
      const { error } = await supabase
        .from("inventario_config_rua")
        .delete()
        .eq("rua", parseInt(rua));
      
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INVENTARIO SELECAO (Item selection for counting) ==========
    
    // List selections for a contagem
    if (action === "inventario_selecao_list") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso restrito a administradores' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { contagem_num, rua } = params;
      
      let query = supabase
        .from("inventario_selecao")
        .select(`
          *,
          enderecos_materiais (
            codigo,
            descricao,
            rua,
            coluna,
            nivel,
            posicao,
            fabricantes (nome)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (contagem_num) {
        query = query.eq("contagem_num", parseInt(contagem_num));
      }
      if (rua) {
        query = query.eq("rua", parseInt(rua));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add items to selection
    if (action === "inventario_selecao_add") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem selecionar itens' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { endereco_material_ids, contagem_num, rua } = params;
      
      if (!endereco_material_ids || !Array.isArray(endereco_material_ids) || endereco_material_ids.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'IDs dos materiais são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const insertData = endereco_material_ids.map((id: string) => ({
        endereco_material_id: id,
        contagem_num: parseInt(contagem_num),
        rua: parseInt(rua),
        created_by: user.nome
      }));

      const { data, error } = await supabase
        .from("inventario_selecao")
        .upsert(insertData, { onConflict: 'endereco_material_id,contagem_num', ignoreDuplicates: true })
        .select();
      
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data, count: insertData.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove item from selection
    if (action === "inventario_selecao_remove") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem remover itens' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id, endereco_material_id, contagem_num } = params;
      
      if (id) {
        const { error } = await supabase
          .from("inventario_selecao")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } else if (endereco_material_id && contagem_num) {
        const { error } = await supabase
          .from("inventario_selecao")
          .delete()
          .eq("endereco_material_id", endereco_material_id)
          .eq("contagem_num", parseInt(contagem_num));
        if (error) throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear all selections for a contagem/rua
    if (action === "inventario_selecao_clear") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem limpar seleções' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { contagem_num, rua } = params;
      
      let query = supabase.from("inventario_selecao").delete();
      
      if (contagem_num) {
        query = query.eq("contagem_num", parseInt(contagem_num));
      }
      if (rua) {
        query = query.eq("rua", parseInt(rua));
      }
      
      // Must have at least one filter
      if (!contagem_num && !rua) {
        return new Response(
          JSON.stringify({ success: false, error: 'É necessário especificar contagem ou rua' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { error } = await query;
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Get items available for user to count ==========
    // Considers: global config, per-rua config, and selected items
    if (action === "inventario_itens_para_contar") {
      const { rua } = params;
      
      if (!rua) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rua é obrigatória' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ruaNum = parseInt(rua);

      // Get global config
      const { data: globalConfig } = await supabase
        .from("inventario_config")
        .select("contagem_ativa")
        .single();
      
      const contagemGlobal = globalConfig?.contagem_ativa || 1;

      // Check for per-rua config
      const { data: ruaConfig } = await supabase
        .from("inventario_config_rua")
        .select("contagem_ativa")
        .eq("rua", ruaNum)
        .maybeSingle();
      
      const contagemAtiva = ruaConfig?.contagem_ativa || contagemGlobal;

      // Check if there are selected items for this contagem and rua
      const { data: selecoes } = await supabase
        .from("inventario_selecao")
        .select("endereco_material_id")
        .eq("contagem_num", contagemAtiva)
        .eq("rua", ruaNum);
      
      const hasSelection = selecoes && selecoes.length > 0;
      const selectedIds = hasSelection ? selecoes.map((s: any) => s.endereco_material_id) : [];

      // If contagem 3, only show items with divergence (unless specific selection)
      let enderecoIds: string[] = [];
      
      if (contagemAtiva === 3 && !hasSelection) {
        // Find items with divergence between contagem 1 and 2
        const { data: inv1 } = await supabase
          .from("inventario")
          .select("endereco_material_id, quantidade")
          .eq("contagem_num", 1);
        
        const { data: inv2 } = await supabase
          .from("inventario")
          .select("endereco_material_id, quantidade")
          .eq("contagem_num", 2);
        
        const map1 = new Map((inv1 || []).map((i: any) => [i.endereco_material_id, i.quantidade]));
        const map2 = new Map((inv2 || []).map((i: any) => [i.endereco_material_id, i.quantidade]));
        
        // Find all unique IDs from both counts
        const allIds = new Set([...map1.keys(), ...map2.keys()]);
        
        for (const id of allIds) {
          const qty1 = map1.get(id);
          const qty2 = map2.get(id);
          // Divergence: different quantities or one is missing
          if (qty1 !== qty2) {
            enderecoIds.push(id);
          }
        }
      }

      // Build query for enderecos
      let query = supabase
        .from("enderecos_materiais")
        .select(`
          id,
          codigo,
          descricao,
          tipo_material,
          peso,
          rua,
          coluna,
          nivel,
          posicao,
          fabricantes (nome)
        `)
        .eq("ativo", true)
        .eq("rua", ruaNum)
        .order("coluna")
        .order("nivel")
        .order("posicao");
      
      // Apply filters based on selection or divergence
      if (hasSelection) {
        query = query.in("id", selectedIds);
      } else if (contagemAtiva === 3 && enderecoIds.length > 0) {
        query = query.in("id", enderecoIds);
      } else if (contagemAtiva === 3 && enderecoIds.length === 0) {
        // No divergences, return empty
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: [], 
            contagem_ativa: contagemAtiva,
            has_selection: false,
            message: 'Nenhum item com divergência encontrado'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: enderecos, error: endError } = await query;
      if (endError) throw endError;

      // Get existing inventory for active phase (to show which already counted)
      const idsToCheck = (enderecos || []).map((e: any) => e.id);
      const { data: inventarioExistente } = await supabase
        .from("inventario")
        .select("endereco_material_id")
        .eq("contagem_num", contagemAtiva)
        .in("endereco_material_id", idsToCheck);
      
      const contadosSet = new Set((inventarioExistente || []).map((i: any) => i.endereco_material_id));

      const result = (enderecos || []).map((e: any) => ({
        ...e,
        fabricante_nome: e.fabricantes?.nome || null,
        ja_contado: contadosSet.has(e.id)
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result,
          contagem_ativa: contagemAtiva,
          has_selection: hasSelection,
          total_itens: result.length,
          total_contados: contadosSet.size
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== Get divergent items between counting 1 and 2 ==========
    if (action === "inventario_divergencias") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso restrito a administradores' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { rua } = params;

      // Get all inventory for contagem 1 and 2
      const { data: inv1 } = await supabase
        .from("inventario")
        .select(`
          endereco_material_id, 
          quantidade,
          enderecos_materiais (
            codigo,
            descricao,
            rua,
            coluna,
            nivel,
            posicao,
            tipo_material,
            fabricantes (nome)
          )
        `)
        .eq("contagem_num", 1);
      
      const { data: inv2 } = await supabase
        .from("inventario")
        .select("endereco_material_id, quantidade")
        .eq("contagem_num", 2);

      const { data: inv3 } = await supabase
        .from("inventario")
        .select("endereco_material_id, quantidade")
        .eq("contagem_num", 3);
      
      const map1 = new Map((inv1 || []).map((i: any) => [i.endereco_material_id, i]));
      const map2 = new Map((inv2 || []).map((i: any) => [i.endereco_material_id, i.quantidade]));
      const map3 = new Map((inv3 || []).map((i: any) => [i.endereco_material_id, i.quantidade]));
      
      const divergencias: any[] = [];
      const allIds = new Set([...map1.keys(), ...map2.keys()]);
      
      for (const id of allIds) {
        const item1 = map1.get(id);
        const qty1 = item1?.quantidade;
        const qty2 = map2.get(id);
        const qty3 = map3.get(id);
        
        if (qty1 !== qty2) {
          const mat = item1?.enderecos_materiais;
          
          // Filter by rua if specified
          if (rua && mat?.rua !== parseInt(rua)) continue;
          
          divergencias.push({
            endereco_material_id: id,
            codigo: mat?.codigo,
            descricao: mat?.descricao,
            rua: mat?.rua,
            coluna: mat?.coluna,
            nivel: mat?.nivel,
            posicao: mat?.posicao,
            tipo_material: mat?.tipo_material,
            fabricante_nome: mat?.fabricantes?.nome || null,
            quantidade_1: qty1 ?? null,
            quantidade_2: qty2 ?? null,
            quantidade_3: qty3 ?? null,
            diferenca: Math.abs((qty1 ?? 0) - (qty2 ?? 0))
          });
        }
      }

      // Sort by rua, then coluna, nivel, posicao
      divergencias.sort((a, b) => 
        (a.rua - b.rua) || (a.coluna - b.coluna) || (a.nivel - b.nivel) || (a.posicao - b.posicao)
      );

      return new Response(
        JSON.stringify({ success: true, data: divergencias }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EXPORT INVENTARIO COMPLETO (com todas as contagens) ==========
    if (action === "inventario_export_completo") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem exportar dados' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all enderecos with inventory
      const { data: enderecos, error: endError } = await supabase
        .from("enderecos_materiais")
        .select(`
          id,
          codigo,
          descricao,
          tipo_material,
          peso,
          rua,
          coluna,
          nivel,
          posicao,
          fabricantes (nome)
        `)
        .eq("ativo", true)
        .order("rua")
        .order("coluna")
        .order("nivel")
        .order("posicao");
      
      if (endError) throw endError;

      // Get all inventory data
      const { data: inventario } = await supabase
        .from("inventario")
        .select("endereco_material_id, quantidade, contagem_num, contado_por, created_at");

      // Create maps for each contagem
      const invMap1 = new Map<string, any>();
      const invMap2 = new Map<string, any>();
      const invMap3 = new Map<string, any>();

      (inventario || []).forEach((inv: any) => {
        const data = {
          quantidade: inv.quantidade,
          contado_por: inv.contado_por,
          data: inv.created_at
        };
        if (inv.contagem_num === 1) invMap1.set(inv.endereco_material_id, data);
        if (inv.contagem_num === 2) invMap2.set(inv.endereco_material_id, data);
        if (inv.contagem_num === 3) invMap3.set(inv.endereco_material_id, data);
      });

      // Build export data
      const exportData = (enderecos || []).map((e: any) => {
        const inv1 = invMap1.get(e.id);
        const inv2 = invMap2.get(e.id);
        const inv3 = invMap3.get(e.id);
        
        const qty1 = inv1?.quantidade ?? null;
        const qty2 = inv2?.quantidade ?? null;
        const qty3 = inv3?.quantidade ?? null;

        // Calculate divergence
        let status = '';
        if (qty1 !== null && qty2 !== null) {
          if (qty1 === qty2) {
            status = 'OK';
          } else if (qty3 !== null) {
            status = qty3 === qty1 || qty3 === qty2 ? 'RESOLVIDO' : 'DIVERGENTE';
          } else {
            status = 'DIVERGENTE';
          }
        } else if (qty1 !== null || qty2 !== null) {
          status = 'INCOMPLETO';
        } else {
          status = 'NAO_CONTADO';
        }

        return {
          codigo: e.codigo,
          descricao: e.descricao,
          tipo_material: e.tipo_material,
          peso: e.peso,
          fabricante: e.fabricantes?.nome || '',
          rua: e.rua,
          coluna: e.coluna,
          nivel: e.nivel,
          posicao: e.posicao,
          endereco: `R${String(e.rua).padStart(2,'0')}.C${String(e.coluna).padStart(2,'0')}.N${String(e.nivel).padStart(2,'0')}.P${String(e.posicao).padStart(2,'0')}`,
          quantidade_1: qty1,
          contado_por_1: inv1?.contado_por || '',
          data_contagem_1: inv1?.data || '',
          quantidade_2: qty2,
          contado_por_2: inv2?.contado_por || '',
          data_contagem_2: inv2?.data || '',
          quantidade_3: qty3,
          contado_por_3: inv3?.contado_por || '',
          data_contagem_3: inv3?.data || '',
          diferenca_1_2: qty1 !== null && qty2 !== null ? Math.abs(qty1 - qty2) : null,
          status
        };
      });

      return new Response(
        JSON.stringify({ success: true, data: exportData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EXPORT ALL DATA (admin only) ==========
    if (action === "export_all_data") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem exportar dados' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [catalogoResult, enderecosResult, inventarioResult, fabricantesResult, usuariosResult, logsResult] = await Promise.all([
        supabase.from('catalogo_produtos').select('*').order('codigo'),
        supabase.from('enderecos_materiais').select('*, fabricantes(nome)').order('created_at', { ascending: false }),
        supabase.from('inventario').select('*, enderecos_materiais(codigo, descricao, rua, coluna, nivel, posicao)').order('created_at', { ascending: false }),
        supabase.from('fabricantes').select('*').order('nome'),
        supabase.from('usuarios').select('id, nome, email, tipo, status, aprovado, created_at').order('nome'),
        supabase.from('login_logs').select('*').order('logged_at', { ascending: false }).limit(500),
      ]);

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            catalogo: catalogoResult.data || [],
            enderecos: enderecosResult.data || [],
            inventario: inventarioResult.data || [],
            fabricantes: fabricantesResult.data || [],
            usuarios: usuariosResult.data || [],
            logs: logsResult.data || []
          },
          errors: {
            catalogo: catalogoResult.error?.message || null,
            enderecos: enderecosResult.error?.message || null,
            inventario: inventarioResult.error?.message || null,
            fabricantes: fabricantesResult.error?.message || null,
            usuarios: usuariosResult.error?.message || null,
            logs: logsResult.error?.message || null
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ação inválida: ${action}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Data operation error:", message);
    // SEMPRE retornar status 200 com success: false para que o client possa tratar
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
