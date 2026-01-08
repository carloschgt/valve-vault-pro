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

// Server-side admin verification - CRITICAL for security
async function verifyAdminUser(supabase: any, userEmail: string): Promise<boolean> {
  if (!userEmail) return false;
  
  const { data: user, error } = await supabase
    .from("usuarios")
    .select("tipo")
    .eq("email", userEmail.toLowerCase().trim())
    .maybeSingle();
  
  if (error || !user) return false;
  return user.tipo === 'admin';
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin for non-OPTIONS requests
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

    const { action, userId, aprovado, search, adminEmail, tipo, status, suspendedUntil, statusFilter } = await req.json();

    console.log(`Admin users action: ${action}, adminEmail: ${adminEmail}`);

    // Actions that don't require admin (for user self-check)
    if (action === "checkApprovalNotification") {
      const { data: user, error } = await supabase
        .from("usuarios")
        .select("status, notificado_aprovacao")
        .eq("id", userId)
        .maybeSingle();
      
      if (error || !user) {
        return new Response(
          JSON.stringify({ success: true, showNotification: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Show notification if user is ativo and hasn't been notified yet
      const showNotification = user.status === 'ativo' && !user.notificado_aprovacao;

      return new Response(
        JSON.stringify({ success: true, showNotification }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "dismissApprovalNotification") {
      await supabase
        .from("usuarios")
        .update({ notificado_aprovacao: true })
        .eq("id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Server-side admin verification for ALL other operations
    if (!adminEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Email do administrador não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = await verifyAdminUser(supabase, adminEmail);
    if (!isAdmin) {
      console.error(`Unauthorized admin attempt by: ${adminEmail}`);
      return new Response(
        JSON.stringify({ success: false, error: "Acesso não autorizado. Apenas administradores podem executar esta ação." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      let query = supabase
        .from("usuarios")
        .select("id, nome, email, tipo, aprovado, status, suspenso_ate, created_at")
        .order("created_at", { ascending: false });

      if (search) {
        const sanitizedSearch = sanitizeSearchTerm(search);
        if (sanitizedSearch) {
          query = query.or(`nome.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
        }
      }

      // Filter by status
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq("status", statusFilter);
      }

      const { data: users, error } = await query;

      if (error) throw error;

      // Calculate counts for each status
      const { data: allUsers } = await supabase
        .from("usuarios")
        .select("status");

      const counts = {
        pendente: 0,
        ativo: 0,
        suspenso: 0,
        negado: 0,
        total: allUsers?.length || 0,
      };

      allUsers?.forEach((u: any) => {
        if (counts[u.status as keyof typeof counts] !== undefined) {
          counts[u.status as keyof typeof counts]++;
        }
      });

      return new Response(
        JSON.stringify({ success: true, users, counts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "getUser") {
      const { data: user, error } = await supabase
        .from("usuarios")
        .select("id, nome, email, tipo, aprovado, status, suspenso_ate, notificado_aprovacao, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, user }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "userLogs") {
      const { data: logs, error } = await supabase
        .from("login_logs")
        .select("*")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logs") {
      const { data: logs, error } = await supabase
        .from("login_logs")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "approve") {
      // Update both aprovado and status
      const newStatus = aprovado ? 'ativo' : 'pendente';
      const { error } = await supabase
        .from("usuarios")
        .update({ 
          aprovado, 
          status: newStatus,
          notificado_aprovacao: false, // Reset notification flag when status changes
          suspenso_ate: null,
        })
        .eq("id", userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "updateUser") {
      const updateData: any = {};
      
      if (tipo && ['user', 'admin', 'estoque', 'comercial'].includes(tipo)) {
        updateData.tipo = tipo;
      }
      
      if (status && ['pendente', 'ativo', 'suspenso', 'negado'].includes(status)) {
        updateData.status = status;
        updateData.aprovado = status === 'ativo';
        
        // Reset notification flag so user sees notification on next login
        if (status === 'ativo') {
          updateData.notificado_aprovacao = false;
        }
        
        // Handle suspended until date
        if (status === 'suspenso' && suspendedUntil) {
          updateData.suspenso_ate = new Date(suspendedUntil).toISOString();
        } else if (status !== 'suspenso') {
          updateData.suspenso_ate = null;
        }
      }

      if (suspendedUntil === null) {
        updateData.suspenso_ate = null;
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhum dado para atualizar" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("usuarios")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      console.log(`User ${userId} updated by admin ${adminEmail}:`, updateData);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "updateRole") {
      if (!userId || !tipo || !['user', 'admin', 'estoque', 'comercial'].includes(tipo)) {
        return new Response(
          JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("usuarios")
        .update({ tipo })
        .eq("id", userId);

      if (error) throw error;

      console.log(`User ${userId} role updated to ${tipo} by admin ${adminEmail}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      // First delete related records
      await supabase.from("login_logs").delete().eq("user_id", userId);
      await supabase.from("session_tokens").delete().eq("user_id", userId);
      await supabase.from("webauthn_credentials").delete().eq("user_id", userId);

      // Then delete user
      const { error } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Ação inválida");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Admin users error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
