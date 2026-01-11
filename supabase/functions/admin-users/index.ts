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

    const { action, userId, aprovado, search, adminEmail, tipo, status, suspendedUntil, statusFilter, notificationId } = await req.json();

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

    // Get all pending admin actions (for notification center)
    if (action === "getPendingActions") {
      // 1. Pending users
      const { data: pendingUsers } = await supabase
        .from("usuarios")
        .select("id, nome, email, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      // 2. Password reset requests - deduplicate by user_id
      const { data: resetRequests } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados, created_at, mensagem, titulo")
        .eq("tipo", "reset_senha")
        .eq("lida", false)
        .order("created_at", { ascending: false });

      // Deduplicate reset requests by user_id - keep only the latest one per user
      const seenUserIds = new Set<string>();
      const uniqueResetRequests = (resetRequests || []).filter((r: any) => {
        let dados = r.dados;
        if (typeof dados === 'string') {
          try { dados = JSON.parse(dados); } catch { dados = {}; }
        }
        const userId = dados?.user_id;
        if (!userId || seenUserIds.has(userId)) {
          return false;
        }
        seenUserIds.add(userId);
        return true;
      });

      // 3. Pending code approvals
      const { data: pendingCodes } = await supabase
        .from("solicitacoes_codigo")
        .select("id, descricao, codigo_gerado, created_at, solicitado_por")
        .eq("status", "codigo_gerado")
        .order("created_at", { ascending: false });

      // 4. Locked users (due to failed login attempts)
      const { data: lockedUsers } = await supabase
        .from("usuarios")
        .select("id, nome, email, locked_until, failed_attempts")
        .not("locked_until", "is", null)
        .gt("locked_until", new Date().toISOString())
        .order("locked_until", { ascending: false });

      return new Response(
        JSON.stringify({ 
          success: true, 
          pendingUsers: pendingUsers || [], 
          resetRequests: uniqueResetRequests, 
          pendingCodes: pendingCodes || [],
          lockedUsers: lockedUsers || []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has pending password reset
    if (action === "checkPasswordReset") {
      const { data: resetNotif } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados, created_at")
        .eq("tipo", "reset_senha")
        .eq("lida", false)
        .order("created_at", { ascending: false });

      // Find if any reset request matches the userId
      const pendingReset = resetNotif?.find((r: any) => {
        let dados = r.dados;
        if (typeof dados === 'string') {
          try { dados = JSON.parse(dados); } catch (e) { dados = {}; }
        }
        return dados?.user_id === userId;
      });

      return new Response(
        JSON.stringify({ success: true, hasPendingReset: !!pendingReset, resetData: pendingReset }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Approve password reset - mark notification as read and set flag requiring new password
    if (action === "approvePasswordReset") {
      // Get the notification to find user details
      const { data: notif, error: notifError } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados")
        .eq("id", notificationId || userId)
        .maybeSingle();

      if (notifError) throw notifError;

      if (notif) {
        let dados = notif.dados;
        if (typeof dados === 'string') {
          try { dados = JSON.parse(dados); } catch (e) { dados = {}; }
        }

        // Mark ALL notifications for this user as read (to clean up duplicates)
        if (dados?.user_id) {
          const { data: allNotifs } = await supabase
            .from("notificacoes_usuario")
            .select("id, dados")
            .eq("tipo", "reset_senha")
            .eq("lida", false);

          const userNotifIds = (allNotifs || [])
            .filter((n: any) => {
              let d = n.dados;
              if (typeof d === 'string') {
                try { d = JSON.parse(d); } catch { d = {}; }
              }
              return d?.user_id === dados.user_id;
            })
            .map((n: any) => n.id);

          if (userNotifIds.length > 0) {
            await supabase
              .from("notificacoes_usuario")
              .update({ lida: true })
              .in("id", userNotifIds);
          }

          // Delete any existing unused tokens for this user
          await supabase
            .from("password_reset_tokens")
            .delete()
            .eq("user_id", dados.user_id)
            .is("used_at", null);

          // Generate a reset token for the user to use
          const resetToken = crypto.randomUUID() + '-' + crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          // Store the reset token
          await supabase.from("password_reset_tokens").insert({
            user_id: dados.user_id,
            user_email: dados.user_email,
            token: resetToken,
            expires_at: expiresAt.toISOString(),
          });

          console.log(`Password reset approved for user ${dados?.user_email} by admin ${adminEmail}. Token created.`);

          // Send email to user with reset link
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            const baseUrl = "https://bdetejjahokasedpghlp.lovableproject.com";
            const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

            try {
              const emailResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: "IMEX Sistema <onboarding@resend.dev>",
                  to: [dados.user_email],
                  subject: "Redefinição de Senha Aprovada - IMEX Sistema",
                  html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <div style="background: linear-gradient(135deg, #1a365d 0%, #2563eb 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">IMEX Sistema</h1>
                      </div>
                      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
                        <h2 style="color: #1a365d; margin-top: 0;">Olá, ${dados.user_nome || 'Usuário'}!</h2>
                        <p>Sua solicitação de redefinição de senha foi <strong>aprovada pelo administrador</strong>.</p>
                        <p>Clique no botão abaixo para criar uma <strong>nova senha</strong>:</p>
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Criar Nova Senha</a>
                        </div>
                        <p style="color: #dc2626; font-size: 14px;"><strong>Importante:</strong> Você não poderá fazer login até criar uma nova senha. A nova senha deve ser diferente da anterior.</p>
                        <p style="color: #64748b; font-size: 14px;">Este link expira em <strong>24 horas</strong>.</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                          Este é um email automático do IMEX Sistema. Por favor, não responda.
                        </p>
                      </div>
                    </body>
                    </html>
                  `,
                }),
              });

              if (emailResponse.ok) {
                console.log(`Reset email sent to ${dados.user_email}`);
              } else {
                const errorData = await emailResponse.json();
                console.error("Error sending reset email:", errorData);
              }
            } catch (emailError) {
              console.error("Error sending reset email:", emailError);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "getUser") {
      // First check if there's a pending password reset for this user
      const { data: resetNotif } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados, created_at")
        .eq("tipo", "reset_senha")
        .eq("lida", false);

      let pendingPasswordReset = null;
      if (resetNotif) {
        for (const r of resetNotif) {
          let dados = r.dados;
          if (typeof dados === 'string') {
            try { dados = JSON.parse(dados); } catch (e) { dados = {}; }
          }
          if (dados?.user_id === userId) {
            pendingPasswordReset = { ...r, dados };
            break;
          }
        }
      }

      const { data: user, error } = await supabase
        .from("usuarios")
        .select("id, nome, email, tipo, aprovado, status, suspenso_ate, notificado_aprovacao, created_at, updated_at, locked_until, failed_attempts")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, user, pendingPasswordReset }),
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

    // Unlock user account (reset failed attempts and locked_until)
    if (action === "unlockUser") {
      const { error } = await supabase
        .from("usuarios")
        .update({ 
          failed_attempts: 0, 
          locked_until: null 
        })
        .eq("id", userId);

      if (error) throw error;

      // Log the unlock event
      await supabase.from("auth_events").insert({
        user_id: userId,
        event_type: 'UNLOCKED',
        detail: { unlocked_by: adminEmail }
      });

      console.log(`User ${userId} unlocked by admin ${adminEmail}`);

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
