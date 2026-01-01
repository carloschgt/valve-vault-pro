import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_DOMAIN = "@imexsolutions.com.br";

function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmedEmail = email.toLowerCase().trim();
  
  if (!trimmedEmail.endsWith(ALLOWED_DOMAIN)) {
    return { valid: false, error: `Somente emails ${ALLOWED_DOMAIN} são permitidos` };
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: "Formato de email inválido" };
  }
  
  return { valid: true };
}

function validatePassword(senha: string): { valid: boolean; error?: string } {
  if (!senha || senha.length !== 6) {
    return { valid: false, error: "A senha deve ter exatamente 6 dígitos" };
  }
  
  if (!/^\d{6}$/.test(senha)) {
    return { valid: false, error: "A senha deve conter apenas números" };
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, senha, nome, deviceInfo } = await req.json();

    console.log(`Auth action: ${action}, email: ${email}`);

    if (action === "checkEmail") {
      // Validate email domain
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user exists
      const { data: user, error: findError } = await supabase
        .from("usuarios")
        .select("id, nome, aprovado")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (findError) {
        console.error("Find error:", findError);
        throw new Error("Erro ao verificar email");
      }

      return new Response(
        JSON.stringify({
          success: true,
          exists: !!user,
          approved: user?.aprovado ?? false,
          userName: user?.nome ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "login") {
      // Validate email domain
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password format
      const passwordValidation = validatePassword(senha);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: passwordValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user by email
      const { data: user, error: findError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (findError) {
        console.error("Find error:", findError);
        throw new Error("Erro ao buscar usuário");
      }

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Email não encontrado", notRegistered: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password using bcrypt
      let isValid = false;
      try {
        isValid = await bcrypt.compare(senha, user.senha_hash);
      } catch {
        console.log("Attempting legacy hash verification");
        isValid = false;
      }

      if (!isValid) {
        return new Response(
          JSON.stringify({ success: false, error: "Senha incorreta" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is approved
      if (!user.aprovado) {
        return new Response(
          JSON.stringify({ success: false, error: "Seu cadastro está aguardando aprovação do administrador", pendingApproval: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the login
      await supabase.from("login_logs").insert({
        user_id: user.id,
        user_email: user.email,
        user_nome: user.nome,
        device_info: deviceInfo || null,
      });

      // Return user data (without password hash)
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "register") {
      // Validate email domain
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password format
      const passwordValidation = validatePassword(senha);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: passwordValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if email already exists
      const { data: existing } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: "Email já cadastrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password using bcrypt
      const senhaHash = await bcrypt.hash(senha);
      
      const { data: newUser, error: insertError } = await supabase
        .from("usuarios")
        .insert({
          nome: nome || email.split("@")[0],
          email: email.toLowerCase().trim(),
          senha_hash: senhaHash,
          tipo: "user",
          aprovado: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Erro ao cadastrar usuário");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Cadastro realizado! Aguarde aprovação do administrador.",
          user: {
            id: newUser.id,
            nome: newUser.nome,
            email: newUser.email,
            tipo: newUser.tipo,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "changePassword") {
      // Validate password format
      const passwordValidation = validatePassword(senha);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: passwordValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password using bcrypt
      const senhaHash = await bcrypt.hash(senha);
      
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ senha_hash: senhaHash })
        .eq("email", email.toLowerCase().trim());

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error("Erro ao atualizar senha");
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Ação inválida");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Auth error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
