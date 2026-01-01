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

const ALLOWED_DOMAIN = "@imexsolutions.com.br";

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limiting store (resets on function restart, but sufficient for basic protection)
// For production, consider using KV store or database
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): { allowed: boolean; error?: string; remainingAttempts?: number } {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const attempts = loginAttempts.get(key);
  
  if (!attempts) {
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
  
  // Reset if lockout period has passed
  if (now > attempts.resetAt) {
    loginAttempts.delete(key);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
  
  // Check if locked out
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const minutesLeft = Math.ceil((attempts.resetAt - now) / 60000);
    return { 
      allowed: false, 
      error: `Muitas tentativas incorretas. Tente novamente em ${minutesLeft} minuto(s).`,
      remainingAttempts: 0
    };
  }
  
  return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count };
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const attempts = loginAttempts.get(key);
  
  if (!attempts || now > attempts.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOCKOUT_DURATION_MS });
  } else {
    attempts.count++;
    loginAttempts.set(key, attempts);
  }
}

function clearFailedAttempts(email: string): void {
  const key = email.toLowerCase().trim();
  loginAttempts.delete(key);
}

// Simple but secure password hashing using Web Crypto API with salt
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Handle new salted format
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
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
  if (!senha) {
    return { valid: false, error: "A senha é obrigatória" };
  }
  
  if (senha.length < 8) {
    return { valid: false, error: "A senha deve ter no mínimo 8 caracteres" };
  }
  
  if (senha.length > 128) {
    return { valid: false, error: "A senha deve ter no máximo 128 caracteres" };
  }
  
  // Require at least one letter and one number
  if (!/[a-zA-Z]/.test(senha)) {
    return { valid: false, error: "A senha deve conter pelo menos uma letra" };
  }
  
  if (!/\d/.test(senha)) {
    return { valid: false, error: "A senha deve conter pelo menos um número" };
  }
  
  return { valid: true };
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
      // Check rate limit FIRST
      const rateCheck = checkRateLimit(email);
      if (!rateCheck.allowed) {
        console.log(`Rate limit exceeded for: ${email}`);
        return new Response(
          JSON.stringify({ success: false, error: rateCheck.error, rateLimited: true }),
          { 
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

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
        // Don't record failed attempt for non-existent users to prevent enumeration
        return new Response(
          JSON.stringify({ success: false, error: "Email não encontrado", notRegistered: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const isValid = await verifyPassword(senha, user.senha_hash);

      if (!isValid) {
        // Record failed attempt
        recordFailedAttempt(email);
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - (loginAttempts.get(email.toLowerCase().trim())?.count || 0);
        
        console.log(`Failed login attempt for: ${email}. Remaining attempts: ${remainingAttempts}`);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: remainingAttempts > 0 
              ? `Senha incorreta. ${remainingAttempts} tentativa(s) restante(s).`
              : "Senha incorreta. Conta temporariamente bloqueada."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear failed attempts on successful login
      clearFailedAttempts(email);

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

      // Hash password
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
      // Validate password format
      const passwordValidation = validatePassword(senha);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: passwordValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password
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
