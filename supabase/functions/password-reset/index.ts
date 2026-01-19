import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin, handleCorsOptions } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// PBKDF2 Configuration - must match auth function
const PBKDF2_ITERATIONS = 210000;

// Generate secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Generate PBKDF2 hash (same as auth function)
async function generatePBKDF2Hash(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const saltBase64 = btoa(String.fromCharCode(...salt));
  
  // Import password as key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Convert to base64
  const hashArray = new Uint8Array(derivedBits);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  return { hash: hashBase64, salt: saltBase64, iterations: PBKDF2_ITERATIONS };
}

// Verify PBKDF2 password
async function verifyPBKDF2(password: string, storedHash: string, storedSalt: string, iterations: number): Promise<boolean> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Decode salt from base64
  const saltBinary = atob(storedSalt);
  const salt = new Uint8Array(saltBinary.length);
  for (let i = 0; i < saltBinary.length; i++) {
    salt[i] = saltBinary.charCodeAt(i);
  }
  
  // Import password as key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive bits using same parameters
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Convert to base64 and compare
  const hashArray = new Uint8Array(derivedBits);
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  return hashBase64 === storedHash;
}

// Legacy SHA-256 verification (for checking if new password matches old legacy password)
async function verifyLegacySHA256(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.includes(':')) {
    // Salted SHA-256 format
    const [salt, hash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
  }
  
  // Unsalted SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS
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

      // Get the user's current password info to verify new password is different
      const { data: currentUser } = await supabase
        .from("usuarios")
        .select("senha_hash, password_algo, password_salt, password_iterations")
        .eq("id", tokenData.user_id)
        .single();

      if (currentUser?.senha_hash) {
        // Check if new password matches the old password
        let isSamePassword = false;
        
        if (currentUser.password_algo === 'pbkdf2' && currentUser.password_salt && currentUser.password_iterations) {
          // Verify against PBKDF2 hash
          isSamePassword = await verifyPBKDF2(
            newPassword, 
            currentUser.senha_hash, 
            currentUser.password_salt, 
            currentUser.password_iterations
          );
        } else {
          // Verify against legacy SHA-256 hash
          isSamePassword = await verifyLegacySHA256(newPassword, currentUser.senha_hash);
        }
        
        if (isSamePassword) {
          return new Response(
            JSON.stringify({ success: false, error: "A nova senha deve ser diferente da senha anterior. Por favor, escolha uma nova senha." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Generate PBKDF2 hash for the new password
      const { hash, salt, iterations } = await generatePBKDF2Hash(newPassword);

      // Update user password with PBKDF2 and clear any locks/failed attempts
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ 
          senha_hash: hash,
          password_salt: salt,
          password_algo: 'pbkdf2',
          password_iterations: iterations,
          password_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null
        })
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
