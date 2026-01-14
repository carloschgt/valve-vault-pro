import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS configuration - allow all origins for mobile compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};


// Convert wildcard pattern to ILIKE pattern and sanitize
// User can use * as wildcard (converted to %), otherwise defaults to contains search
function wildcardToILike(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') return '%';
  
  // Clean control characters and trim
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);
  if (!cleaned) return '%';
  
  // Check if pattern contains wildcards (*)
  const hasWildcard = cleaned.includes('*');
  
  // Escape SQL ILIKE special characters (% and _)
  let escaped = cleaned.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  
  if (!hasWildcard) {
    // No wildcard: default to contains search
    return `%${escaped}%`;
  }
  
  // Replace * with % for SQL ILIKE
  escaped = escaped.replace(/\*/g, '%');
  
  return escaped;
}

// Legacy function for backwards compatibility (used where wildcards aren't desired)
function sanitizeSearchTerm(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') return '';
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);
  return cleaned.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// Compute SHA-256 hash of token for secure lookup
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify session token and get user info using token_hash
async function verifySession(supabase: any, sessionToken: string): Promise<{ 
  success: boolean; 
  error?: string; 
  user?: { id: string; email: string; nome: string; tipo: string; role: string; is_active: boolean; force_password_change: boolean };
  isSessionExpired?: boolean;
}> {
  if (!sessionToken) {
    return { success: false, error: 'Token de sessão não fornecido', isSessionExpired: true };
  }

  // Compute token hash for secure lookup
  const tokenHash = await hashToken(sessionToken);

  // Validate session token against database using token_hash
  // First try token_hash (new secure method), fallback to legacy token column
  let session = null;
  let sessionError = null;

  // Try token_hash first
  const { data: hashSession, error: hashError } = await supabase
    .from("session_tokens")
    .select("user_id, user_email, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (hashSession) {
    session = hashSession;
  } else {
    // Fallback to legacy token column for backwards compatibility
    const { data: legacySession, error: legacyError } = await supabase
      .from("session_tokens")
      .select("user_id, user_email, expires_at, revoked_at, id")
      .eq("token", sessionToken)
      .maybeSingle();

    if (legacySession) {
      session = legacySession;
      
      // Migrate legacy token to token_hash
      console.log("Migrating legacy token to token_hash");
      await supabase
        .from("session_tokens")
        .update({ token_hash: tokenHash })
        .eq("id", legacySession.id);
    } else {
      sessionError = legacyError || hashError;
    }
  }

  if (sessionError || !session) {
    console.log("Session token not found");
    return { success: false, error: 'Token inválido ou expirado', isSessionExpired: true };
  }

  // Check if token was revoked
  if (session.revoked_at) {
    console.log("Session token was revoked");
    return { success: false, error: 'Sessão revogada. Faça login novamente.', isSessionExpired: true };
  }

  // Check if token is expired
  if (new Date(session.expires_at) < new Date()) {
    console.log("Session token expired");
    return { success: false, error: 'Sessão expirada. Faça login novamente.', isSessionExpired: true };
  }

  // Update last_seen_at for session activity tracking
  await supabase
    .from("session_tokens")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  // Get user details with new security fields
  const { data: usuario, error: findError } = await supabase
    .from("usuarios")
    .select("id, email, nome, tipo, aprovado, role, is_active, force_password_change, status")
    .eq("email", session.user_email.toLowerCase())
    .maybeSingle();

  if (findError || !usuario) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  // Check if user is active
  if (usuario.is_active === false) {
    return { success: false, error: 'Usuário desativado' };
  }

  // Check legacy approval status for backwards compatibility
  if (!usuario.aprovado && usuario.status !== 'ativo') {
    return { success: false, error: 'Usuário não aprovado' };
  }

  return { 
    success: true, 
    user: { 
      id: usuario.id, 
      email: usuario.email, 
      nome: usuario.nome, 
      tipo: usuario.tipo,
      role: usuario.role || usuario.tipo,
      is_active: usuario.is_active !== false,
      force_password_change: usuario.force_password_change || false
    } 
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      // Include isSessionExpired flag for auto-logout handling
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: authResult.error,
          isSessionExpired: authResult.isSessionExpired || false
        }),
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
        const pattern = wildcardToILike(search);
        query = query.or(`codigo.ilike.${pattern},descricao.ilike.${pattern}`);
      }
      
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      
      // Para cada produto sem peso no catálogo, buscar peso de enderecos_materiais
      if (data && data.length > 0) {
        const codigosSemPeso = data
          .filter((p: any) => p.peso_kg === null || p.peso_kg === undefined)
          .map((p: any) => p.codigo);
        
        if (codigosSemPeso.length > 0) {
          // Buscar peso de enderecos_materiais para esses códigos
          const { data: enderecos } = await supabase
            .from("enderecos_materiais")
            .select("codigo, peso")
            .in("codigo", codigosSemPeso)
            .eq("ativo", true);
          
          if (enderecos && enderecos.length > 0) {
            // Criar mapa de código -> peso (usar o primeiro encontrado)
            const pesoMap = new Map<string, number>();
            for (const e of enderecos) {
              if (!pesoMap.has(e.codigo) && e.peso !== null && e.peso !== undefined) {
                pesoMap.set(e.codigo, e.peso);
              }
            }
            
            // Atualizar os produtos com o peso encontrado
            for (const produto of data) {
              if ((produto.peso_kg === null || produto.peso_kg === undefined) && pesoMap.has(produto.codigo)) {
                produto.peso_kg = pesoMap.get(produto.codigo);
              }
            }
          }
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "catalogo_get") {
      const { codigo } = params;
      const codigoTrimmed = codigo?.trim()?.toUpperCase();
      
      const { data, error } = await supabase
        .from("catalogo_produtos")
        .select("id, codigo, descricao, peso_kg, ativo")
        .eq("codigo", codigoTrimmed)
        .maybeSingle();
      if (error) throw error;
      
      // Se encontrou no catálogo, verificar se existe uma solicitação aprovada com dados adicionais
      let solicitacaoData = null;
      if (data) {
        const { data: solicitacao } = await supabase
          .from("solicitacoes_codigo")
          .select("fabricante_id, tipo_material, peso")
          .eq("codigo_gerado", codigoTrimmed)
          .eq("status", "aprovado")
          .maybeSingle();
        
        if (solicitacao && solicitacao.fabricante_id) {
          // Buscar nome do fabricante separadamente
          const { data: fabricante } = await supabase
            .from("fabricantes")
            .select("nome")
            .eq("id", solicitacao.fabricante_id)
            .maybeSingle();
          
          solicitacaoData = {
            fabricante_id: solicitacao.fabricante_id,
            fabricante_nome: fabricante?.nome || null,
            tipo_material: solicitacao.tipo_material,
            peso: solicitacao.peso
          };
        } else if (solicitacao) {
          solicitacaoData = {
            fabricante_id: null,
            fabricante_nome: null,
            tipo_material: solicitacao.tipo_material,
            peso: solicitacao.peso
          };
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, data, solicitacao: solicitacaoData }),
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
        const pattern = wildcardToILike(search);
        query = query.or(`codigo.ilike.${pattern},descricao.ilike.${pattern}`);
      }
      
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CÓDIGOS SEM ENDEREÇAMENTO ==========
    // IMPORTANTE: Só mostra códigos que passaram pelo fluxo completo de solicitação:
    // Solicitação criada → Código gerado pelo comercial → Aprovado por admin/superadmin
    // NÃO mostra códigos do catálogo geral - apenas os que passaram pelo fluxo de solicitação aprovada
    if (action === "codigos_sem_enderecamento") {
      // Buscar todos os códigos que já têm endereçamento ativo
      const { data: enderecos, error: endError } = await supabase
        .from("enderecos_materiais")
        .select("codigo")
        .eq("ativo", true);
      
      if (endError) throw endError;
      
      const codigosComEndereco = new Set((enderecos || []).map((e: any) => e.codigo.toUpperCase()));
      
      // CORREÇÃO: Buscar APENAS solicitações aprovadas (que passaram pelo fluxo completo)
      // Fluxo: Solicitação criada → Comercial gera código → Admin/SuperAdmin aprova
      const { data: solicitacoesAprovadas, error: solError } = await supabase
        .from("solicitacoes_codigo")
        .select("codigo_gerado, descricao, fabricante_id, tipo_material, peso, aprovado_em, fabricantes(nome)")
        .eq("status", "aprovado")
        .not("codigo_gerado", "is", null)
        .order("aprovado_em", { ascending: false });
      
      if (solError) throw solError;
      
      // Filtrar apenas códigos aprovados que ainda não têm endereçamento
      const result = [];
      
      for (const sol of (solicitacoesAprovadas || [])) {
        if (sol.codigo_gerado) {
          const codigoUpper = sol.codigo_gerado.toUpperCase();
          
          // Só incluir se não tem endereço ativo
          if (!codigosComEndereco.has(codigoUpper)) {
            result.push({
              codigo: sol.codigo_gerado,
              descricao: sol.descricao,
              peso: sol.peso || null,
              fabricante_id: sol.fabricante_id || null,
              fabricante_nome: (sol.fabricantes as any)?.nome || null,
              tipo_material: sol.tipo_material || null,
              from_solicitacao: true,
              aprovado_em: sol.aprovado_em,
            });
          }
        }
      }
      
      // Ordenar por data de aprovação (mais recentes primeiro)
      result.sort((a, b) => {
        if (a.aprovado_em && b.aprovado_em) {
          return new Date(b.aprovado_em).getTime() - new Date(a.aprovado_em).getTime();
        }
        return a.codigo.localeCompare(b.codigo);
      });
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
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
      if (search && search.trim()) {
        // Convert wildcard pattern to regex for local filtering
        const pattern = search.trim();
        const hasWildcard = pattern.includes('*');
        
        if (hasWildcard) {
          // Convert * to .* and create regex
          const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
          const startsWithWildcard = pattern.startsWith('*');
          const endsWithWildcard = pattern.endsWith('*');
          let finalPattern = regexPattern;
          if (!startsWithWildcard) finalPattern = '^' + finalPattern;
          if (!endsWithWildcard) finalPattern = finalPattern + '$';
          
          try {
            const regex = new RegExp(finalPattern, 'i');
            result = result.filter((i: any) => 
              regex.test(i.enderecos_materiais?.codigo || '') ||
              regex.test(i.enderecos_materiais?.descricao || '')
            );
          } catch {
            // Fallback to includes search
            result = result.filter((i: any) => 
              i.enderecos_materiais?.codigo?.toLowerCase().includes(search.toLowerCase()) ||
              i.enderecos_materiais?.descricao?.toLowerCase().includes(search.toLowerCase())
            );
          }
        } else {
          // No wildcard: default to contains search
          result = result.filter((i: any) => 
            i.enderecos_materiais?.codigo?.toLowerCase().includes(search.toLowerCase()) ||
            i.enderecos_materiais?.descricao?.toLowerCase().includes(search.toLowerCase())
          );
        }
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

    // List audit logs for inventario adjustments
    if (action === "inventario_audit_list") {
      const { inventario_id, limit = 100 } = params;
      
      let query = supabase
        .from("inventario_audit")
        .select("*")
        .order("editado_em", { ascending: false })
        .limit(limit);
      
      if (inventario_id) {
        query = query.eq("inventario_id", inventario_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
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

    if (action === "fabricantes_update") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem editar fabricantes' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { id, nome, codigo } = params;
      const { data, error } = await supabase
        .from("fabricantes")
        .update({
          nome: nome.trim().toUpperCase(),
          codigo: codigo.trim().toUpperCase(),
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

      // Registrar auditoria de criação
      try {
        await supabase.from("enderecos_materiais_audit").insert({
          endereco_material_id: data.id,
          codigo: codigoNorm,
          acao: 'criacao',
          campo_alterado: null,
          valor_anterior: null,
          valor_novo: `Endereço: R${String(ruaNum).padStart(2,'0')}.C${String(colunaNum).padStart(2,'0')}.N${String(nivelNum).padStart(2,'0')}.P${String(posicaoNum).padStart(2,'0')}`,
          usuario_nome: user.nome,
          usuario_email: user.email,
          usuario_id: user.id,
        });
      } catch (auditError) {
        console.warn("Erro ao registrar auditoria:", auditError);
        // Não falhar a operação principal por erro de auditoria
      }

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
      
      // Buscar dados anteriores para auditoria
      const { data: anterior } = await supabase
        .from("enderecos_materiais")
        .select("codigo, ativo")
        .eq("id", id)
        .single();

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

      // Registrar auditoria de alteração de status
      if (anterior) {
        try {
          await supabase.from("enderecos_materiais_audit").insert({
            endereco_material_id: id,
            codigo: anterior.codigo,
            acao: 'alteracao_status',
            campo_alterado: 'status',
            valor_anterior: anterior.ativo ? 'Ativo' : 'Inativo',
            valor_novo: ativo ? 'Ativo' : 'Inativo',
            usuario_nome: user.nome,
            usuario_email: user.email,
            usuario_id: user.id,
          });
        } catch (auditError) {
          console.warn("Erro ao registrar auditoria:", auditError);
        }
      }

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

      const { id, codigo, descricao, descricao_imex, tipo_material, fabricante_id, peso, rua, coluna, nivel, posicao, comentario } = params;
      
      // Buscar dados anteriores para auditoria
      const { data: anterior } = await supabase
        .from("enderecos_materiais")
        .select("*")
        .eq("id", id)
        .single();

      const updateData: Record<string, any> = {};
      if (codigo !== undefined) updateData.codigo = codigo.trim().toUpperCase();
      if (descricao !== undefined) updateData.descricao = descricao.trim().toUpperCase();
      if (descricao_imex !== undefined) updateData.descricao_imex = descricao_imex?.trim().toUpperCase() || null;
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

      // Registrar auditoria de alterações
      if (anterior) {
        const codigoAtual = anterior.codigo;
        const auditorias = [];

        // Verificar cada campo alterado
        if (codigo !== undefined && codigo.trim().toUpperCase() !== anterior.codigo) {
          auditorias.push({
            endereco_material_id: id,
            codigo: codigoAtual,
            acao: 'alteracao_codigo',
            campo_alterado: 'código',
            valor_anterior: anterior.codigo,
            valor_novo: codigo.trim().toUpperCase(),
            usuario_nome: user.nome,
            usuario_email: user.email,
            usuario_id: user.id,
          });
        }

        if (descricao !== undefined && descricao.trim().toUpperCase() !== anterior.descricao) {
          auditorias.push({
            endereco_material_id: id,
            codigo: codigoAtual,
            acao: 'alteracao_descricao',
            campo_alterado: 'descrição',
            valor_anterior: anterior.descricao,
            valor_novo: descricao.trim().toUpperCase(),
            usuario_nome: user.nome,
            usuario_email: user.email,
            usuario_id: user.id,
          });
        }

        if (descricao_imex !== undefined && (descricao_imex?.trim().toUpperCase() || null) !== anterior.descricao_imex) {
          auditorias.push({
            endereco_material_id: id,
            codigo: codigoAtual,
            acao: 'alteracao_descricao_imex',
            campo_alterado: 'descrição imex',
            valor_anterior: anterior.descricao_imex || '(vazio)',
            valor_novo: descricao_imex?.trim().toUpperCase() || '(vazio)',
            usuario_nome: user.nome,
            usuario_email: user.email,
            usuario_id: user.id,
          });
        }

        if (peso !== undefined && parseFloat(peso) !== anterior.peso) {
          auditorias.push({
            endereco_material_id: id,
            codigo: codigoAtual,
            acao: 'alteracao_peso',
            campo_alterado: 'peso',
            valor_anterior: String(anterior.peso),
            valor_novo: String(peso),
            usuario_nome: user.nome,
            usuario_email: user.email,
            usuario_id: user.id,
          });
        }

        if (tipo_material !== undefined && tipo_material !== anterior.tipo_material) {
          auditorias.push({
            endereco_material_id: id,
            codigo: codigoAtual,
            acao: 'alteracao_tipo_material',
            campo_alterado: 'tipo material',
            valor_anterior: anterior.tipo_material,
            valor_novo: tipo_material,
            usuario_nome: user.nome,
            usuario_email: user.email,
            usuario_id: user.id,
          });
        }

        // Verificar alteração de endereço
        if ((rua !== undefined && parseInt(rua) !== anterior.rua) ||
            (coluna !== undefined && parseInt(coluna) !== anterior.coluna) ||
            (nivel !== undefined && parseInt(nivel) !== anterior.nivel) ||
            (posicao !== undefined && parseInt(posicao) !== anterior.posicao)) {
          const endAnterior = `R${String(anterior.rua).padStart(2,'0')}.C${String(anterior.coluna).padStart(2,'0')}.N${String(anterior.nivel).padStart(2,'0')}.P${String(anterior.posicao).padStart(2,'0')}`;
          const endNovo = `R${String(rua !== undefined ? parseInt(rua) : anterior.rua).padStart(2,'0')}.C${String(coluna !== undefined ? parseInt(coluna) : anterior.coluna).padStart(2,'0')}.N${String(nivel !== undefined ? parseInt(nivel) : anterior.nivel).padStart(2,'0')}.P${String(posicao !== undefined ? parseInt(posicao) : anterior.posicao).padStart(2,'0')}`;
          auditorias.push({
            endereco_material_id: id,
            codigo: codigoAtual,
            acao: 'alteracao_endereco',
            campo_alterado: 'endereço',
            valor_anterior: endAnterior,
            valor_novo: endNovo,
            usuario_nome: user.nome,
            usuario_email: user.email,
            usuario_id: user.id,
          });
        }

        // Inserir todas as auditorias
        if (auditorias.length > 0) {
          try {
            await supabase.from("enderecos_materiais_audit").insert(auditorias);
          } catch (auditError) {
            console.warn("Erro ao registrar auditoria:", auditError);
          }
        }
      }

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

    // ========== ESTOQUE ATUAL ==========
    if (action === "estoque_atual") {
      // Verificar se a visualização está bloqueada para não-admins
      const { data: config } = await supabase
        .from("inventario_config")
        .select("bloquear_visualizacao_estoque")
        .limit(1)
        .single();
      
      // Check if user has bypass permission
      let canBypass = false;
      if (!isAdmin && config?.bloquear_visualizacao_estoque) {
        // Get user profile permissions
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("nome", user.tipo)
          .maybeSingle();
        
        if (userProfile) {
          const { data: bypassPermission } = await supabase
            .from("profile_permissions")
            .select("can_access")
            .eq("profile_id", userProfile.id)
            .eq("menu_key", "bypass_inventario_block")
            .maybeSingle();
          
          canBypass = bypassPermission?.can_access === true;
        }
      }
      
      if (!isAdmin && !canBypass && config?.bloquear_visualizacao_estoque) {
        return new Response(
          JSON.stringify({ success: false, error: 'Visualização de estoque bloqueada durante inventário' }),
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
            descricao_imex,
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

      // Filtrar por busca se fornecida (suporta wildcard com *)
      let filteredData = inventarioData || [];
      if (search && typeof search === 'string' && search.trim()) {
        const searchTerm = search.trim();
        const hasWildcard = searchTerm.includes('*');
        
        if (hasWildcard) {
          // Convert * to regex pattern
          const escaped = searchTerm.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
          const regexPattern = escaped.replace(/\*/g, '.*');
          const regex = new RegExp(regexPattern, 'i');
          
          filteredData = filteredData.filter((inv: any) => 
            regex.test(inv.enderecos_materiais?.codigo || '') ||
            regex.test(inv.enderecos_materiais?.descricao || '')
          );
        } else {
          // No wildcard: simple contains search
          const safeSearch = searchTerm.toLowerCase();
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
        descricao_imex: string | null;
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
            descricao_imex: mat.descricao_imex || null,
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
        // Parse do endereço formatado - suporta ambos formatos:
        // "01-02-03-04" (hífen) ou "R02.C01.N01.P01" (formato visual)
        let parts: string[] = [];
        
        if (endereco.includes('.') && endereco.includes('R')) {
          // Formato visual: "R02.C01.N01.P01"
          const match = endereco.match(/R(\d+)\.C(\d+)\.N(\d+)\.P(\d+)/i);
          if (match) {
            parts = [match[1], match[2], match[3], match[4]];
          }
        } else {
          // Formato com hífen: "02-01-01-01"
          parts = endereco.split('-');
        }
        
        if (parts.length === 4) {
          enderecoQuery = enderecoQuery
            .eq("rua", parseInt(parts[0]))
            .eq("coluna", parseInt(parts[1]))
            .eq("nivel", parseInt(parts[2]))
            .eq("posicao", parseInt(parts[3]));
        }
      }

      // Use limit(1) e depois pegar o primeiro resultado para evitar erro com múltiplos registros
      const { data: endDataArray, error: endError } = await enderecoQuery.limit(1);
      const endData = endDataArray?.[0] || null;
      
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
        const pattern = wildcardToILike(search);
        query = query.or(`codigo.ilike.${pattern},descricao.ilike.${pattern}`);
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
      if (search && search.trim()) {
        // Convert wildcard pattern to regex for local filtering
        const pattern = search.trim();
        const hasWildcard = pattern.includes('*');
        
        if (hasWildcard) {
          const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
          const startsWithWildcard = pattern.startsWith('*');
          const endsWithWildcard = pattern.endsWith('*');
          let finalPattern = regexPattern;
          if (!startsWithWildcard) finalPattern = '^' + finalPattern;
          if (!endsWithWildcard) finalPattern = finalPattern + '$';
          
          try {
            const regex = new RegExp(finalPattern, 'i');
            result = result.filter((i: any) => 
              regex.test(i.enderecos_materiais?.codigo || '') ||
              regex.test(i.enderecos_materiais?.descricao || '')
            );
          } catch {
            result = result.filter((i: any) => 
              i.enderecos_materiais?.codigo?.toLowerCase().includes(search.toLowerCase()) ||
              i.enderecos_materiais?.descricao?.toLowerCase().includes(search.toLowerCase())
            );
          }
        } else {
          result = result.filter((i: any) => 
            i.enderecos_materiais?.codigo?.toLowerCase().includes(search.toLowerCase()) ||
            i.enderecos_materiais?.descricao?.toLowerCase().includes(search.toLowerCase())
          );
        }
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
        const pattern = wildcardToILike(search);
        query = query.or(`codigo.ilike.${pattern},descricao.ilike.${pattern}`);
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

    // ========== AUDITORIA ITEM (Super Admin only) ==========
    if (action === "auditoria_item") {
      // Only super admin can view audit logs
      if (user.role !== 'SUPER_ADMIN') {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem acessar a auditoria' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { codigo } = params;
      if (!codigo) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const codigoUpper = codigo.trim().toUpperCase();
      
      const { data, error } = await supabase
        .from('enderecos_materiais_audit')
        .select('*')
        .eq('codigo', codigoUpper)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Audit query error:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
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
