import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { id_viaje, mensaje, target_rezagados } = await req.json();

    if (!id_viaje || !mensaje) {
      throw new Error('id_viaje y mensaje son requeridos');
    }

    // Build the filter based on whether we're targeting rezagados (Vencido)
    // or normal broadcast (Aprobado / Pendiente_Caseta / Abordado)
    const estadoFilter = target_rezagados
      ? 'estado_pase.eq.Vencido'
      : 'estado_pase.eq.Aprobado,estado_pase.eq.Pendiente_Caseta,estado_pase.eq.Abordado';

    // 1. Obtener reservaciones según filtro
    const { data: reservaciones, error: resErr } = await supabase
      .from('reservacion')
      .select(`
        id_reservacion,
        cliente ( nombre_completo, telefono, auth_id, push_token )
      `)
      .eq('id_viaje', id_viaje)
      .or(estadoFilter);

    if (resErr) throw resErr;

    const results: any[] = [];

    // 2. Enviar avisos
    for (const res of (reservaciones || [])) {
      const cliente = (res as any).cliente;
      if (!cliente) continue;

      if (cliente.push_token) {
        // Enviar Push via Expo
        const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: cliente.push_token,
            title: '⚓ Aviso El Perla Negra',
            body: mensaje,
            sound: 'default',
            data: { id_viaje, tipo: target_rezagados ? 'rezagado' : 'aviso' },
          }),
        });
        const pushData = await pushRes.json();
        results.push({ id_reservacion: res.id_reservacion, type: 'push', success: pushRes.ok, data: pushData });
      } else if (cliente.telefono) {
        // Enviar SMS vía Twilio (para los que no tienen token de la App)
        const formData = new URLSearchParams();
        formData.append('To', cliente.telefono.startsWith('+') ? cliente.telefono : `+52${cliente.telefono}`);
        formData.append('From', TWILIO_PHONE_NUMBER);
        formData.append('Body', `Aviso El Perla Negra: ${mensaje}`);

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

        const twilioRes = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
          },
          body: formData,
        });

        const twilioData = await twilioRes.json();
        results.push({ 
          id_reservacion: res.id_reservacion, 
          type: 'sms',
          success: twilioRes.ok, 
          sid: twilioData.sid 
        });
      }
    }

    return new Response(JSON.stringify({ success: true, notifications: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
