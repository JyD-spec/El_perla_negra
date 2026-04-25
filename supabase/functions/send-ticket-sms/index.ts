import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { telefono, nombre, pin, embarcacion, fecha, hora } = await req.json();

    if (!telefono || !pin) {
      throw new Error('Faltan datos requeridos (telefono o pin)');
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Credenciales de Twilio no configuradas en el servidor');
    }

    const mensaje = `Hola ${nombre || 'Pasajero'},\n\nTu reservación para ${embarcacion || 'El Perla Negra'} está confirmada.\nFecha: ${fecha || 'Próximamente'}\nHora: ${hora || 'Por confirmar'}\n\nTu código de abordaje (PIN) es: ${pin}\n\n¡Te esperamos!`;

    const formData = new URLSearchParams();
    formData.append('To', telefono);
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('Body', mensaje);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: formData,
    });

    const twilioData = await res.json();

    if (!res.ok) {
      throw new Error(twilioData.message || 'Error al enviar SMS con Twilio');
    }

    return new Response(
      JSON.stringify({ success: true, messageId: twilioData.sid }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
