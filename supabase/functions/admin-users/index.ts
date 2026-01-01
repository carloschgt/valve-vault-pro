import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side admin verification - CRITICAL for security
async function verifyAdminUser(supabase: any, userEmail: string): Promise<boolean> {
  if (!userEmail) return false;
  
  const { data: user, error } = await supabase
    .from("usuarios")
    .select("tipo")
    .eq("email", userEmail.toLowerCase().trim())
    .maybeSingle();
  
  if (error || !user) return false;
  return user.tipo === 'admin';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, userId, aprovado, search, adminEmail } = await req.json();

    console.log(`Admin users action: ${action}, adminEmail: ${adminEmail}`);

    // CRITICAL: Server-side admin verification for ALL operations
    if (!adminEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Email do administrador não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = await verifyAdminUser(supabase, adminEmail);
    if (!isAdmin) {
      console.error(`Unauthorized admin attempt by: ${adminEmail}`);
      return new Response(
        JSON.stringify({ success: false, error: "Acesso não autorizado. Apenas administradores podem executar esta ação." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      let query = supabase
        .from("usuarios")
        .select("id, nome, email, tipo, aprovado, created_at")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: users, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, users }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logs") {
      const { data: logs, error } = await supabase
        .from("login_logs")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "approve") {
      const { error } = await supabase
        .from("usuarios")
        .update({ aprovado })
        .eq("id", userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      // First delete login logs
      await supabase.from("login_logs").delete().eq("user_id", userId);

      // Then delete user
      const { error } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Ação inválida");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Admin users error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
