// @ts-nocheck — Este archivo se ejecuta en Deno (Supabase Edge Functions), no localmente.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.48.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar auth del usuario que solicita
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Falta el header de autorización. Por favor, asegúrate de haber iniciado sesión.");

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("No autorizado: " + (userError?.message || 'Token inválido'));

    // Verificar que el solicitante sea Caseta o Dev
    const { data: requesterData } = await supabaseAdmin
      .from('usuario')
      .select('rango')
      .eq('id_usuario', user.id)
      .single();

    if (!requesterData || !['Caseta', 'Dev'].includes(requesterData.rango)) {
      throw new Error("Prohibido: Solo administradores pueden cambiar contraseñas");
    }

    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      throw new Error("Faltan parámetros requeridos (target_user_id, new_password)");
    }

    if (new_password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    // Cambiar contraseña via Admin API
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      target_user_id,
      { password: new_password }
    );

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("ERROR EN EDGE FUNCTION:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
