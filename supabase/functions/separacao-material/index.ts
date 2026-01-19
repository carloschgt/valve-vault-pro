import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin, handleCorsOptions } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ===== Session verification =====
interface SessionUser {
  id: string;
  email: string;
  nome: string;
  tipo: string;
  role: string;
}

async function verifySession(supabase: any, sessionToken: string): Promise<{ valid: boolean; user?: SessionUser; error?: string }> {
  if (!sessionToken || sessionToken.length < 32) {
    return { valid: false, error: "Token inválido" };
  }

  const { data: session, error } = await supabase
    .from("session_tokens")
    .select("user_id, user_email, expires_at, revoked_at")
    .eq("token", sessionToken)
    .maybeSingle();

  if (error || !session) {
    return { valid: false, error: "Sessão não encontrada" };
  }

  if (session.revoked_at) {
    return { valid: false, error: "Sessão revogada" };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { valid: false, error: "Sessão expirada" };
  }

  const { data: user, error: userError } = await supabase
    .from("usuarios")
    .select("id, email, nome, tipo, role")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user) {
    return { valid: false, error: "Usuário não encontrado" };
  }

  // Update last_seen_at
  await supabase
    .from("session_tokens")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token", sessionToken);

  return { valid: true, user };
}

// ===== Helper: Generate list code =====
function generateCodigoLista(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `IMEX-${dd}${mm}${yy}-${hh}${mi}`;
}

// ===== Helper: Log material transaction =====
async function logTransaction(
  supabase: any,
  tipo: string,
  codigoItem: string,
  qtd: number,
  usuario: string,
  options: { fornecedor?: string; endereco?: string; local?: string; referencia?: string; observacao?: string } = {}
) {
  await supabase.from("material_transactions").insert({
    tipo_transacao: tipo,
    codigo_item: codigoItem,
    qtd,
    usuario,
    fornecedor: options.fornecedor || null,
    endereco: options.endereco || null,
    local: options.local || null,
    referencia: options.referencia || null,
    observacao: options.observacao || null,
  });
}

// ===== Helper: Calculate SLA =====
function calcSlaMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / 60000);
}

