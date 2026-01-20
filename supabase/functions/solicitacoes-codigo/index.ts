import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin, handleCorsOptions } from "../_shared/cors.ts";

// Verify session token and get user info
async function verifySession(supabase: any, sessionToken: string): Promise<{ 
  success: boolean; 
  error?: string; 
  user?: { id: string; email: string; nome: string; tipo: string; role: string } 
}> {
  if (!sessionToken) {
    return { success: false, error: 'Token de sessão não fornecido' };
  }

  const { data: session, error: sessionError } = await supabase
    .from("session_tokens")
    .select("user_id, user_email, expires_at")
    .eq("token", sessionToken)
    .maybeSingle();

  if (sessionError || !session) {
    return { success: false, error: 'Token inválido ou expirado' };
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabase.from("session_tokens").delete().eq("token", sessionToken);
    return { success: false, error: 'Sessão expirada. Faça login novamente.' };
  }

  const { data: usuario, error: findError } = await supabase
    .from("usuarios")
    .select("id, email, nome, tipo, role, aprovado")
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
      tipo: usuario.tipo,
      role: usuario.role || 'USER'
    } 
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  // Reject requests from unauthorized origins
  if (origin && !isAllowedOrigin(origin)) {
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

    console.log(`Solicitações código operation: ${action}`);

    // Verify session for all operations
    const authResult = await verifySession(supabase, sessionToken);
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: authResult.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = authResult.user!;
    const PROTECTED_SUPER_ADMIN_EMAIL = "carlos.teixeira@imexsolutions.com.br";
    const isSuperAdmin = user.role === 'SUPER_ADMIN' || 
      (user.tipo === 'admin' && user.email?.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL);
    const isAdmin = user.tipo === 'admin' || isSuperAdmin;

    console.log(`User: ${user.email}, Tipo: ${user.tipo}, Role: ${user.role}, IsSuperAdmin: ${isSuperAdmin}`);

    // Buscar permissões do perfil do usuário dinamicamente
    let canRequestCode = isAdmin; // Admin sempre pode
    let canProcessCode = isAdmin; // Admin sempre pode
    let canApproveCode = isAdmin; // Admin sempre pode

    if (!isAdmin) {
      // Buscar o profile_id baseado no tipo do usuário
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("nome", user.tipo)
        .eq("is_active", true)
        .maybeSingle();

      if (userProfile) {
        // Buscar permissões do perfil
        const { data: permissions } = await supabase
          .from("profile_permissions")
          .select("menu_key, can_access")
          .eq("profile_id", userProfile.id)
          .eq("can_access", true);

        if (permissions) {
          const permissionMap = permissions.reduce((acc: Record<string, boolean>, p: any) => {
            acc[p.menu_key] = p.can_access;
            return acc;
          }, {});

          // Verificar permissão de solicitar código
          canRequestCode = permissionMap['solicitar_codigo'] === true;
          // Verificar permissão de processar códigos (comercial)
          canProcessCode = permissionMap['processar_codigos'] === true;
          // Verificar permissão de aprovar códigos (admin)
          canApproveCode = permissionMap['aprovacao_codigos'] === true;
          
          console.log(`Permissions for ${user.tipo}:`, { canRequestCode, canProcessCode, canApproveCode });
        }
      } else {
        console.log(`No active profile found for tipo: ${user.tipo}`);
      }
    }

    // ========== CRIAR SOLICITAÇÃO (user, admin) ==========
    if (action === "criar_solicitacao") {
      if (!canRequestCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas usuários e administradores podem solicitar códigos' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { descricao, fabricante_id, tipo_material, peso } = params;

      if (!descricao || !descricao.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Descrição é obrigatória' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!fabricante_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Fabricante é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!tipo_material) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tipo de material é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se já existe descrição similar no catálogo
      const descricaoUpper = descricao.trim().toUpperCase();
      const { data: catalogoExistente } = await supabase
        .from("catalogo_produtos")
        .select("codigo, descricao")
        .ilike("descricao", descricaoUpper)
        .limit(1);

      if (catalogoExistente && catalogoExistente.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Esta descrição já existe no catálogo',
            existingItem: catalogoExistente[0]
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se já existe solicitação pendente com mesma descrição
      const { data: solicitacaoExistente } = await supabase
        .from("solicitacoes_codigo")
        .select("id, numero_solicitacao, status")
        .ilike("descricao", descricaoUpper)
        .in("status", ["pendente", "em_processamento", "codigo_gerado"])
        .limit(1);

      if (solicitacaoExistente && solicitacaoExistente.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Já existe uma solicitação (#${solicitacaoExistente[0].numero_solicitacao}) para esta descrição`
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Criar solicitação com tipo_material e peso
      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .insert({
          descricao: descricaoUpper,
          fabricante_id: fabricante_id || null,
          tipo_material: tipo_material,
          peso: peso || null,
          solicitado_por: user.nome,
          solicitado_por_id: user.id,
          status: 'pendente'
        })
        .select("*, fabricantes(nome)")
        .single();

      if (error) throw error;

      console.log(`Solicitação #${data.numero_solicitacao} criada por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== LISTAR SOLICITAÇÕES PENDENTES (comercial apenas) ==========
    if (action === "listar_pendentes") {
      if (!canProcessCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas o comercial pode processar solicitações' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .select("*, fabricantes(nome)")
        .in("status", ["pendente", "em_processamento"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== LISTAR SOLICITAÇÕES PARA APROVAÇÃO (quem tem permissão) ==========
    if (action === "listar_para_aprovacao") {
      if (!canApproveCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Você não tem permissão para aprovar códigos' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .select("*, fabricantes(nome)")
        .eq("status", "codigo_gerado")
        .order("processado_em", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== LISTAR MINHAS SOLICITAÇÕES (usuário) ==========
    if (action === "listar_minhas") {
      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .select("*, fabricantes(nome)")
        .eq("solicitado_por_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== BLOQUEAR SOLICITAÇÃO (comercial apenas) ==========
    if (action === "bloquear") {
      if (!canProcessCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas o comercial pode processar solicitações' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id } = params;

      // Verificar se está disponível
      const { data: solicitacao } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (!solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se está bloqueada por outra pessoa
      if (solicitacao.locked_by_id && solicitacao.locked_by_id !== user.id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Esta solicitação está sendo processada por outro usuário',
            locked: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Bloquear
      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .update({
          locked_by_id: user.id,
          locked_at: new Date().toISOString(),
          status: 'em_processamento'
        })
        .eq("id", solicitacao_id)
        .select("*, fabricantes(nome)")
        .single();

      if (error) throw error;

      console.log(`Solicitação #${data.numero_solicitacao} bloqueada por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== DESBLOQUEAR SOLICITAÇÃO (comercial apenas) ==========
    if (action === "desbloquear") {
      if (!canProcessCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas o comercial pode processar solicitações' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id } = params;

      // Verificar se pode desbloquear (é dono ou admin)
      const { data: solicitacao } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (!solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (solicitacao.locked_by_id !== user.id && !isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Você não pode desbloquear esta solicitação' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .update({
          locked_by_id: null,
          locked_at: null,
          status: 'pendente'
        })
        .eq("id", solicitacao_id)
        .select("*, fabricantes(nome)")
        .single();

      if (error) throw error;

      console.log(`Solicitação #${data.numero_solicitacao} desbloqueada por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== SALVAR CÓDIGO (comercial apenas) ==========
    if (action === "salvar_codigo") {
      if (!canProcessCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas o comercial pode gerar códigos' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id, codigo, descricao_imex } = params;

      if (!codigo || !codigo.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const codigoUpper = codigo.trim().toUpperCase();

      // Validar que código tem exatamente 6 caracteres
      if (codigoUpper.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'O código deve ter exatamente 6 caracteres' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se código já existe no catálogo
      const { data: catalogoExistente } = await supabase
        .from("catalogo_produtos")
        .select("codigo")
        .eq("codigo", codigoUpper)
        .limit(1);

      if (catalogoExistente && catalogoExistente.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este código já existe no catálogo' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se já existe outra solicitação com este mesmo código (pendente, em processamento, código gerado ou aprovado)
      const { data: solicitacaoComMesmoCodigo } = await supabase
        .from("solicitacoes_codigo")
        .select("id, numero_solicitacao, status, codigo_gerado")
        .eq("codigo_gerado", codigoUpper)
        .in("status", ["codigo_gerado", "aprovado"])
        .neq("id", solicitacao_id)
        .limit(1);

      if (solicitacaoComMesmoCodigo && solicitacaoComMesmoCodigo.length > 0) {
        const statusMsg = solicitacaoComMesmoCodigo[0].status === 'aprovado' 
          ? 'já foi aprovado em outra solicitação' 
          : 'está em outra solicitação aguardando aprovação';
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Este código ${statusMsg} (#${solicitacaoComMesmoCodigo[0].numero_solicitacao})` 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se solicitação está bloqueada pelo usuário
      const { data: solicitacao } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (!solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (solicitacao.locked_by_id !== user.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Você precisa bloquear a solicitação antes de salvar' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Salvar código e descrição IMEX
      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .update({
          codigo_gerado: codigoUpper,
          descricao_imex: descricao_imex?.trim() || null,
          processado_por: user.nome,
          processado_por_id: user.id,
          processado_em: new Date().toISOString(),
          status: 'codigo_gerado',
          locked_by_id: null,
          locked_at: null
        })
        .eq("id", solicitacao_id)
        .select("*, fabricantes(nome)")
        .single();

      if (error) throw error;

      // Criar notificação para o solicitante
      await supabase.from("notificacoes_usuario").insert({
        user_id: solicitacao.solicitado_por_id,
        tipo: 'codigo_gerado',
        titulo: 'Código Criado',
        mensagem: `O código ${codigoUpper} foi criado para "${solicitacao.descricao}". Aguardando aprovação do administrador.`,
        dados: { solicitacao_id: solicitacao.id, codigo: codigoUpper }
      });

      console.log(`Código ${codigoUpper} salvo para solicitação #${data.numero_solicitacao} por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== APROVAR CÓDIGO (admin ou quem tem permissão) ==========
    if (action === "aprovar") {
      if (!canApproveCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Você não tem permissão para aprovar códigos' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id } = params;

      const { data: solicitacao } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (!solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (solicitacao.status !== 'codigo_gerado') {
        return new Response(
          JSON.stringify({ success: false, error: 'Esta solicitação não está pronta para aprovação' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se código já existe no catálogo
      const { data: catalogoExistente } = await supabase
        .from("catalogo_produtos")
        .select("codigo")
        .eq("codigo", solicitacao.codigo_gerado)
        .limit(1);

      if (catalogoExistente && catalogoExistente.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este código já existe no catálogo' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Adicionar ao catálogo com descrição IMEX e peso
      const { error: catalogoError } = await supabase
        .from("catalogo_produtos")
        .insert({
          codigo: solicitacao.codigo_gerado,
          descricao: solicitacao.descricao,
          descricao_imex: solicitacao.descricao_imex || null,
          peso_kg: solicitacao.peso || null
        });

      if (catalogoError) throw catalogoError;

      // Atualizar solicitação
      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .update({
          status: 'aprovado',
          aprovado_por: user.nome,
          aprovado_por_id: user.id,
          aprovado_em: new Date().toISOString()
        })
        .eq("id", solicitacao_id)
        .select("*, fabricantes(nome)")
        .single();

      if (error) throw error;

      // Criar notificação para o solicitante
      await supabase.from("notificacoes_usuario").insert({
        user_id: solicitacao.solicitado_por_id,
        tipo: 'codigo_aprovado',
        titulo: 'Código Aprovado!',
        mensagem: `O código ${solicitacao.codigo_gerado} para "${solicitacao.descricao}" foi aprovado e está disponível para uso no endereçamento.`,
        dados: { solicitacao_id: solicitacao.id, codigo: solicitacao.codigo_gerado }
      });

      console.log(`Código ${solicitacao.codigo_gerado} aprovado por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== REJEITAR CÓDIGO (admin) ==========
    if (action === "rejeitar") {
      if (!canApproveCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Você não tem permissão para rejeitar códigos' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id, motivo } = params;

      if (!motivo || !motivo.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Motivo da rejeição é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: solicitacao } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (!solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .update({
          status: 'rejeitado',
          motivo_rejeicao: motivo.trim(),
          aprovado_por: user.nome,
          aprovado_por_id: user.id,
          aprovado_em: new Date().toISOString()
        })
        .eq("id", solicitacao_id)
        .select("*, fabricantes(nome)")
        .single();

      if (error) throw error;

      // Criar notificação para o solicitante
      await supabase.from("notificacoes_usuario").insert({
        user_id: solicitacao.solicitado_por_id,
        tipo: 'codigo_rejeitado',
        titulo: 'Código Rejeitado',
        mensagem: `A solicitação para "${solicitacao.descricao}" foi rejeitada. Motivo: ${motivo.trim()}`,
        dados: { solicitacao_id: solicitacao.id, motivo: motivo.trim() }
      });

      console.log(`Solicitação #${data.numero_solicitacao} rejeitada por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== NOTIFICAÇÕES ==========
    if (action === "listar_notificacoes") {
      const { data, error } = await supabase
        .from("notificacoes_usuario")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "marcar_lida") {
      const { notificacao_id } = params;

      const { error } = await supabase
        .from("notificacoes_usuario")
        .update({ lida: true })
        .eq("id", notificacao_id)
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "marcar_todas_lidas") {
      const { error } = await supabase
        .from("notificacoes_usuario")
        .update({ lida: true })
        .eq("user_id", user.id)
        .eq("lida", false);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "contar_nao_lidas") {
      const { count, error } = await supabase
        .from("notificacoes_usuario")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("lida", false);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, count: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EXCLUIR SOLICITAÇÃO (admin) ==========
    if (action === "excluir_solicitacao") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem excluir solicitações' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id } = params;

      const { data: solicitacao } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (!solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Não permitir excluir solicitações já aprovadas
      if (solicitacao.status === 'aprovado') {
        return new Response(
          JSON.stringify({ success: false, error: 'Não é possível excluir solicitações já aprovadas' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Excluir notificações relacionadas
      await supabase
        .from("notificacoes_usuario")
        .delete()
        .eq("dados->>solicitacao_id", solicitacao_id);

      // Excluir solicitação
      const { error } = await supabase
        .from("solicitacoes_codigo")
        .delete()
        .eq("id", solicitacao_id);

      if (error) throw error;

      console.log(`Solicitação #${solicitacao.numero_solicitacao} excluída por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EDITAR SOLICITAÇÃO PENDENTE (admin) ==========
    if (action === "editar_solicitacao") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem editar solicitações' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id, descricao, fabricante_id, tipo_material, peso } = params;

      const { data: solicitacao } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (!solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Apenas permitir edição de solicitações pendentes
      if (solicitacao.status !== 'pendente') {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas solicitações pendentes podem ser editadas' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validações
      if (!descricao || !descricao.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Descrição é obrigatória' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!fabricante_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Fabricante é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!tipo_material) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tipo de material é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const descricaoUpper = descricao.trim().toUpperCase();

      // Atualizar solicitação
      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .update({
          descricao: descricaoUpper,
          fabricante_id: fabricante_id,
          tipo_material: tipo_material,
          peso: peso || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", solicitacao_id)
        .select("*, fabricantes(nome)")
        .single();

      if (error) throw error;

      console.log(`Solicitação #${data.numero_solicitacao} editada por ${user.nome}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== LISTAR TODAS SOLICITAÇÕES (admin) ==========
    if (action === "listar_todas") {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas administradores podem ver todas as solicitações' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .select("*, fabricantes(nome)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== EDITAR CÓDIGO AGUARDANDO APROVAÇÃO (Super Admin) ==========
    if (action === "editar_codigo_aguardando") {
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem editar códigos aguardando aprovação' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id, novo_codigo } = params;

      if (!solicitacao_id || !novo_codigo) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID da solicitação e novo código são obrigatórios' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const codigoTrimmed = novo_codigo.trim().toUpperCase();
      
      if (codigoTrimmed.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'O código deve ter exatamente 6 caracteres' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se solicitação existe e está aguardando aprovação
      const { data: solicitacao, error: solError } = await supabase
        .from("solicitacoes_codigo")
        .select("*")
        .eq("id", solicitacao_id)
        .eq("status", "aguardando_aprovacao")
        .maybeSingle();

      if (solError || !solicitacao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Solicitação não encontrada ou não está aguardando aprovação' }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se o novo código já existe no catálogo
      const { data: existing } = await supabase
        .from("catalogo_produtos")
        .select("codigo, descricao")
        .eq("codigo", codigoTrimmed)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Código ${codigoTrimmed} já existe no catálogo`,
            existingItem: existing
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar o código
      const { data, error } = await supabase
        .from("solicitacoes_codigo")
        .update({
          codigo_gerado: codigoTrimmed,
          updated_at: new Date().toISOString()
        })
        .eq("id", solicitacao_id)
        .select("*")
        .single();

      if (error) throw error;

      console.log(`Código da solicitação #${data.numero_solicitacao} editado por Super Admin ${user.nome}: ${solicitacao.codigo_gerado} -> ${codigoTrimmed}`);

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ação inválida: ${action}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Solicitações código error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
