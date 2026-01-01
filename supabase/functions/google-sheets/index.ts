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

const SPREADSHEET_ID = "1l64AeqmSyFrd-dEj0Ol5tK7ts2wmLdEgCzHKKfbnwFw";

// Verify user authentication using secure session tokens
async function verifyAuth(req: Request, requireAdmin: boolean = false): Promise<{ success: boolean; error?: string; userEmail?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, error: 'Token de autenticação não fornecido' };
  }
  
  const token = authHeader.substring(7);
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  // First try Supabase Auth (for future migration)
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (!error && user) {
    // Supabase Auth user - check admin status if required
    if (requireAdmin) {
      const { data: usuario } = await supabaseAdmin
        .from("usuarios")
        .select("tipo")
        .eq("email", user.email?.toLowerCase())
        .maybeSingle();
      
      if (!usuario || usuario.tipo !== 'admin') {
        return { success: false, error: 'Acesso restrito a administradores' };
      }
    }
    return { success: true, userEmail: user.email };
  }
  
  // Validate session token against database (secure approach)
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("session_tokens")
    .select("user_id, user_email, expires_at")
    .eq("token", token)
    .maybeSingle();
  
  if (sessionError || !session) {
    console.log("Session token not found in database");
    return { success: false, error: 'Token inválido ou expirado' };
  }
  
  // Check if token is expired
  if (new Date(session.expires_at) < new Date()) {
    console.log("Session token expired");
    // Clean up expired token
    await supabaseAdmin.from("session_tokens").delete().eq("token", token);
    return { success: false, error: 'Token expirado. Faça login novamente.' };
  }
  
  // Verify user still exists and is approved
  const { data: usuario, error: findError } = await supabaseAdmin
    .from("usuarios")
    .select("email, tipo, aprovado")
    .eq("email", session.user_email.toLowerCase())
    .maybeSingle();
  
  if (findError || !usuario) {
    return { success: false, error: 'Usuário não encontrado' };
  }
  
  if (!usuario.aprovado) {
    return { success: false, error: 'Usuário não aprovado' };
  }
  
  if (requireAdmin && usuario.tipo !== 'admin') {
    return { success: false, error: 'Acesso restrito a administradores' };
  }
  
  return { success: true, userEmail: usuario.email };
}

// Parse the service account JSON from environment variable
function getServiceAccountCredentials() {
  const jsonStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!jsonStr) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
  }
  return JSON.parse(jsonStr);
}

// Create JWT for service account authentication
async function createJWT(credentials: any): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = credentials.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${signatureB64}`;
}

// Get access token using JWT
async function getAccessToken(credentials: any): Promise<string> {
  const jwt = await createJWT(credentials);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Token error:", data);
    throw new Error(data.error_description || "Failed to get access token");
  }

  return data.access_token;
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
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, sheetName, range, values } = await req.json();

    console.log(`Action: ${action}, Sheet: ${sheetName}`);

    // Verify authentication for all operations
    // Read operations require authentication, write operations require admin
    const requireAdmin = action === "appendData";
    const authResult = await verifyAuth(req, requireAdmin);
    
    if (!authResult.success) {
      console.log(`Auth failed: ${authResult.error}`);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log(`Authenticated user: ${authResult.userEmail}`);

    // For read operations, use API key
    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");

    if (action === "getSheets") {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch spreadsheet");
      }

      const sheets = data.sheets?.map((s: any) => s.properties.title) || [];
      return new Response(JSON.stringify({ sheets }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getData") {
      let url: string;
      if (range) {
        url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${range}?key=${apiKey}`;
      } else {
        url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch data");
      }

      return new Response(JSON.stringify({ values: data.values || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "appendData") {
      // For write operations, use service account
      const credentials = getServiceAccountCredentials();
      const accessToken = await getAccessToken(credentials);

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      console.log("Appending data to sheet:", sheetName);
      console.log("Values:", JSON.stringify(values));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: values,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Append error:", data);
        throw new Error(data.error?.message || "Failed to append data");
      }

      console.log("Data appended successfully:", data);

      return new Response(JSON.stringify({ success: true, updates: data.updates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