// ===== Helper: Update solicitacao status based on lines =====
async function updateSolicitacaoStatus(supabase: any, solicitacaoId: string) {
  const { data: linhas } = await supabase
    .from("sep_linhas")
    .select("status_linha")
    .eq("solicitacao_id", solicitacaoId);

  if (!linhas || linhas.length === 0) return;

  const statuses = linhas.map((l: any) => l.status_linha);
  const allSeparado = statuses.every((s: string) => s === "Separado");
  const anyPendente = statuses.some((s: string) => s === "Pendente" || s === "FaltaPrioridade" || s === "Separando");
  const anyParcial = statuses.some((s: string) => s === "Parcial" || s === "CompraNecessaria");

  let newStatus: string | null = null;
  if (allSeparado) {
    newStatus = "Concluida";
  } else if (!anyPendente && anyParcial) {
    newStatus = "Parcial";
  }

  if (newStatus) {
    await supabase
      .from("sep_solicitacoes")
      .update({ status: newStatus, data_conclusao: new Date().toISOString() })
      .eq("id", solicitacaoId);
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  if (origin && !isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, sessionToken, ...params } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify session
    const auth = await verifySession(supabase, sessionToken);
    if (!auth.valid || !auth.user) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = auth.user;
    const isAdmin = user.tipo === "admin" || user.role === "SUPER_ADMIN" || user.role === "ADMIN";
    const isComercial = user.tipo === "comercial" || isAdmin;
    const isEstoque = user.tipo === "estoque" || isAdmin;

    // ===== ACTIONS =====

    // ----- COMERCIAL: Criar solicitação -----
    if (action === "criar_solicitacao") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const codigoLista = generateCodigoLista();
      const { observacoes_comercial } = params;

      const { data, error } = await supabase
        .from("sep_solicitacoes")
        .insert({
          codigo_lista: codigoLista,
          status: "Rascunho",
          criado_por: user.nome,
          criado_por_id: user.id,
          observacoes_comercial: observacoes_comercial || null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- COMERCIAL: Adicionar linha à solicitação -----
    if (action === "adicionar_linha") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id, pedido_cliente, item_cliente, codigo_item, fornecedor, qtd_solicitada, obs_comercial } = params;

      if (!solicitacao_id || !pedido_cliente || !codigo_item || !qtd_solicitada || qtd_solicitada <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados incompletos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate codigo_item exists in the system
      const codigoTrimmed = codigo_item.trim().toUpperCase();
      const { data: produtoExiste } = await supabase
        .from("enderecos_materiais")
        .select("codigo")
        .eq("codigo", codigoTrimmed)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (!produtoExiste) {
        // Check catalogo_produtos
        const { data: catalogoExiste } = await supabase
          .from("catalogo_produtos")
          .select("codigo")
          .eq("codigo", codigoTrimmed)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();

        if (!catalogoExiste) {
          return new Response(
            JSON.stringify({ success: false, error: `Código "${codigo_item}" não existe no sistema. Somente códigos cadastrados podem ser adicionados.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Check solicitacao is in Rascunho
      const { data: sol } = await supabase
        .from("sep_solicitacoes")
        .select("status")
        .eq("id", solicitacao_id)
        .single();

      if (!sol || sol.status !== "Rascunho") {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não está em rascunho" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("sep_linhas")
        .insert({
          solicitacao_id,
          pedido_cliente,
          item_cliente: item_cliente || null,
          codigo_item: codigoTrimmed,
          fornecedor: fornecedor || null,
          qtd_solicitada,
          obs_comercial: obs_comercial || null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- COMERCIAL: Importar linhas de Excel (batch) -----
    if (action === "importar_linhas") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id, linhas } = params;

      if (!solicitacao_id || !linhas || !Array.isArray(linhas) || linhas.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados incompletos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check solicitacao is in Rascunho
      const { data: sol } = await supabase
        .from("sep_solicitacoes")
        .select("status")
        .eq("id", solicitacao_id)
        .single();

      if (!sol || sol.status !== "Rascunho") {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não está em rascunho" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const insertData = linhas.map((l: any) => ({
        solicitacao_id,
        pedido_cliente: l.pedido_cliente || "",
        item_cliente: l.item_cliente || null,
        codigo_item: l.codigo_item || "",
        fornecedor: l.fornecedor || null,
        qtd_solicitada: parseInt(l.qtd_solicitada) || 1,
      }));

      const { data, error } = await supabase
        .from("sep_linhas")
        .insert(insertData)
        .select();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data, count: data?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- COMERCIAL: Enviar solicitação para estoque -----
    if (action === "enviar_solicitacao") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id } = params;

      // Get solicitacao and lines
      const { data: sol, error: solError } = await supabase
        .from("sep_solicitacoes")
        .select("id, status, codigo_lista")
        .eq("id", solicitacao_id)
        .single();

      if (solError || !sol) {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (sol.status !== "Rascunho") {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação já foi enviada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: linhas } = await supabase
        .from("sep_linhas")
        .select("id, codigo_item, qtd_solicitada, pedido_cliente")
        .eq("solicitacao_id", solicitacao_id);

      if (!linhas || linhas.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não tem linhas" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check stock availability and priorities
      const codigoMap: Record<string, { total: number; pedidos: Set<string>; linhaIds: string[] }> = {};
      for (const linha of linhas) {
        if (!codigoMap[linha.codigo_item]) {
          codigoMap[linha.codigo_item] = { total: 0, pedidos: new Set(), linhaIds: [] };
        }
        codigoMap[linha.codigo_item].total += linha.qtd_solicitada;
        codigoMap[linha.codigo_item].pedidos.add(linha.pedido_cliente);
        codigoMap[linha.codigo_item].linhaIds.push(linha.id);
      }

      // Get available stock from inventario
      const codigos = Object.keys(codigoMap);
      const { data: estoqueData } = await supabase
        .from("inventario")
        .select("quantidade, qtd_reservada, enderecos_materiais!inner(codigo)")
        .in("enderecos_materiais.codigo", codigos)
        .gt("quantidade", 0);

      const estoqueDisponivel: Record<string, number> = {};
      if (estoqueData) {
        for (const item of estoqueData) {
          const cod = (item.enderecos_materiais as any).codigo;
          if (!estoqueDisponivel[cod]) estoqueDisponivel[cod] = 0;
          estoqueDisponivel[cod] += (item.quantidade - (item.qtd_reservada || 0));
        }
      }

      // Check which codes need priority
      const needPriority: string[] = [];
      for (const [codigo, info] of Object.entries(codigoMap)) {
        const disponivel = estoqueDisponivel[codigo] || 0;
        if (disponivel < info.total && info.pedidos.size > 1) {
          needPriority.push(codigo);
          // Mark lines as FaltaPrioridade
          await supabase
            .from("sep_linhas")
            .update({ status_linha: "FaltaPrioridade" })
            .in("id", info.linhaIds);
        } else {
          // Update qtd_disponivel_snapshot
          for (const linhaId of info.linhaIds) {
            await supabase
              .from("sep_linhas")
              .update({ qtd_disponivel_snapshot: disponivel })
              .eq("id", linhaId);
          }
        }
      }

      // Update solicitacao status
      await supabase
        .from("sep_solicitacoes")
        .update({
          status: "Enviada",
          data_abertura: new Date().toISOString(),
        })
        .eq("id", solicitacao_id);

      return new Response(
        JSON.stringify({
          success: true,
          needPriority: needPriority.length > 0,
          codigosComPrioridade: needPriority,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- COMERCIAL: Definir prioridade -----
    if (action === "definir_prioridade") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { prioridades } = params; // Array of { linha_id, prioridade }

      if (!prioridades || !Array.isArray(prioridades)) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados inválidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const p of prioridades) {
        await supabase
          .from("sep_linhas")
          .update({ prioridade: p.prioridade, status_linha: "Pendente" })
          .eq("id", p.linha_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Listar solicitações -----
    if (action === "listar_solicitacoes") {
      let query = supabase
        .from("sep_solicitacoes")
        .select("*, sep_linhas(count)")
        .order("created_at", { ascending: false });

      // Comercial sees only their own unless admin
      if (!isAdmin && isComercial) {
        query = query.eq("criado_por_id", user.id);
      }

      // Filter by status if provided
      if (params.status) {
        query = query.eq("status", params.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate SLA
      const result = (data || []).map((s: any) => ({
        ...s,
        sla_inicio_min: calcSlaMinutes(s.data_abertura, s.data_inicio_estoque),
        sla_total_min: calcSlaMinutes(s.data_abertura, s.data_conclusao),
        total_linhas: s.sep_linhas?.[0]?.count || 0,
      }));

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Listar fila de separação (Estoque) -----
    if (action === "fila_separacao") {
      if (!isEstoque) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("sep_solicitacoes")
        .select("*, sep_linhas(id, status_linha, qtd_solicitada, qtd_reservada, qtd_separada)")
        .in("status", ["Enviada", "EmSeparacao"])
        .order("data_abertura", { ascending: true });

      if (error) throw error;

      const result = (data || []).map((s: any) => {
        const linhas = s.sep_linhas || [];
        const totalSolicitado = linhas.reduce((sum: number, l: any) => sum + l.qtd_solicitada, 0);
        const totalSeparado = linhas.reduce((sum: number, l: any) => sum + l.qtd_separada, 0);
        const percentConcluido = totalSolicitado > 0 ? Math.round((totalSeparado / totalSolicitado) * 100) : 0;
        const tempoAberto = s.data_abertura
          ? Math.round((Date.now() - new Date(s.data_abertura).getTime()) / 60000)
          : 0;

        return {
          ...s,
          total_linhas: linhas.length,
          total_solicitado: totalSolicitado,
          total_separado: totalSeparado,
          percent_concluido: percentConcluido,
          tempo_aberto_min: tempoAberto,
        };
      });

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Detalhe da solicitação -----
    if (action === "detalhe_solicitacao") {
      const { solicitacao_id } = params;

      const { data: sol, error } = await supabase
        .from("sep_solicitacoes")
        .select("*")
        .eq("id", solicitacao_id)
        .single();

      if (error || !sol) {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: linhas } = await supabase
        .from("sep_linhas")
        .select("*, sep_alocacoes(*)")
        .eq("solicitacao_id", solicitacao_id)
        .order("prioridade", { ascending: true, nullsFirst: false })
        .order("pedido_cliente", { ascending: true });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            solicitacao: {
              ...sol,
              sla_inicio_min: calcSlaMinutes(sol.data_abertura, sol.data_inicio_estoque),
              sla_total_min: calcSlaMinutes(sol.data_abertura, sol.data_conclusao),
            },
            linhas: linhas || [],
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- ESTOQUE: Iniciar separação -----
    if (action === "iniciar_separacao") {
      if (!isEstoque) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id } = params;

      const { data: sol, error: solError } = await supabase
        .from("sep_solicitacoes")
        .select("id, status, codigo_lista")
        .eq("id", solicitacao_id)
        .single();

      if (solError || !sol) {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (sol.status !== "Enviada") {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não está disponível para separação" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if any line needs priority
      const { data: linhasPrio } = await supabase
        .from("sep_linhas")
        .select("id")
        .eq("solicitacao_id", solicitacao_id)
        .eq("status_linha", "FaltaPrioridade");

      if (linhasPrio && linhasPrio.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Existem itens aguardando definição de prioridade pelo Comercial",
            needPriority: true,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("sep_solicitacoes")
        .update({
          status: "EmSeparacao",
          data_inicio_estoque: new Date().toISOString(),
        })
        .eq("id", solicitacao_id);

      // Log transaction
      await logTransaction(supabase, "SEPARACAO_INICIO", sol.codigo_lista, 0, user.email, {
        referencia: sol.codigo_lista,
        observacao: `Separação iniciada por ${user.nome}`,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- ESTOQUE: Buscar endereços disponíveis para código -----
    if (action === "buscar_enderecos_codigo") {
      if (!isEstoque) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { codigo_item } = params;

      const { data, error } = await supabase
        .from("inventario")
        .select(`
          id,
          quantidade,
          qtd_reservada,
          endereco_material_id,
          enderecos_materiais!inner(id, codigo, descricao, rua, coluna, nivel, posicao)
        `)
        .eq("enderecos_materiais.codigo", codigo_item)
        .gt("quantidade", 0);

      if (error) throw error;

      const result = (data || []).map((item: any) => {
        const em = item.enderecos_materiais;
        return {
          inventario_id: item.id,
          endereco_material_id: item.endereco_material_id,
          codigo: em.codigo,
          descricao: em.descricao,
          rua: em.rua,
          coluna: em.coluna,
          nivel: em.nivel,
          posicao: em.posicao,
          endereco_formatado: `R${String(em.rua).padStart(2, "0")}-C${String(em.coluna).padStart(2, "0")}-N${String(em.nivel).padStart(2, "0")}-P${String(em.posicao).padStart(2, "0")}`,
          qtd_total: item.quantidade,
          qtd_reservada: item.qtd_reservada || 0,
          qtd_disponivel: item.quantidade - (item.qtd_reservada || 0),
        };
      }).filter((item: any) => item.qtd_disponivel > 0);

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- ESTOQUE: Reservar/Retirar do endereço -----
    if (action === "reservar_endereco") {
      if (!isEstoque) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { linha_id, inventario_id, qtd_retirada } = params;

      if (!linha_id || !inventario_id || !qtd_retirada || qtd_retirada <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados incompletos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get line info
      const { data: linha } = await supabase
        .from("sep_linhas")
        .select("*, sep_solicitacoes(codigo_lista)")
        .eq("id", linha_id)
        .single();

      if (!linha) {
        return new Response(
          JSON.stringify({ success: false, error: "Linha não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get inventario and endereco info
      const { data: inv } = await supabase
        .from("inventario")
        .select("*, enderecos_materiais(*)")
        .eq("id", inventario_id)
        .single();

      if (!inv) {
        return new Response(
          JSON.stringify({ success: false, error: "Endereço não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const disponivel = inv.quantidade - (inv.qtd_reservada || 0);
      if (disponivel < qtd_retirada) {
        return new Response(
          JSON.stringify({ success: false, error: `Quantidade disponível insuficiente. Disponível: ${disponivel}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const em = inv.enderecos_materiais;
      const enderecoStr = `R${String(em.rua).padStart(2, "0")}-C${String(em.coluna).padStart(2, "0")}-N${String(em.nivel).padStart(2, "0")}-P${String(em.posicao).padStart(2, "0")}`;

      // 1) Update inventario: increase qtd_reservada
      await supabase
        .from("inventario")
        .update({ qtd_reservada: (inv.qtd_reservada || 0) + qtd_retirada })
        .eq("id", inventario_id);

      // 2) Create sep_alocacoes
      await supabase.from("sep_alocacoes").insert({
        linha_id,
        endereco_material_id: inv.endereco_material_id,
        rua: em.rua,
        coluna: em.coluna,
        nivel: em.nivel,
        posicao: em.posicao,
        qtd_retirada,
        usuario_estoque: user.email,
        destino_local: "AREA_SEPARACAO",
        status: "Reservado",
      });

      // 3) Update sep_linhas
      const newReservada = (linha.qtd_reservada || 0) + qtd_retirada;
      let newStatus = linha.status_linha;
      if (newReservada >= linha.qtd_solicitada) {
        newStatus = "Separando";
      } else if (newReservada > 0) {
        newStatus = "Parcial";
      }

      await supabase
        .from("sep_linhas")
        .update({ qtd_reservada: newReservada, status_linha: newStatus })
        .eq("id", linha_id);

      // 4) Update area_separacao_resumo
      const { data: areaExistente } = await supabase
        .from("area_separacao_resumo")
        .select("id, qtd_em_separacao")
        .eq("codigo_item", linha.codigo_item)
        .maybeSingle();

      if (areaExistente) {
        await supabase
          .from("area_separacao_resumo")
          .update({ qtd_em_separacao: areaExistente.qtd_em_separacao + qtd_retirada })
          .eq("id", areaExistente.id);
      } else {
        await supabase.from("area_separacao_resumo").insert({
          codigo_item: linha.codigo_item,
          qtd_em_separacao: qtd_retirada,
        });
      }

      // 5) Log transactions
      const codigoLista = linha.sep_solicitacoes?.codigo_lista || "";
      await logTransaction(supabase, "RESERVA_SAIDA_ARMAZENAGEM", linha.codigo_item, qtd_retirada, user.email, {
        endereco: enderecoStr,
        referencia: `${linha.pedido_cliente} / ${codigoLista}`,
        observacao: `Retirada para área de separação`,
      });

      await logTransaction(supabase, "ENTRADA_AREA_SEPARACAO", linha.codigo_item, qtd_retirada, user.email, {
        local: "AREA_SEPARACAO",
        referencia: `${linha.pedido_cliente} / ${codigoLista}`,
      });

      return new Response(
        JSON.stringify({ success: true, qtd_reservada: newReservada, status_linha: newStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- ESTOQUE: Confirmar separação da linha -----
    if (action === "confirmar_separacao") {
      if (!isEstoque) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { linha_id, qtd_separada, obs_estoque } = params;

      const { data: linha } = await supabase
        .from("sep_linhas")
        .select("*, sep_solicitacoes(id, codigo_lista)")
        .eq("id", linha_id)
        .single();

      if (!linha) {
        return new Response(
          JSON.stringify({ success: false, error: "Linha não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const qtdFinal = qtd_separada !== undefined ? qtd_separada : linha.qtd_reservada;
      let newStatus: string;

      if (qtdFinal >= linha.qtd_solicitada) {
        newStatus = "Separado";
      } else if (qtdFinal > 0 && qtdFinal < linha.qtd_solicitada) {
        newStatus = "Parcial";
      } else {
        newStatus = "CompraNecessaria";
      }

      await supabase
        .from("sep_linhas")
        .update({
          qtd_separada: qtdFinal,
          status_linha: newStatus,
          obs_estoque: obs_estoque || linha.obs_estoque,
        })
        .eq("id", linha_id);

      // Update alocacoes to Separado
      await supabase
        .from("sep_alocacoes")
        .update({ status: "Separado" })
        .eq("linha_id", linha_id)
        .eq("status", "Reservado");

      // Log
      await logTransaction(supabase, "SEPARACAO_CONFIRMADA", linha.codigo_item, qtdFinal, user.email, {
        referencia: `${linha.pedido_cliente} / ${linha.sep_solicitacoes?.codigo_lista}`,
        observacao: obs_estoque || null,
      });

      // Check if solicitacao is complete
      if (linha.sep_solicitacoes?.id) {
        await updateSolicitacaoStatus(supabase, linha.sep_solicitacoes.id);
      }

      return new Response(
        JSON.stringify({ success: true, status_linha: newStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- COMERCIAL: Criar cancelamento -----
    if (action === "criar_cancelamento") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { pedido_cliente, motivo, linhas } = params;

      if (!pedido_cliente || !linhas || !Array.isArray(linhas) || linhas.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados incompletos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create cancelamento
      const { data: canc, error: cancError } = await supabase
        .from("cancelamentos")
        .insert({
          pedido_cliente,
          criado_por: user.nome,
          criado_por_id: user.id,
          motivo: motivo || null,
          status: "Aberto",
        })
        .select()
        .single();

      if (cancError) throw cancError;

      // Create linhas
      const linhasData = linhas.map((l: any) => ({
        cancelamento_id: canc.id,
        codigo_item: l.codigo_item,
        fornecedor: l.fornecedor || null,
        qtd_cancelada: l.qtd_cancelada,
        status_linha: "PendenteDevolucao",
      }));

      await supabase.from("cancelamentos_linhas").insert(linhasData);

      // Log transactions
      for (const l of linhas) {
        await logTransaction(supabase, "CANCELAMENTO_CRIADO", l.codigo_item, l.qtd_cancelada, user.email, {
          fornecedor: l.fornecedor,
          referencia: pedido_cliente,
          observacao: motivo,
        });
      }

      return new Response(
        JSON.stringify({ success: true, data: canc }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Listar cancelamentos -----
    if (action === "listar_cancelamentos") {
      let query = supabase
        .from("cancelamentos")
        .select("*, cancelamentos_linhas(count)")
        .order("created_at", { ascending: false });

      if (params.status) {
        query = query.eq("status", params.status);
      }

      // Filter for non-admin comercial
      if (!isAdmin && isComercial && !isEstoque) {
        query = query.eq("criado_por_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const result = (data || []).map((c: any) => ({
        ...c,
        total_linhas: c.cancelamentos_linhas?.[0]?.count || 0,
      }));

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Detalhe cancelamento -----
    if (action === "detalhe_cancelamento") {
      const { cancelamento_id } = params;

      const { data: canc, error } = await supabase
        .from("cancelamentos")
        .select("*, cancelamentos_linhas(*, devolucoes_alocacoes(*))")
        .eq("id", cancelamento_id)
        .single();

      if (error || !canc) {
        return new Response(
          JSON.stringify({ success: false, error: "Cancelamento não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: canc }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- ESTOQUE: Endereçar devolução -----
    if (action === "enderecear_devolucao") {
      if (!isEstoque) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { cancelamento_linha_id, endereco_material_id, qtd_devolvida } = params;

      if (!cancelamento_linha_id || !endereco_material_id || !qtd_devolvida || qtd_devolvida <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados incompletos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get cancelamento linha
      const { data: linha } = await supabase
        .from("cancelamentos_linhas")
        .select("*, cancelamentos(pedido_cliente)")
        .eq("id", cancelamento_linha_id)
        .single();

      if (!linha) {
        return new Response(
          JSON.stringify({ success: false, error: "Linha de cancelamento não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const qtdPendente = linha.qtd_cancelada - linha.qtd_devolvida_total;
      if (qtd_devolvida > qtdPendente) {
        return new Response(
          JSON.stringify({ success: false, error: `Quantidade maior que pendente. Pendente: ${qtdPendente}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get endereco destino
      const { data: em } = await supabase
        .from("enderecos_materiais")
        .select("*")
        .eq("id", endereco_material_id)
        .single();

      if (!em) {
        return new Response(
          JSON.stringify({ success: false, error: "Endereço de destino não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const enderecoStr = `R${String(em.rua).padStart(2, "0")}-C${String(em.coluna).padStart(2, "0")}-N${String(em.nivel).padStart(2, "0")}-P${String(em.posicao).padStart(2, "0")}`;

      // 1) Create devolucao alocacao
      await supabase.from("devolucoes_alocacoes").insert({
        cancelamento_linha_id,
        endereco_material_id,
        rua: em.rua,
        coluna: em.coluna,
        nivel: em.nivel,
        posicao: em.posicao,
        qtd_devolvida,
        usuario_estoque: user.email,
      });

      // 2) Update inventario destino (add to quantidade)
      const { data: invDestino } = await supabase
        .from("inventario")
        .select("id, quantidade")
        .eq("endereco_material_id", endereco_material_id)
        .maybeSingle();

      if (invDestino) {
        await supabase
          .from("inventario")
          .update({ quantidade: invDestino.quantidade + qtd_devolvida })
          .eq("id", invDestino.id);
      } else {
        // Create new inventario record
        await supabase.from("inventario").insert({
          endereco_material_id,
          quantidade: qtd_devolvida,
          contagem_num: 1,
          contado_por: user.email,
        });
      }

      // 3) Update cancelamentos_linhas
      const newDevolvida = linha.qtd_devolvida_total + qtd_devolvida;
      let newStatus: string;
      if (newDevolvida >= linha.qtd_cancelada) {
        newStatus = "DevolvidoTotal";
      } else {
        newStatus = "Devolvendo";
      }

      await supabase
        .from("cancelamentos_linhas")
        .update({ qtd_devolvida_total: newDevolvida, status_linha: newStatus })
        .eq("id", cancelamento_linha_id);

      // 4) Update cancelamento status
      const { data: todasLinhas } = await supabase
        .from("cancelamentos_linhas")
        .select("status_linha")
        .eq("cancelamento_id", linha.cancelamento_id);

      if (todasLinhas) {
        const allDone = todasLinhas.every((l: any) => l.status_linha === "DevolvidoTotal");
        const anyDevolvendo = todasLinhas.some((l: any) => l.status_linha === "Devolvendo" || l.status_linha === "DevolvidoTotal");

        let cancStatus = "Aberto";
        if (allDone) {
          cancStatus = "Concluido";
        } else if (anyDevolvendo) {
          cancStatus = "EmProcesso";
        }

        await supabase
          .from("cancelamentos")
          .update({ status: cancStatus })
          .eq("id", linha.cancelamento_id);
      }

      // 5) Update area_separacao_resumo
      const { data: areaItem } = await supabase
        .from("area_separacao_resumo")
        .select("id, qtd_em_separacao")
        .eq("codigo_item", linha.codigo_item)
        .maybeSingle();

      if (areaItem) {
        const newQtd = Math.max(0, areaItem.qtd_em_separacao - qtd_devolvida);
        await supabase
          .from("area_separacao_resumo")
          .update({ qtd_em_separacao: newQtd })
          .eq("id", areaItem.id);
      }

      // 6) Reduce qtd_reservada from original sep_alocacoes (FIFO)
      // Find alocacoes for this codigo/pedido that have remaining reserved qty
      const { data: alocacoes } = await supabase
        .from("sep_alocacoes")
        .select("*, sep_linhas!inner(codigo_item, pedido_cliente)")
        .eq("sep_linhas.codigo_item", linha.codigo_item)
        .eq("sep_linhas.pedido_cliente", linha.cancelamentos?.pedido_cliente)
        .gt("qtd_retirada", 0)
        .order("created_at", { ascending: true });

      let remaining = qtd_devolvida;
      for (const aloc of alocacoes || []) {
        if (remaining <= 0) break;
        const saldoAlocacao = aloc.qtd_retirada - (aloc.qtd_devolvida || 0);
        if (saldoAlocacao <= 0) continue;

        const toReduce = Math.min(remaining, saldoAlocacao);

        // Update alocacao
        await supabase
          .from("sep_alocacoes")
          .update({
            qtd_devolvida: (aloc.qtd_devolvida || 0) + toReduce,
            status: saldoAlocacao - toReduce <= 0 ? "Devolvido" : aloc.status,
          })
          .eq("id", aloc.id);

        // Update inventario origem (reduce qtd_reservada)
        const { data: invOrigem } = await supabase
          .from("inventario")
          .select("id, qtd_reservada")
          .eq("endereco_material_id", aloc.endereco_material_id)
          .maybeSingle();

        if (invOrigem) {
          await supabase
            .from("inventario")
            .update({ qtd_reservada: Math.max(0, (invOrigem.qtd_reservada || 0) - toReduce) })
            .eq("id", invOrigem.id);
        }

        remaining -= toReduce;
      }

      // 7) Log transactions
      await logTransaction(supabase, "SAIDA_AREA_SEPARACAO", linha.codigo_item, qtd_devolvida, user.email, {
        local: "AREA_SEPARACAO",
        referencia: linha.cancelamentos?.pedido_cliente,
      });

      await logTransaction(supabase, "DEVOLUCAO_ENTRADA_ARMAZENAGEM", linha.codigo_item, qtd_devolvida, user.email, {
        endereco: enderecoStr,
        referencia: linha.cancelamentos?.pedido_cliente,
      });

      return new Response(
        JSON.stringify({ success: true, qtd_devolvida_total: newDevolvida, status_linha: newStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Listar material transactions -----
    if (action === "listar_transactions") {
      let query = supabase
        .from("material_transactions")
        .select("*")
        .order("data_hora", { ascending: false })
        .limit(params.limit || 100);

      if (params.codigo_item) {
        query = query.ilike("codigo_item", `%${params.codigo_item}%`);
      }
      if (params.referencia) {
        query = query.ilike("referencia", `%${params.referencia}%`);
      }
      if (params.tipo_transacao) {
        query = query.eq("tipo_transacao", params.tipo_transacao);
      }
      if (params.data_inicio) {
        query = query.gte("data_hora", params.data_inicio);
      }
      if (params.data_fim) {
        query = query.lte("data_hora", params.data_fim);
      }

      const { data, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Área de separação resumo -----
    if (action === "area_separacao") {
      const { data, error } = await supabase
        .from("area_separacao_resumo")
        .select("*")
        .gt("qtd_em_separacao", 0)
        .order("codigo_item", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Buscar endereços para devolução (por código) -----
    if (action === "buscar_enderecos_devolucao") {
      const { codigo_item } = params;

      // Get existing addresses for this code (or create new)
      const { data: enderecos, error } = await supabase
        .from("enderecos_materiais")
        .select("id, codigo, descricao, rua, coluna, nivel, posicao")
        .eq("codigo", codigo_item)
        .eq("ativo", true);

      if (error) throw error;

      const result = (enderecos || []).map((em: any) => ({
        endereco_material_id: em.id,
        codigo: em.codigo,
        descricao: em.descricao,
        rua: em.rua,
        coluna: em.coluna,
        nivel: em.nivel,
        posicao: em.posicao,
        endereco_formatado: `R${String(em.rua).padStart(2, "0")}-C${String(em.coluna).padStart(2, "0")}-N${String(em.nivel).padStart(2, "0")}-P${String(em.posicao).padStart(2, "0")}`,
      }));

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Excluir linha de solicitação -----
    if (action === "excluir_linha") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { linha_id } = params;

      // Check if solicitacao is in Rascunho
      const { data: linha } = await supabase
        .from("sep_linhas")
        .select("solicitacao_id, sep_solicitacoes(status)")
        .eq("id", linha_id)
        .single();

      const solStatus = (linha?.sep_solicitacoes as any)?.status;
      if (!linha || solStatus !== "Rascunho") {
        return new Response(
          JSON.stringify({ success: false, error: "Não é possível excluir linha após envio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("sep_linhas").delete().eq("id", linha_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Excluir solicitação (Rascunho only) -----
    if (action === "excluir_solicitacao") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { solicitacao_id } = params;

      const { data: sol } = await supabase
        .from("sep_solicitacoes")
        .select("status")
        .eq("id", solicitacao_id)
        .single();

      if (!sol || sol.status !== "Rascunho") {
        return new Response(
          JSON.stringify({ success: false, error: "Só é possível excluir solicitações em rascunho" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("sep_solicitacoes").delete().eq("id", solicitacao_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Buscar produto por código (validação + auto-preenchimento) -----
    if (action === "buscar_produto") {
      const { codigo } = params;

      if (!codigo || codigo.trim() === "") {
        return new Response(
          JSON.stringify({ success: false, error: "Código não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const codigoTrimmed = codigo.trim().toUpperCase();

      // First try to find in enderecos_materiais (stock items)
      const { data: endereco, error: enderecoError } = await supabase
        .from("enderecos_materiais")
        .select("codigo, descricao, fabricantes(nome, codigo)")
        .eq("codigo", codigoTrimmed)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (endereco) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              codigo: endereco.codigo,
              descricao: endereco.descricao,
              fornecedor: (endereco.fabricantes as any)?.nome || (endereco.fabricantes as any)?.codigo || null,
              encontrado: true,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If not found in enderecos, try catalogo_produtos
      const { data: catalogo } = await supabase
        .from("catalogo_produtos")
        .select("codigo, descricao")
        .eq("codigo", codigoTrimmed)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (catalogo) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              codigo: catalogo.codigo,
              descricao: catalogo.descricao,
              fornecedor: null,
              encontrado: true,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Not found
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            codigo: codigoTrimmed,
            descricao: null,
            fornecedor: null,
            encontrado: false,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----- Editar linha de solicitação -----
    if (action === "editar_linha") {
      if (!isComercial) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { linha_id, pedido_cliente, item_cliente, codigo_item, fornecedor, qtd_solicitada, obs_comercial } = params;

      if (!linha_id) {
        return new Response(
          JSON.stringify({ success: false, error: "ID da linha não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get line and check status
      const { data: linha } = await supabase
        .from("sep_linhas")
        .select("id, status_linha, sep_solicitacoes(status)")
        .eq("id", linha_id)
        .single();

      if (!linha) {
        return new Response(
          JSON.stringify({ success: false, error: "Linha não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const solStatus = (linha.sep_solicitacoes as any)?.status;
      const linhaStatus = linha.status_linha;

      // Can only edit if:
      // - Solicitacao is Rascunho, OR
      // - Solicitacao is Enviada and linha is Pendente or FaltaPrioridade
      const isRascunho = solStatus === "Rascunho";
      const isEnviadaPendente = solStatus === "Enviada" && (linhaStatus === "Pendente" || linhaStatus === "FaltaPrioridade");

      if (!isRascunho && !isEnviadaPendente) {
        return new Response(
          JSON.stringify({ success: false, error: "Não é possível editar linha após início da separação física" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate codigo_item if provided
      if (codigo_item) {
        const { data: produtoExiste } = await supabase
          .from("enderecos_materiais")
          .select("codigo")
          .eq("codigo", codigo_item.trim().toUpperCase())
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();

        if (!produtoExiste) {
          // Check catalogo_produtos
          const { data: catalogoExiste } = await supabase
            .from("catalogo_produtos")
            .select("codigo")
            .eq("codigo", codigo_item.trim().toUpperCase())
            .eq("ativo", true)
            .limit(1)
            .maybeSingle();

          if (!catalogoExiste) {
            return new Response(
              JSON.stringify({ success: false, error: `Código "${codigo_item}" não existe no sistema` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      // Build update object
      const updateData: Record<string, any> = {};
      if (pedido_cliente !== undefined) updateData.pedido_cliente = pedido_cliente;
      if (item_cliente !== undefined) updateData.item_cliente = item_cliente || null;
      if (codigo_item !== undefined) updateData.codigo_item = codigo_item.trim().toUpperCase();
      if (fornecedor !== undefined) updateData.fornecedor = fornecedor || null;
      if (qtd_solicitada !== undefined && qtd_solicitada > 0) updateData.qtd_solicitada = qtd_solicitada;
      if (obs_comercial !== undefined) updateData.obs_comercial = obs_comercial || null;

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhum campo para atualizar" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("sep_linhas")
        .update(updateData)
        .eq("id", linha_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Separacao-material error:", error);
    const origin = req.headers.get("origin");
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
