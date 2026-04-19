import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Tipos estrictos basados en tus ENUM de PostgreSQL
type EstadoViaje = 'Programado' | 'Retrasado' | 'Abordando' | 'En_Navegacion' | 'Finalizado' | 'Cancelado';

const LATITUD_PENASCO = 31.3172;
const LONGITUD_PENASCO = -113.5327;

// 1. Petición a la API del Clima
async function obtenerClimaPenasco() {
  const API_KEY_CLIMA = Deno.env.get('WEATHER_API_KEY');
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LATITUD_PENASCO}&lon=${LONGITUD_PENASCO}&appid=${API_KEY_CLIMA}&units=metric`;

  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    const vientoKmh = datos.wind.speed * 3.6; 
    const estado = datos.weather[0].main; 
    const oleajeMetros = vientoKmh * 0.05; // Mock: Cálculo estimado
    
    return { vientoKmh, estado, oleajeMetros };
  } catch (error) {
    console.error("Error obteniendo el clima:", error);
    return null;
  }
}

// 2. Motor de Cálculo de Retrasos y Alertas
Deno.serve(async (req) => {
  // Inicializar cliente de Supabase con Service Role (salta RLS)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const climaActual = await obtenerClimaPenasco();
  if (!climaActual) {
    return new Response(JSON.stringify({ error: "No se pudo obtener el clima" }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // Buscar viajes de hoy que estén pendientes
  const { data: viajesPendientes } = await supabase
    .from('Viaje')
    .select('id_viaje, estado_viaje, id_embarcacion')
    .eq('fecha_programada', new Date().toISOString().split('T')[0])
    .in('estado_viaje', ['Programado', 'Retrasado']);

  if (!viajesPendientes || viajesPendientes.length === 0) {
    return new Response(JSON.stringify({ message: "Sin viajes pendientes hoy" }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // Reglas de Negocio
  const VIENTO_PELIGROSO = 35; // km/h
  const OLEAJE_PELIGROSO = 2.0; // metros
  const VIENTO_ALERTA = 20; // km/h

  for (const viaje of viajesPendientes) {
    let nuevoEstado: EstadoViaje = viaje.estado_viaje as EstadoViaje;
    let minutosRetraso = 0;
    let motivo: string | null = null;

    if (climaActual.vientoKmh >= VIENTO_PELIGROSO || climaActual.oleajeMetros >= OLEAJE_PELIGROSO) {
      nuevoEstado = 'Cancelado';
      motivo = `Cancelado por seguridad: Viento a ${climaActual.vientoKmh.toFixed(1)} km/h.`;
    } else if (climaActual.vientoKmh >= VIENTO_ALERTA) {
      nuevoEstado = 'Retrasado';
      minutosRetraso = 30; 
      motivo = `Retraso preventivo de 30min por viento moderado.`;
    } else {
      if (viaje.estado_viaje === 'Retrasado') {
         nuevoEstado = 'Programado';
         motivo = 'Clima favorable restaurado.';
      }
    }

    // Actualizar Base de Datos
    await supabase
      .from('Viaje')
      .update({
        clima_estado: climaActual.estado,
        clima_viento_kmh: climaActual.vientoKmh,
        clima_oleaje_m: climaActual.oleajeMetros,
        estado_viaje: nuevoEstado,
        retraso_minutos: minutosRetraso,
        motivo_alteracion: motivo
      })
      .eq('id_viaje', viaje.id_viaje);
  }

  return new Response(JSON.stringify({ message: "Clima y alertas procesadas" }), { 
    status: 200, 
    headers: { "Content-Type": "application/json" } 
  });
});