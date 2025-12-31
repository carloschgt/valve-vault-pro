import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPREADSHEET_ID = "1l64AeqmSyFrd-dEj0Ol5tK7ts2wmLdEgCzHKKfbnwFw";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!apiKey) {
      throw new Error("Google Sheets API key not configured");
    }

    const { action, sheetName, range, email, senha } = await req.json();

    console.log(`Action: ${action}, Sheet: ${sheetName}`);

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

    if (action === "setPassword") {
      // For setting password, we need to use a service account with write access
      // Since we're using API key (read-only), we'll store passwords locally
      // This is a limitation - for full Google Sheets write access, you'd need OAuth2
      
      // For now, return an error explaining this limitation
      return new Response(
        JSON.stringify({ 
          error: "Escrita no Google Sheets requer configuração OAuth2. Por favor, configure a senha diretamente na planilha." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
