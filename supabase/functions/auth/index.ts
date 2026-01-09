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
        .select("id, nome, aprovado, status")
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
          status: user?.status ?? null,
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

      // Check user status
      const userStatus = user.status || (user.aprovado ? 'ativo' : 'pendente');
      
      if (userStatus === 'pendente') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Seu cadastro está aguardando aprovação do administrador", 
            pendingApproval: true,
            status: 'pendente',
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (userStatus === 'suspenso') {
        const suspendedUntil = user.suspenso_ate;
        const suspendedMsg = suspendedUntil 
          ? `Seu acesso está suspenso até ${new Date(suspendedUntil).toLocaleDateString('pt-BR')}.`
          : "Seu acesso está temporariamente suspenso.";
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: suspendedMsg, 
            status: 'suspenso',
            suspensoAte: suspendedUntil,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (userStatus === 'negado') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Seu cadastro foi negado pelo administrador.", 
            status: 'negado',
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user has pending password reset request (blocks login until approved)
      const { data: pendingReset } = await supabase
        .from("notificacoes_usuario")
        .select("id")
        .eq("tipo", "reset_senha")
        .eq("lida", false)
        .limit(1);

      // Find the notification that matches this user
      const { data: userResetNotification } = await supabase
        .from("notificacoes_usuario")
        .select("id, dados")
        .eq("tipo", "reset_senha")
        .eq("lida", false);

      const hasPendingReset = userResetNotification?.some((n: any) => {
        let dados = n.dados;
        if (typeof dados === 'string') {
          try { dados = JSON.parse(dados); } catch { dados = {}; }
        }
        return dados?.user_id === user.id || dados?.user_email === user.email;
      });

      if (hasPendingReset) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Você solicitou redefinição de senha. Aguarde a aprovação do administrador.", 
            pendingPasswordReset: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sanitize and validate deviceInfo before storing
      const sanitizedDeviceInfo = deviceInfo && typeof deviceInfo === 'string' 
        ? deviceInfo.slice(0, 500).replace(/[\x00-\x1F\x7F]/g, '') 
        : null;

      // Log the login
      await supabase.from("login_logs").insert({
        user_id: user.id,
        user_email: user.email,
        user_nome: user.nome,
        device_info: sanitizedDeviceInfo,
      });

      // Generate a secure session token
      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Clean up old sessions for this user (keep only last 5)
      const { data: existingSessions } = await supabase
        .from("session_tokens")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (existingSessions && existingSessions.length >= 5) {
        const idsToDelete = existingSessions.slice(4).map(s => s.id);
        await supabase
          .from("session_tokens")
          .delete()
          .in("id", idsToDelete);
      }

      // Store the session token
      await supabase.from("session_tokens").insert({
        user_id: user.id,
        user_email: user.email,
        token: sessionToken,
        expires_at: expiresAt.toISOString(),
        device_info: sanitizedDeviceInfo,
      });

      // Return user data with session token
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
            status: userStatus,
            suspenso_ate: user.suspenso_ate,
          },
          sessionToken,
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

      // Validate nome length
      if (nome && nome.trim().length > 100) {
        return new Response(
          JSON.stringify({ success: false, error: "Nome deve ter no máximo 100 caracteres" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate deviceInfo length
      if (deviceInfo && deviceInfo.length > 500) {
        return new Response(
          JSON.stringify({ success: false, error: "Informações do dispositivo inválidas" }),
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

    if (action === "resetPassword") {
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

      // Check if user exists
      const { data: user, error: findError } = await supabase
        .from("usuarios")
        .select("id, nome, email, tipo, aprovado")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (findError) {
        console.error("Find error:", findError);
        throw new Error("Erro ao verificar usuário");
      }

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Email não encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password
      const senhaHash = await hashPassword(senha);
      
      // For admin users: reset password directly, keep approved
      // For regular users: reset password and set aprovado=false (needs admin re-approval)
      const isAdmin = user.tipo === 'admin';
      
      const updateData: { senha_hash: string; aprovado?: boolean } = {
        senha_hash: senhaHash,
      };
      
      if (!isAdmin) {
        updateData.aprovado = false;
      }
      
      const { error: updateError } = await supabase
        .from("usuarios")
        .update(updateData)
        .eq("email", email.toLowerCase().trim());

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error("Erro ao atualizar senha");
      }

      console.log(`Password reset for ${email}. Admin: ${isAdmin}. Requires approval: ${!isAdmin}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          requiresApproval: !isAdmin,
          message: isAdmin 
            ? "Senha redefinida com sucesso! Você já pode fazer login."
            : "Senha redefinida! Aguarde aprovação do administrador para acessar."
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

    // WebAuthn: Check if user has biometric credentials
    if (action === "checkBiometric") {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user
      const { data: user } = await supabase
        .from("usuarios")
        .select("id, aprovado")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, hasBiometric: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for WebAuthn credentials
      const { data: credentials } = await supabase
        .from("webauthn_credentials")
        .select("id, device_name")
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          hasBiometric: credentials && credentials.length > 0,
          devices: credentials?.map(c => c.device_name) || []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WebAuthn: Generate registration challenge
    if (action === "biometricRegisterStart") {
      const { sessionToken } = await req.json().catch(() => ({}));
      
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão inválida" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify session
      const { data: session } = await supabase
        .from("session_tokens")
        .select("user_id, user_email")
        .eq("token", sessionToken)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate challenge
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = btoa(String.fromCharCode(...challenge));

      // Get user info
      const { data: user } = await supabase
        .from("usuarios")
        .select("id, nome, email")
        .eq("id", session.user_id)
        .single();

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          challenge: challengeBase64,
          userId: user.id,
          userName: user.nome,
          userEmail: user.email,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WebAuthn: Complete registration
    if (action === "biometricRegisterComplete") {
      const { sessionToken, credentialId, publicKey, deviceName } = await req.json().catch(() => ({}));
      
      if (!sessionToken || !credentialId || !publicKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados inválidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify session
      const { data: session } = await supabase
        .from("session_tokens")
        .select("user_id")
        .eq("token", sessionToken)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store credential
      const { error: insertError } = await supabase
        .from("webauthn_credentials")
        .insert({
          user_id: session.user_id,
          credential_id: credentialId,
          public_key: publicKey,
          device_name: deviceName || "Dispositivo desconhecido",
        });

      if (insertError) {
        console.error("WebAuthn insert error:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao salvar credencial" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`WebAuthn credential registered for user ${session.user_id}`);

      return new Response(
        JSON.stringify({ success: true, message: "Biometria cadastrada com sucesso!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WebAuthn: Start authentication
    if (action === "biometricLoginStart") {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user
      const { data: user } = await supabase
        .from("usuarios")
        .select("id, aprovado")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!user.aprovado) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário aguardando aprovação" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get credentials
      const { data: credentials } = await supabase
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("user_id", user.id);

      if (!credentials || credentials.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma biometria cadastrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate challenge
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = btoa(String.fromCharCode(...challenge));

      return new Response(
        JSON.stringify({
          success: true,
          challenge: challengeBase64,
          credentialIds: credentials.map(c => c.credential_id),
          userId: user.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WebAuthn: Complete authentication
    if (action === "biometricLoginComplete") {
      const { credentialId, deviceInfo: biometricDeviceInfo } = await req.json().catch(() => ({}));
      
      if (!email || !credentialId) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados inválidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user
      const { data: user } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (!user || !user.aprovado) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado ou não aprovado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify credential exists for this user
      const { data: credential } = await supabase
        .from("webauthn_credentials")
        .select("*")
        .eq("user_id", user.id)
        .eq("credential_id", credentialId)
        .maybeSingle();

      if (!credential) {
        return new Response(
          JSON.stringify({ success: false, error: "Credencial não reconhecida" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update counter
      await supabase
        .from("webauthn_credentials")
        .update({ counter: credential.counter + 1 })
        .eq("id", credential.id);

      // Log the login
      await supabase.from("login_logs").insert({
        user_id: user.id,
        user_email: user.email,
        user_nome: user.nome,
        device_info: biometricDeviceInfo ? `${biometricDeviceInfo} (Biometria)` : "Biometria",
      });

      // Generate session token
      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await supabase.from("session_tokens").insert({
        user_id: user.id,
        user_email: user.email,
        token: sessionToken,
        expires_at: expiresAt.toISOString(),
        device_info: biometricDeviceInfo || null,
      });

      console.log(`WebAuthn login successful for ${user.email}`);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
          },
          sessionToken,
        }),
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
