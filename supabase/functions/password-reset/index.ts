import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Hash password with salt
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt, b => b.toString(16).padStart(2, '0')).join('');
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltHex);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

// Verify password against stored hash
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Handle new salted format
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
  }
  
  // Handle legacy unsalted format (SHA-256 only)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, token, newPassword, appUrl } = await req.json();

    // Action: Request password reset - ALL users (including admins) go through admin approval flow
    if (action === "requestReset") {
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: "Email é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Password reset requested for: ${email}`);

      // Check if user exists
      const { data: user, error: userError } = await supabase
        .from("usuarios")
        .select("id, nome, email, status, tipo, senha_hash")
        .eq("email", email.toLowerCase().trim())
        .single();

      if (userError || !user) {
        // Don't reveal if user exists or not for security
        console.log(`User not found: ${email}`);
        return new Response(
          JSON.stringify({ success: true, message: "Se o email existir, a solicitação será enviada para aprovação" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if there's already a pending reset request for this user
      const { data: existingNotifs } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados")
        .eq("tipo", "reset_senha")
        .eq("lida", false);

      const alreadyHasPending = existingNotifs?.some((n: any) => {
        let dados = n.dados;
        if (typeof dados === 'string') {
          try { dados = JSON.parse(dados); } catch { dados = {}; }
        }
        return dados?.user_id === user.id || dados?.user_email === user.email;
      });

      if (alreadyHasPending) {
        return new Response(
          JSON.stringify({ success: true, message: "Já existe uma solicitação pendente de aprovação. Aguarde um administrador aprovar." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all active admins
      const { data: admins } = await supabase
        .from("usuarios")
        .select("id, email")
        .eq("tipo", "admin")
        .eq("status", "ativo");

      if (!admins || admins.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhum administrador encontrado para aprovar a solicitação" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If user is admin, they need ANOTHER admin to approve (can't approve their own reset)
      // Filter out the requesting user from the list of admins who will receive the notification
      const eligibleAdmins = admins.filter((admin: any) => admin.email.toLowerCase() !== email.toLowerCase().trim());

      if (eligibleAdmins.length === 0) {
        // This admin is the ONLY admin in the system
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Você é o único administrador do sistema. Não é possível redefinir sua própria senha sem outro administrador para aprovar. Contate o suporte técnico." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create notifications for eligible admins (excluding the requesting user if they are admin)
      const isRequestingUserAdmin = user.tipo === 'admin';
      const notifications = eligibleAdmins.map((admin: any) => ({
        user_id: admin.id,
        tipo: "reset_senha",
        titulo: isRequestingUserAdmin 
          ? "⚠️ Admin Solicita Reset de Senha" 
          : "Solicitação de Reset de Senha",
        mensagem: isRequestingUserAdmin
          ? `O ADMINISTRADOR ${user.nome} (${user.email}) solicitou redefinição de senha. Por segurança, outro admin deve aprovar.`
          : `O usuário ${user.nome} (${user.email}) solicitou redefinição de senha.`,
        dados: { 
          user_id: user.id, 
          user_email: user.email,
          user_nome: user.nome,
          user_tipo: user.tipo,
          old_password_hash: user.senha_hash,
          requires_action: true,
          is_admin_request: isRequestingUserAdmin
        },
      }));

      const { error: notifError } = await supabase.from("notificacoes_usuario").insert(notifications);

      if (notifError) {
        console.error("Error sending notifications:", notifError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao enviar solicitação" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Password reset notifications sent to ${eligibleAdmins.length} admins for user ${email} (isAdmin: ${isRequestingUserAdmin})`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: isRequestingUserAdmin 
            ? "Solicitação enviada! Como você é administrador, outro admin precisa aprovar por segurança."
            : "Solicitação enviada! Um administrador irá aprovar e você receberá um email com o link de redefinição." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Request admin to reset password (no email needed)
    if (action === "requestAdminReset") {
      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: "Email é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Admin password reset requested for: ${email}`);

      // Check if user exists
      const { data: user, error: userError } = await supabase
        .from("usuarios")
        .select("id, nome, email, status, senha_hash")
        .eq("email", email.toLowerCase().trim())
        .single();

      if (userError || !user) {
        console.log(`User not found: ${email}`);
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if there's already a pending reset request for this user
      const { data: existingNotifs } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados")
        .eq("tipo", "reset_senha")
        .eq("lida", false);

      const alreadyHasPending = existingNotifs?.some((n: any) => {
        let dados = n.dados;
        if (typeof dados === 'string') {
          try { dados = JSON.parse(dados); } catch { dados = {}; }
        }
        return dados?.user_id === user.id || dados?.user_email === user.email;
      });

      if (alreadyHasPending) {
        return new Response(
          JSON.stringify({ success: true, message: "Já existe uma solicitação pendente de aprovação" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify admins about the password reset request - store the old password hash to verify new password is different
      const { data: admins } = await supabase
        .from("usuarios")
        .select("id")
        .eq("tipo", "admin")
        .eq("status", "ativo");

      if (!admins || admins.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhum administrador encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        tipo: "reset_senha",
        titulo: "Solicitação de Reset de Senha",
        mensagem: `O usuário ${user.nome} (${user.email}) solicitou que um administrador redefina sua senha.`,
        dados: { 
          user_id: user.id, 
          user_email: user.email,
          user_nome: user.nome,
          old_password_hash: user.senha_hash, // Store old hash to compare later
          requires_action: true 
        },
      }));

      const { error: notifError } = await supabase.from("notificacoes_usuario").insert(notifications);

      if (notifError) {
        console.error("Error sending notifications:", notifError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao enviar solicitação" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Admin reset notifications sent: ${admins.length}`);

      return new Response(
        JSON.stringify({ success: true, message: "Solicitação enviada aos administradores" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Action: Validate reset token
    if (action === "validateToken") {
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("token", token)
        .is("used_at", null)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido ou já utilizado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiration
      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Token expirado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, email: tokenData.user_email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Reset password
    if (action === "resetPassword") {
      if (!token || !newPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Token e nova senha são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password
      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ success: false, error: "A senha deve ter no mínimo 6 caracteres" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("token", token)
        .is("used_at", null)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido ou já utilizado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Token expirado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the user's current password hash to verify new password is different
      const { data: currentUser } = await supabase
        .from("usuarios")
        .select("senha_hash")
        .eq("id", tokenData.user_id)
        .single();

      if (currentUser?.senha_hash) {
        // Check if new password matches the old password
        const isSamePassword = await verifyPassword(newPassword, currentUser.senha_hash);
        if (isSamePassword) {
          return new Response(
            JSON.stringify({ success: false, error: "A nova senha deve ser diferente da senha anterior. Por favor, escolha uma nova senha." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ senha_hash: hashedPassword, updated_at: new Date().toISOString() })
        .eq("id", tokenData.user_id);

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao atualizar senha" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark token as used
      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      // Also mark any pending reset notifications for this user as read
      const { data: pendingNotifs } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados")
        .eq("tipo", "reset_senha")
        .eq("lida", false);

      if (pendingNotifs) {
        const userNotifIds = pendingNotifs
          .filter((n: any) => {
            let dados = n.dados;
            if (typeof dados === 'string') {
              try { dados = JSON.parse(dados); } catch { dados = {}; }
            }
            return dados?.user_id === tokenData.user_id || dados?.user_email === tokenData.user_email;
          })
          .map((n: any) => n.id);

        if (userNotifIds.length > 0) {
          await supabase
            .from("notificacoes_usuario")
            .update({ lida: true })
            .in("id", userNotifIds);
        }
      }

      // Invalidate all user sessions
      await supabase
        .from("session_tokens")
        .delete()
        .eq("user_id", tokenData.user_id);

      // Notify admins about successful password reset
      const { data: admins } = await supabase
        .from("usuarios")
        .select("id")
        .eq("tipo", "admin")
        .eq("status", "ativo");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          tipo: "seguranca",
          titulo: "Senha Redefinida",
          mensagem: `O usuário ${tokenData.user_email} redefiniu sua senha com sucesso.`,
          dados: JSON.stringify({ user_id: tokenData.user_id, user_email: tokenData.user_email }),
        }));

        await supabase.from("notificacoes_usuario").insert(notifications);
      }

      console.log(`Password reset successful for: ${tokenData.user_email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Senha redefinida com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
