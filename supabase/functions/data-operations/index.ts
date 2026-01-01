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
          nome: nome.trim(),
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
        .insert({ codigo: codigo.trim(), descricao: descricao.trim() })
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
          codigo: codigo.trim(),
          descricao: descricao.trim(),
          tipo_material,
          fabricante_id,
          peso: parseFloat(peso),
          rua: parseInt(rua),
          coluna: parseInt(coluna),
          nivel: parseInt(nivel),
          posicao: parseInt(posicao),
          comentario: comentario?.trim() || null,
          created_by: user.nome,
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
