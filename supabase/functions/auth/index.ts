import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// HARDENED AUTH - PBKDF2, Rate Limit DB, Token Hash
// =====================================================

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
const PROTECTED_SUPER_ADMIN_EMAIL = "carlos.teixeira@imexsolutions.com.br";

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_DURATION_DAYS = 7;

// PBKDF2 Configuration (NIST recommendations)
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_SALT_LENGTH = 32;
const PBKDF2_KEY_LENGTH = 32;

// =====================================================
// CRYPTO UTILITIES - PBKDF2 via WebCrypto
// =====================================================

async function generatePBKDF2Hash(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LENGTH));
  const saltBase64 = btoa(String.fromCharCode(...salt));
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  return { hash: hashBase64, salt: saltBase64, iterations: PBKDF2_ITERATIONS };
}

async function verifyPBKDF2(password: string, storedHash: string, storedSalt: string, iterations: number): Promise<boolean> {
  try {
    const salt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      PBKDF2_KEY_LENGTH * 8
    );
    
    const hashArray = Array.from(new Uint8Array(derivedBits));
    const computedHash = btoa(String.fromCharCode(...hashArray));
    
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

// Legacy SHA-256 verification for migration
async function verifyLegacySHA256(password: string, storedHash: string): Promise<boolean> {
  // Handle salted format (salt:hash)
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
  }
  
  // Handle unsalted format
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

// Generate token hash for storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate secure random token
function generateSecureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// =====================================================
// RATE LIMITING (PERSISTENT)
// =====================================================

async function checkRateLimitDB(supabase: any, key: string): Promise<{ allowed: boolean; error?: string; remainingAttempts?: number }> {
  const now = new Date();
  
  const { data: rateLimit } = await supabase
    .from("auth_rate_limits")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  
  if (!rateLimit) {
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
  
  // Check if blocked
  if (rateLimit.blocked_until && new Date(rateLimit.blocked_until) > now) {
    const minutesLeft = Math.ceil((new Date(rateLimit.blocked_until).getTime() - now.getTime()) / 60000);
    return { 
      allowed: false, 
      error: `Muitas tentativas incorretas. Tente novamente em ${minutesLeft} minuto(s).`,
      remainingAttempts: 0
    };
  }
  
  // Check if window has expired (reset)
  const windowStart = new Date(rateLimit.window_start);
  if (now.getTime() - windowStart.getTime() > LOCKOUT_DURATION_MS) {
    await supabase.from("auth_rate_limits").delete().eq("key", key);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
  
  return { allowed: true, remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - rateLimit.attempts) };
}

async function recordFailedAttemptDB(supabase: any, key: string, userId?: string): Promise<void> {
  const now = new Date();
  
  const { data: existing } = await supabase
    .from("auth_rate_limits")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  
  if (!existing) {
    await supabase.from("auth_rate_limits").insert({
      key,
      window_start: now.toISOString(),
      attempts: 1,
      blocked_until: null,
    });
  } else {
    const newAttempts = existing.attempts + 1;
    const blocked = newAttempts >= MAX_LOGIN_ATTEMPTS;
    
    await supabase.from("auth_rate_limits").update({
      attempts: newAttempts,
      blocked_until: blocked ? new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString() : null,
    }).eq("key", key);
  }
}

async function clearRateLimitDB(supabase: any, key: string): Promise<void> {
  await supabase.from("auth_rate_limits").delete().eq("key", key);
}

// =====================================================
// AUDIT LOGGING
// =====================================================

async function logAuthEvent(
  supabase: any, 
  eventType: string, 
  userId?: string, 
  ip?: string, 
  userAgent?: string, 
  detail?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from("auth_events").insert({
      event_type: eventType,
      user_id: userId || null,
      ip: ip || null,
      user_agent: userAgent || null,
      detail: detail || null,
    });
  } catch (e) {
    console.error("Failed to log auth event:", e);
  }
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmedEmail = email.toLowerCase().trim();
  
  if (!trimmedEmail.endsWith(ALLOWED_DOMAIN)) {
    return { valid: false, error: `Somente emails ${ALLOWED_DOMAIN} são permitidos` };
  }
  
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
  
  if (!/[a-zA-Z]/.test(senha)) {
    return { valid: false, error: "A senha deve conter pelo menos uma letra" };
  }
  
  if (!/\d/.test(senha)) {
    return { valid: false, error: "A senha deve conter pelo menos um número" };
  }
  
  return { valid: true };
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

// =====================================================
// SUPER ADMIN PROTECTION
// =====================================================

function isProtectedSuperAdmin(email: string): boolean {
  return email.toLowerCase().trim() === PROTECTED_SUPER_ADMIN_EMAIL;
}

async function ensureSuperAdmin(supabase: any): Promise<void> {
  const { data: user } = await supabase
    .from("usuarios")
    .select("id, role, is_active")
    .eq("email", PROTECTED_SUPER_ADMIN_EMAIL)
    .maybeSingle();
  
  if (user && (user.role !== 'SUPER_ADMIN' || !user.is_active)) {
    await supabase.from("usuarios").update({
      role: 'SUPER_ADMIN',
      is_active: true,
      aprovado: true,
      status: 'ativo',
    }).eq("id", user.id);
    
    await logAuthEvent(supabase, 'SUPER_ADMIN_ENSURED', user.id, undefined, undefined, {
      action: 'auto_correction',
      email: PROTECTED_SUPER_ADMIN_EMAIL,
    });
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

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

    // Ensure super admin is protected on every request
    await ensureSuperAdmin(supabase);

    const body = await req.json();
    const { action, email, senha, nome, deviceInfo, sessionToken } = body;

    console.log(`Auth action: ${action}, email: ${email || 'N/A'}`);

    // =====================================================
    // ACTION: checkEmail
    // =====================================================
    if (action === "checkEmail") {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: user } = await supabase
        .from("usuarios")
        .select("id, nome, aprovado, status, is_active, force_password_change")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      // Check for pending password reset token
      if (user && user.aprovado && user.is_active) {
        const { data: pendingResetToken } = await supabase
          .from("password_reset_tokens")
          .select("id, token")
          .eq("user_id", user.id)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1);

        if (pendingResetToken && pendingResetToken.length > 0) {
          return new Response(
            JSON.stringify({
              success: true,
              exists: true,
              approved: true,
              userName: user.nome,
              status: user.status,
              mustResetPassword: true,
              resetToken: pendingResetToken[0].token,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          exists: !!user,
          approved: user?.aprovado ?? false,
          userName: user?.nome ?? null,
          status: user?.status ?? null,
          forcePasswordChange: user?.force_password_change ?? false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // ACTION: login
    // =====================================================
    if (action === "login") {
      const emailLower = email.toLowerCase().trim();
      const rateLimitKey = `user:${emailLower}`;
      
      // Check rate limit FIRST (persistent)
      const rateCheck = await checkRateLimitDB(supabase, rateLimitKey);
      if (!rateCheck.allowed) {
        await logAuthEvent(supabase, 'LOGIN_BLOCKED_RATE_LIMIT', undefined, clientIP, userAgent, { email: emailLower });
        return new Response(
          JSON.stringify({ success: false, error: rateCheck.error, rateLimited: true }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate inputs
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordValidation = validatePassword(senha);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: passwordValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user
      const { data: user, error: findError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", emailLower)
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

      // Check if user account is locked (PERMANENT until admin unlocks)
      // O bloqueio é PERMANENTE - só admin/superadmin pode desbloquear
      if (user.locked_until) {
        await logAuthEvent(supabase, 'LOGIN_BLOCKED_LOCKED', user.id, clientIP, userAgent, { lockedUntil: user.locked_until });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Conta bloqueada por excesso de tentativas. Entre em contato com um administrador para desbloquear.',
            locked: true,
            requiresAdminUnlock: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for pending password reset token (blocks login)
      const { data: pendingResetToken } = await supabase
        .from("password_reset_tokens")
        .select("id, token")
        .eq("user_id", user.id)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingResetToken && pendingResetToken.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Sua solicitação de redefinição de senha foi aprovada. Por favor, verifique seu email e crie uma nova senha.", 
            pendingPasswordReset: true,
            mustResetPassword: true,
            resetToken: pendingResetToken[0].token,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password (try PBKDF2 first, then legacy)
      let isValid = false;
      let needsMigration = false;

      if (user.password_algo === 'pbkdf2' && user.password_salt && user.password_iterations) {
        // PBKDF2 verification
        isValid = await verifyPBKDF2(senha, user.senha_hash, user.password_salt, user.password_iterations);
      } else {
        // Legacy SHA-256 verification
        isValid = await verifyLegacySHA256(senha, user.senha_hash);
        if (isValid) {
          needsMigration = true;
        }
      }

      if (!isValid) {
        // Record failed attempt
        await recordFailedAttemptDB(supabase, rateLimitKey, user.id);
        
        const newFailedAttempts = (user.failed_attempts || 0) + 1;
        const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - newFailedAttempts);
        const isLocked = newFailedAttempts >= MAX_LOGIN_ATTEMPTS;
        
        // Update user failed attempts
        const updateData: any = { failed_attempts: newFailedAttempts };
        if (isLocked) {
          // Bloqueio PERMANENTE - só admin pode desbloquear
          // Usamos uma data muito distante no futuro para indicar bloqueio permanente
          updateData.locked_until = new Date('2099-12-31T23:59:59Z').toISOString();
        }
        await supabase.from("usuarios").update(updateData).eq("id", user.id);
        
        await logAuthEvent(supabase, isLocked ? 'LOCKED' : 'LOGIN_FAIL', user.id, clientIP, userAgent, {
          failedAttempts: newFailedAttempts,
          remainingAttempts,
          permanentLock: isLocked,
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: remainingAttempts > 0 
              ? `Senha incorreta. ${remainingAttempts} tentativa(s) restante(s).`
              : "Conta bloqueada por excesso de tentativas. Entre em contato com um administrador."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear rate limit and failed attempts on success
      await clearRateLimitDB(supabase, rateLimitKey);
      
      // Migrate password hash to PBKDF2 if needed
      if (needsMigration) {
        const { hash, salt, iterations } = await generatePBKDF2Hash(senha);
        await supabase.from("usuarios").update({
          senha_hash: hash,
          password_salt: salt,
          password_algo: 'pbkdf2',
          password_iterations: iterations,
          password_updated_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null,
        }).eq("id", user.id);
        
        await logAuthEvent(supabase, 'PASSWORD_MIGRATED_TO_PBKDF2', user.id, clientIP, userAgent);
      } else {
        // Just clear failed attempts
        await supabase.from("usuarios").update({
          failed_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString(),
          last_login_ip: clientIP,
        }).eq("id", user.id);
      }

      // Check user status
      const userStatus = user.status || (user.aprovado ? 'ativo' : 'pendente');
      
      if (!user.is_active || userStatus === 'pendente') {
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
        const suspendedMsg = user.suspenso_ate 
          ? `Seu acesso está suspenso até ${new Date(user.suspenso_ate).toLocaleDateString('pt-BR')}.`
          : "Seu acesso está temporariamente suspenso.";
        return new Response(
          JSON.stringify({ success: false, error: suspendedMsg, status: 'suspenso', suspensoAte: user.suspenso_ate }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (userStatus === 'negado') {
        return new Response(
          JSON.stringify({ success: false, error: "Seu cadastro foi negado pelo administrador.", status: 'negado' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for pending password reset notifications
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

      // Generate secure session token
      const rawToken = generateSecureToken();
      const tokenHash = await hashToken(rawToken);
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      // Sanitize device info
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

      // Clean up old sessions for this user (keep only last 5)
      const { data: existingSessions } = await supabase
        .from("session_tokens")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (existingSessions && existingSessions.length >= 5) {
        const idsToDelete = existingSessions.slice(4).map(s => s.id);
        await supabase.from("session_tokens").delete().in("id", idsToDelete);
      }

      // Store the session with hashed token
      await supabase.from("session_tokens").insert({
        user_id: user.id,
        user_email: user.email,
        token: rawToken, // Keep for backward compatibility during transition
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        device_info: sanitizedDeviceInfo,
        ip: clientIP,
        user_agent: userAgent,
      });

      await logAuthEvent(supabase, 'LOGIN_OK', user.id, clientIP, userAgent, {
        migratedPassword: needsMigration,
      });

      // Return user data
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
            role: user.role,
            status: userStatus,
            suspenso_ate: user.suspenso_ate,
            forcePasswordChange: user.force_password_change,
          },
          sessionToken: rawToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // ACTION: register
    // =====================================================
    if (action === "register") {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordValidation = validatePassword(senha);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: passwordValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (nome && nome.trim().length > 100) {
        return new Response(
          JSON.stringify({ success: false, error: "Nome deve ter no máximo 100 caracteres" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      // Hash password with PBKDF2
      const { hash, salt, iterations } = await generatePBKDF2Hash(senha);
      
      const { data: newUser, error: insertError } = await supabase
        .from("usuarios")
        .insert({
          nome: nome || email.split("@")[0],
          email: email.toLowerCase().trim(),
          senha_hash: hash,
          password_salt: salt,
          password_algo: 'pbkdf2',
          password_iterations: iterations,
          password_updated_at: new Date().toISOString(),
          tipo: "user",
          role: "USER",
          aprovado: false,
          is_active: false,
          status: 'pendente',
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Erro ao cadastrar usuário");
      }

      await logAuthEvent(supabase, 'USER_CREATED', newUser.id, clientIP, userAgent, {
        email: newUser.email,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Cadastro realizado! Aguarde aprovação do administrador.",
          user: { id: newUser.id, nome: newUser.nome, email: newUser.email, tipo: newUser.tipo },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // ACTION: logout
    // =====================================================
    if (action === "logout") {
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await hashToken(sessionToken);

      // Try to find session by hash first, then by raw token for backwards compatibility
      const { data: session } = await supabase
        .from("session_tokens")
        .select("id, user_id")
        .or(`token_hash.eq.${tokenHash},token.eq.${sessionToken}`)
        .maybeSingle();

      if (session) {
        await supabase.from("session_tokens").update({
          revoked_at: new Date().toISOString(),
        }).eq("id", session.id);

        await logAuthEvent(supabase, 'LOGOUT', session.user_id, clientIP, userAgent);
        await logAuthEvent(supabase, 'TOKEN_REVOKED', session.user_id, clientIP, userAgent);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // ACTION: get_me (validate session and get user)
    // =====================================================
    if (action === "get_me") {
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Token não fornecido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await hashToken(sessionToken);

      // Find session by hash or raw token
      const { data: session } = await supabase
        .from("session_tokens")
        .select("id, user_id, user_email, expires_at, revoked_at")
        .or(`token_hash.eq.${tokenHash},token.eq.${sessionToken}`)
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão inválida" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if revoked or expired
      if (session.revoked_at || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_seen
      await supabase.from("session_tokens").update({
        last_seen_at: new Date().toISOString(),
      }).eq("id", session.id);

      // Get user
      const { data: user } = await supabase
        .from("usuarios")
        .select("id, nome, email, tipo, role, status, is_active, force_password_change, suspenso_ate")
        .eq("id", session.user_id)
        .maybeSingle();

      if (!user || !user.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado ou inativo" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
            role: user.role,
            status: user.status,
            isActive: user.is_active,
            forcePasswordChange: user.force_password_change,
            suspensoAte: user.suspenso_ate,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // ACTION: change_password (user changes own password)
    // =====================================================
    if (action === "changePassword" || action === "change_password") {
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão necessária" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { currentPassword, newPassword } = body;

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: passwordValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate session
      const tokenHash = await hashToken(sessionToken);
      const { data: session } = await supabase
        .from("session_tokens")
        .select("user_id, expires_at, revoked_at")
        .or(`token_hash.eq.${tokenHash},token.eq.${sessionToken}`)
        .maybeSingle();

      if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão inválida" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user
      const { data: user } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", session.user_id)
        .maybeSingle();

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify current password if not force_password_change
      if (!user.force_password_change && currentPassword) {
        let isCurrentValid = false;
        if (user.password_algo === 'pbkdf2' && user.password_salt && user.password_iterations) {
          isCurrentValid = await verifyPBKDF2(currentPassword, user.senha_hash, user.password_salt, user.password_iterations);
        } else {
          isCurrentValid = await verifyLegacySHA256(currentPassword, user.senha_hash);
        }

        if (!isCurrentValid) {
          return new Response(
            JSON.stringify({ success: false, error: "Senha atual incorreta" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Hash new password with PBKDF2
      const { hash, salt, iterations } = await generatePBKDF2Hash(newPassword);

      await supabase.from("usuarios").update({
        senha_hash: hash,
        password_salt: salt,
        password_algo: 'pbkdf2',
        password_iterations: iterations,
        password_updated_at: new Date().toISOString(),
        force_password_change: false,
      }).eq("id", user.id);

      await logAuthEvent(supabase, 'PASSWORD_CHANGED', user.id, clientIP, userAgent);

      return new Response(
        JSON.stringify({ success: true, message: "Senha alterada com sucesso!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // ADMIN ACTIONS (require SUPER_ADMIN or ADMIN role)
    // =====================================================
    
    // Verify admin session for admin actions
    const adminActions = [
      'admin_list_users', 'admin_create_user', 'admin_set_role', 
      'admin_set_active', 'admin_unlock_user', 'admin_list_password_requests',
      'admin_decide_password_reset', 'admin_list_auth_events'
    ];

    if (adminActions.includes(action)) {
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão necessária" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await hashToken(sessionToken);
      const { data: session } = await supabase
        .from("session_tokens")
        .select("user_id, expires_at, revoked_at")
        .or(`token_hash.eq.${tokenHash},token.eq.${sessionToken}`)
        .maybeSingle();

      if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão inválida" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: adminUser } = await supabase
        .from("usuarios")
        .select("id, email, role, is_active")
        .eq("id", session.user_id)
        .maybeSingle();

      if (!adminUser || !adminUser.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não autorizado" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isSuperAdmin = adminUser.role === 'SUPER_ADMIN';
      const isAdmin = adminUser.role === 'ADMIN' || isSuperAdmin;

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: "Acesso restrito a administradores" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_list_users
      // =====================================================
      if (action === "admin_list_users") {
        const { search, statusFilter, limit = 100 } = body;

        let query = supabase
          .from("usuarios")
          .select("id, nome, email, tipo, role, status, is_active, aprovado, force_password_change, failed_attempts, locked_until, last_login_at, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (statusFilter && statusFilter !== 'all') {
          query = query.eq("status", statusFilter);
        }

        if (search) {
          query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: users, error } = await query;

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, users: users || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_create_user
      // =====================================================
      if (action === "admin_create_user") {
        const { userEmail, userName, userRole = 'USER' } = body;

        const emailValidation = validateEmail(userEmail);
        if (!emailValidation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: emailValidation.error }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await supabase
          .from("usuarios")
          .select("id")
          .eq("email", userEmail.toLowerCase().trim())
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, error: "Email já cadastrado" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generate temporary password
        const tempPassword = crypto.randomUUID().slice(0, 12);
        const { hash, salt, iterations } = await generatePBKDF2Hash(tempPassword);

        const tipoMap: Record<string, string> = {
          'SUPER_ADMIN': 'admin',
          'ADMIN': 'admin',
          'USER': 'user',
          'ESTOQUE': 'estoque',
          'COMERCIAL': 'comercial',
        };

        const { data: newUser, error: insertError } = await supabase
          .from("usuarios")
          .insert({
            nome: userName || userEmail.split("@")[0],
            email: userEmail.toLowerCase().trim(),
            senha_hash: hash,
            password_salt: salt,
            password_algo: 'pbkdf2',
            password_iterations: iterations,
            password_updated_at: new Date().toISOString(),
            tipo: tipoMap[userRole] || 'user',
            role: userRole,
            aprovado: true,
            is_active: true,
            status: 'ativo',
            force_password_change: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          throw new Error("Erro ao criar usuário");
        }

        await logAuthEvent(supabase, 'USER_CREATED', newUser.id, clientIP, userAgent, {
          createdBy: adminUser.email,
          email: newUser.email,
          role: userRole,
        });

        return new Response(
          JSON.stringify({
            success: true,
            user: newUser,
            temporaryPassword: tempPassword,
            message: "Usuário criado! Informe a senha temporária ao usuário.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_set_role
      // =====================================================
      if (action === "admin_set_role") {
        const { userId, newRole } = body;

        const { data: targetUser } = await supabase
          .from("usuarios")
          .select("id, email, role")
          .eq("id", userId)
          .maybeSingle();

        if (!targetUser) {
          return new Response(
            JSON.stringify({ success: false, error: "Usuário não encontrado" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Protect super admin
        if (isProtectedSuperAdmin(targetUser.email)) {
          await logAuthEvent(supabase, 'SUPER_ADMIN_PROTECTED_ACTION_BLOCKED', adminUser.id, clientIP, userAgent, {
            action: 'set_role',
            targetEmail: targetUser.email,
            attemptedRole: newRole,
          });
          return new Response(
            JSON.stringify({ success: false, error: "Este usuário é protegido e não pode ter sua permissão alterada." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Only SUPER_ADMIN can create other SUPER_ADMINs or ADMINs
        if ((newRole === 'SUPER_ADMIN' || newRole === 'ADMIN') && !isSuperAdmin) {
          return new Response(
            JSON.stringify({ success: false, error: "Apenas SUPER_ADMIN pode promover a administrador" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const tipoMap: Record<string, string> = {
          'SUPER_ADMIN': 'admin',
          'ADMIN': 'admin',
          'USER': 'user',
          'ESTOQUE': 'estoque',
          'COMERCIAL': 'comercial',
        };

        await supabase.from("usuarios").update({
          role: newRole,
          tipo: tipoMap[newRole] || 'user',
        }).eq("id", userId);

        await logAuthEvent(supabase, 'ROLE_CHANGED', userId, clientIP, userAgent, {
          changedBy: adminUser.email,
          oldRole: targetUser.role,
          newRole,
        });

        return new Response(
          JSON.stringify({ success: true, message: "Permissão alterada com sucesso!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_set_active
      // =====================================================
      if (action === "admin_set_active") {
        const { userId, isActive } = body;

        const { data: targetUser } = await supabase
          .from("usuarios")
          .select("id, email, is_active")
          .eq("id", userId)
          .maybeSingle();

        if (!targetUser) {
          return new Response(
            JSON.stringify({ success: false, error: "Usuário não encontrado" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Protect super admin
        if (isProtectedSuperAdmin(targetUser.email) && !isActive) {
          await logAuthEvent(supabase, 'SUPER_ADMIN_PROTECTED_ACTION_BLOCKED', adminUser.id, clientIP, userAgent, {
            action: 'deactivate',
            targetEmail: targetUser.email,
          });
          return new Response(
            JSON.stringify({ success: false, error: "Este usuário é protegido e não pode ser desativado." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("usuarios").update({
          is_active: isActive,
          aprovado: isActive,
          status: isActive ? 'ativo' : 'negado',
        }).eq("id", userId);

        await logAuthEvent(supabase, isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', userId, clientIP, userAgent, {
          changedBy: adminUser.email,
        });

        // If deactivating, revoke all sessions
        if (!isActive) {
          await supabase.from("session_tokens").update({
            revoked_at: new Date().toISOString(),
          }).eq("user_id", userId);
        }

        return new Response(
          JSON.stringify({ success: true, message: isActive ? "Usuário ativado!" : "Usuário desativado!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_unlock_user
      // =====================================================
      if (action === "admin_unlock_user") {
        const { userId } = body;

        await supabase.from("usuarios").update({
          failed_attempts: 0,
          locked_until: null,
        }).eq("id", userId);

        // Clear rate limits
        const { data: targetUser } = await supabase
          .from("usuarios")
          .select("email")
          .eq("id", userId)
          .maybeSingle();

        if (targetUser) {
          await clearRateLimitDB(supabase, `user:${targetUser.email.toLowerCase()}`);
        }

        await logAuthEvent(supabase, 'UNLOCKED', userId, clientIP, userAgent, {
          unlockedBy: adminUser.email,
        });

        return new Response(
          JSON.stringify({ success: true, message: "Usuário desbloqueado!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_list_auth_events
      // =====================================================
      if (action === "admin_list_auth_events") {
        const { eventType, userId: filterUserId, limit = 100 } = body;

        let query = supabase
          .from("auth_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (eventType) {
          query = query.eq("event_type", eventType);
        }

        if (filterUserId) {
          query = query.eq("user_id", filterUserId);
        }

        const { data: events, error } = await query;

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, events: events || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_list_password_requests
      // =====================================================
      if (action === "admin_list_password_requests") {
        const { data: requests, error } = await supabase
          .from("password_change_requests")
          .select("*")
          .eq("status", "PENDING")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Enrich with user info
        const enrichedRequests = [];
        for (const req of (requests || [])) {
          const { data: targetUser } = await supabase
            .from("usuarios")
            .select("nome, email")
            .eq("id", req.target_user_id)
            .maybeSingle();

          enrichedRequests.push({
            ...req,
            targetUserName: targetUser?.nome,
            targetUserEmail: targetUser?.email,
          });
        }

        return new Response(
          JSON.stringify({ success: true, requests: enrichedRequests }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // =====================================================
      // ACTION: admin_decide_password_reset
      // =====================================================
      if (action === "admin_decide_password_reset") {
        const { requestId, approved, reason } = body;

        const { data: request } = await supabase
          .from("password_change_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();

        if (!request || request.status !== 'PENDING') {
          return new Response(
            JSON.stringify({ success: false, error: "Solicitação não encontrada ou já processada" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update request status
        await supabase.from("password_change_requests").update({
          status: approved ? 'APPROVED' : 'REJECTED',
          decided_by_user_id: adminUser.id,
          decided_at: new Date().toISOString(),
          reason,
        }).eq("id", requestId);

        if (approved) {
          // Generate new temporary password
          const tempPassword = crypto.randomUUID().slice(0, 12);
          const { hash, salt, iterations } = await generatePBKDF2Hash(tempPassword);

          await supabase.from("usuarios").update({
            senha_hash: hash,
            password_salt: salt,
            password_algo: 'pbkdf2',
            password_iterations: iterations,
            password_updated_at: new Date().toISOString(),
            force_password_change: true,
          }).eq("id", request.target_user_id);

          // Revoke all sessions
          await supabase.from("session_tokens").update({
            revoked_at: new Date().toISOString(),
          }).eq("user_id", request.target_user_id);

          await logAuthEvent(supabase, 'PASSWORD_RESET_APPROVED', request.target_user_id, clientIP, userAgent, {
            approvedBy: adminUser.email,
          });

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Senha resetada com sucesso!", 
              temporaryPassword: tempPassword,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          await logAuthEvent(supabase, 'PASSWORD_RESET_REJECTED', request.target_user_id, clientIP, userAgent, {
            rejectedBy: adminUser.email,
            reason,
          });

          return new Response(
            JSON.stringify({ success: true, message: "Solicitação rejeitada." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // =====================================================
    // WebAuthn actions (keep existing functionality)
    // =====================================================
    if (action === "checkBiometric") {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

    if (action === "biometricRegisterStart") {
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão inválida" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await hashToken(sessionToken);
      const { data: session } = await supabase
        .from("session_tokens")
        .select("user_id, user_email")
        .or(`token_hash.eq.${tokenHash},token.eq.${sessionToken}`)
        .gt("expires_at", new Date().toISOString())
        .is("revoked_at", null)
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = btoa(String.fromCharCode(...challenge));

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

    if (action === "biometricRegisterComplete") {
      const { credentialId, publicKey, deviceName } = body;
      
      if (!sessionToken || !credentialId || !publicKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados inválidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await hashToken(sessionToken);
      const { data: session } = await supabase
        .from("session_tokens")
        .select("user_id")
        .or(`token_hash.eq.${tokenHash},token.eq.${sessionToken}`)
        .gt("expires_at", new Date().toISOString())
        .is("revoked_at", null)
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, error: "Sessão expirada" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      return new Response(
        JSON.stringify({ success: true, message: "Biometria cadastrada com sucesso!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "biometricLoginStart") {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: emailValidation.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: user } = await supabase
        .from("usuarios")
        .select("id, aprovado, is_active")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!user.aprovado || !user.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário aguardando aprovação" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

    if (action === "biometricLoginComplete") {
      const { credentialId, deviceInfo: biometricDeviceInfo } = body;
      
      if (!email || !credentialId) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados inválidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: user } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (!user || !user.aprovado || !user.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário não encontrado ou não aprovado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      await supabase.from("webauthn_credentials").update({ counter: credential.counter + 1 }).eq("id", credential.id);

      await supabase.from("login_logs").insert({
        user_id: user.id,
        user_email: user.email,
        user_nome: user.nome,
        device_info: biometricDeviceInfo ? `${biometricDeviceInfo} (Biometria)` : "Biometria",
      });

      const rawToken = generateSecureToken();
      const tokenHash = await hashToken(rawToken);
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      await supabase.from("session_tokens").insert({
        user_id: user.id,
        user_email: user.email,
        token: rawToken,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        device_info: biometricDeviceInfo || null,
        ip: clientIP,
        user_agent: userAgent,
      });

      await supabase.from("usuarios").update({
        last_login_at: new Date().toISOString(),
        last_login_ip: clientIP,
      }).eq("id", user.id);

      await logAuthEvent(supabase, 'LOGIN_OK', user.id, clientIP, userAgent, { method: 'biometric' });

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
            role: user.role,
            forcePasswordChange: user.force_password_change,
          },
          sessionToken: rawToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Legacy reset password action (redirect to new flow)
    if (action === "resetPassword") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Use a solicitação de reset de senha no login. Um administrador precisa aprovar." 
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
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
