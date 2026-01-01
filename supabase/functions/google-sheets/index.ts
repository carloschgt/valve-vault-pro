import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPREADSHEET_ID = "1l64AeqmSyFrd-dEj0Ol5tK7ts2wmLdEgCzHKKfbnwFw";

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, sheetName, range, values } = await req.json();

    console.log(`Action: ${action}, Sheet: ${sheetName}`);

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
