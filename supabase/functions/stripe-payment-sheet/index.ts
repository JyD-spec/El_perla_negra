import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@^14.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, currency, email, name, phone } = await req.json();

    if (!amount) {
      throw new Error("El monto es requerido");
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY no configurado en el servidor");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16', // Versión estable para PaymentSheet
    });

    // 1. Buscar o crear cliente
    let customerId: string;
    const customers = await stripe.customers.list({ email, limit: 1 });
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        name,
        phone,
        metadata: { source: 'El Perla Negra App' }
      });
      customerId = customer.id;
    }

    // 2. Crear Ephemeral Key (permite que la app guarde métodos de pago del cliente)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );

    // 3. Crear PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe usa centavos
      currency: currency || 'mxn',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey: Deno.env.get('STRIPE_PUBLISHABLE_KEY'),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
