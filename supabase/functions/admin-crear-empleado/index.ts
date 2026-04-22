import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.48.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify requesting user auth manually to return detailed error messages
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing auth header. Por favor, asegúrate de haber iniciado sesión.");
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized: " + (userError?.message || 'Token inválido'));

    // Check if requester is Caseta or Dev
    const { data: requesterData } = await supabaseAdmin
      .from('usuario')
      .select('rango')
      .eq('id_usuario', user.id)
      .single();

    if (!requesterData || !['Caseta', 'Dev'].includes(requesterData.rango)) {
      throw new Error("Forbidden: Solo administradores pueden crear empleados");
    }

    const { email, numero, password, nombre, rango, id_embarcacion } = await req.json();

    if (!email || !password || !nombre || !rango) {
      throw new Error("Faltan parámetros requeridos (email, password, nombre, rango)");
    }

    // Create User via Admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rango }
    });

    if (createError) throw createError;

    await supabaseAdmin
      .from('usuario')
      .update({ 
        numero: numero || null,
        email: email,
        id_embarcacion: id_embarcacion || null 
      })
      .eq('id_usuario', authData.user.id);

    return new Response(JSON.stringify({ success: true, user: authData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("EDGE FUNCTION ERROR:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack, details: err.toString() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
