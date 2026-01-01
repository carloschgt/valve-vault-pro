import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for passwords (using Web Crypto API)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "imex_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
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

    if (action === "login") {
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
          JSON.stringify({ success: false, error: "Email não encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const isValid = await verifyPassword(senha, user.senha_hash);
      if (!isValid) {
        return new Response(
          JSON.stringify({ success: false, error: "Senha incorreta" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is approved (admins are always approved)
      if (user.tipo !== 'admin' && !user.aprovado) {
        return new Response(
          JSON.stringify({ success: false, error: "Seu cadastro está aguardando aprovação do administrador" }),
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

      // Hash password and create user (aprovado = false by default)
      const senhaHash = await hashPassword(senha);
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
      const senhaHash = await hashPassword(senha);
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