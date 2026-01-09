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

    // Action: Request password reset
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
        .select("id, nome, email, status")
        .eq("email", email.toLowerCase().trim())
        .single();

      if (userError || !user) {
        // Don't reveal if user exists or not for security
        console.log(`User not found: ${email}`);
        return new Response(
          JSON.stringify({ success: true, message: "Se o email existir, você receberá um link de redefinição" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate reset token
      const resetToken = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate any existing tokens for this user
      await supabase
        .from("password_reset_tokens")
        .delete()
        .eq("user_id", user.id);

      // Store new token
      const { error: insertError } = await supabase
        .from("password_reset_tokens")
        .insert({
          user_id: user.id,
          user_email: user.email,
          token: resetToken,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error storing reset token:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao processar solicitação" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build reset URL
      const baseUrl = appUrl || "https://bdetejjahokasedpghlp.lovableproject.com";
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      // Send email using Resend API directly
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "IMEX Sistema <onboarding@resend.dev>",
            to: [user.email],
            subject: "Redefinição de Senha - IMEX Sistema",
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
                  <h2 style="color: #1a365d; margin-top: 0;">Olá, ${user.nome}!</h2>
                  <p>Você solicitou a redefinição de sua senha. Clique no botão abaixo para criar uma nova senha:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Redefinir Senha</a>
                  </div>
                  <p style="color: #64748b; font-size: 14px;">Este link expira em <strong>1 hora</strong>.</p>
                  <p style="color: #64748b; font-size: 14px;">Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.</p>
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

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error("Resend API error:", errorData);
          
          // Check for domain verification error
          if (errorData.message?.includes("verify a domain") || errorData.message?.includes("testing emails")) {
            await supabase.from("password_reset_tokens").delete().eq("token", resetToken);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "O domínio de email ainda não foi verificado no Resend. Para enviar emails para outros usuários, configure um domínio em resend.com/domains",
                details: "Atualmente só é possível enviar emails de teste para o email do proprietário da conta Resend."
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          throw new Error("Failed to send email");
        }

        const emailData = await emailResponse.json();
        console.log("Reset email sent:", emailData);
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Clean up token if email fails
        await supabase.from("password_reset_tokens").delete().eq("token", resetToken);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao enviar email. Verifique se o domínio está configurado no Resend." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify admins about the password reset request
      const { data: admins } = await supabase
        .from("usuarios")
        .select("id")
        .eq("tipo", "admin")
        .eq("status", "ativo");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          tipo: "seguranca",
          titulo: "Solicitação de Redefinição de Senha",
          mensagem: `O usuário ${user.nome} (${user.email}) solicitou redefinição de senha.`,
          dados: JSON.stringify({ user_id: user.id, user_email: user.email }),
        }));

        await supabase.from("notificacoes_usuario").insert(notifications);
        console.log(`Admin notifications sent: ${admins.length}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Email de redefinição enviado" }),
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
