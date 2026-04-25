// src/services/viajes.service.ts
import { supabase } from '@/src/lib/supabase';
import type { Viaje, ViajeInsert, ViajeConDetalles, VistaEstadisticasDiarias, VistaKpiOperativos, VistaOperativaViajes } from '@/src/lib/database.types';
import { getLocalDateString } from '@/src/lib/time';

/* ── Queries ────────────────────────────────────────────── */

/**
 * Obtener viajes del día con datos de embarcación.
 * Incluye cupo usado calculado vía subquery.
 */
export async function obtenerViajesDelDia(fecha?: string) {
  const hoy = fecha ?? getLocalDateString();

  const { data, error } = await supabase
    .from('viaje')
    .select(`
      *,
      embarcacion ( nombre, capacidad_maxima, estado_operativo, duracion_estandar_viaje )
    `)
    .eq('fecha_programada', hoy)
    .order('hora_salida_programada', { ascending: true });

  if (error) throw error;
  return data as (Viaje & { embarcacion: { nombre: string; capacidad_maxima: number; estado_operativo: string; duracion_estandar_viaje: number | null } })[];
}

/**
 * Obtener cupo disponible para un viaje específico.
 * Cuenta reservaciones que NO son Rechazado (pues Vencido solo ocurre post-zarpe).
 */
export async function obtenerCupoViaje(idViaje: number) {
  const { data, error } = await supabase
    .from('reservacion')
    .select('cantidad_personas')
    .eq('id_viaje', idViaje)
    .neq('estado_pase', 'Rechazado');

  if (error) throw error;

  const ocupados = (data ?? []).reduce((sum, r) => sum + r.cantidad_personas, 0);
  return ocupados;
}

/**
 * Obtener el viaje actual asignado a un encargado de abordaje.
 */
export async function obtenerViajeActual(idEncargado: string) {
  const hoy = getLocalDateString();

  const { data, error } = await supabase
    .from('viaje')
    .select(`
      *,
      embarcacion ( nombre, capacidad_maxima )
    `)
    .contains('tripulacion_asignada', [idEncargado])
    .eq('fecha_programada', hoy)
    .in('estado_viaje', ['Programado', 'Retrasado', 'Abordando', 'En_Navegacion'])
    .order('hora_salida_programada', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data as ViajeConDetalles | null;
}

/* ── Mutations ──────────────────────────────────────────── */

/**
 * Programar un nuevo viaje (solo Caseta).
 */
export async function programarViaje(viaje: ViajeInsert) {
  const { data, error } = await supabase
    .from('viaje')
    .insert(viaje)
    .select()
    .single();

  if (error) throw error;
  return data as Viaje;
}

/**
 * Actualizar estado de viaje vía timestamps (activa triggers automáticos).
 */
export async function actualizarEstadoViaje(
  idViaje: number,
  campo: 'hora_inicio_abordaje' | 'hora_salida_real' | 'hora_llegada_real',
) {
  const { error } = await supabase
    .from('viaje')
    .update({ [campo]: new Date().toISOString() })
    .eq('id_viaje', idViaje);

  if (error) throw error;
}

/* ── Vistas / KPIs ──────────────────────────────────────── */

export async function obtenerEstadisticasDiarias() {
  const hoy = getLocalDateString();
  return obtenerEstadisticasRango(hoy, hoy);
}

export async function obtenerEstadisticasRango(inicio: string, fin: string) {
  const { data, error } = await supabase
    .from('vista_estadisticas_diarias')
    .select('*')
    .gte('fecha', inicio)
    .lte('fecha', fin);

  if (error) throw error;
  return data as VistaEstadisticasDiarias[];
}

export async function obtenerKpiOperativos() {
  const { data, error } = await supabase
    .from('vista_kpi_operativos')
    .select('*')
    .limit(6);

  if (error) throw error;
  return data as VistaKpiOperativos[];
}

export async function obtenerVistaOperativa() {
  const { data, error } = await supabase
    .from('vista_operativa_viajes')
    .select('*')
    .order('hora_salida_programada', { ascending: true });

  if (error) throw error;
  return data as any[];
}

export async function obtenerEstadisticasMetodosPago() {
  const hoy = getLocalDateString();
  return obtenerMetodosPagoRango(hoy, hoy);
}

export async function obtenerMetodosPagoRango(inicio: string, fin: string) {
  const { data, error } = await supabase
    .from('pago')
    .select(`
      metodo_pago,
      monto_pagado,
      reservacion!inner (
        viaje!inner ( fecha_programada )
      )
    `)
    .gte('reservacion.viaje.fecha_programada', inicio)
    .lte('reservacion.viaje.fecha_programada', fin);

  if (error) throw error;

  const aggregated = (data || []).reduce((acc: any[], curr: any) => {
    const existing = acc.find(x => x.metodo_pago === curr.metodo_pago);
    if (existing) {
      existing.total_ingresos = Number(existing.total_ingresos) + Number(curr.monto_pagado);
      existing.total_transacciones++;
    } else {
      acc.push({
        metodo_pago: curr.metodo_pago,
        total_ingresos: Number(curr.monto_pagado),
        total_transacciones: 1
      });
    }
    return acc;
  }, []);

  return aggregated;
}

export async function actualizarRegresoEstimado(idViaje: number, horas: number) {
  const ahora = new Date();
  const regreso = new Date(ahora.getTime() + (horas * 60 * 60 * 1000));
  
  // Also set actual departure time if it's the first time
  const { error } = await supabase
    .from('viaje')
    .update({ 
      tiempo_estimado_regreso: regreso.toISOString(),
      hora_salida_real: ahora.toTimeString().split(' ')[0], // HH:MM:SS
      estado_viaje: 'En_Navegacion'
    })
    .eq('id_viaje', idViaje);

  if (error) throw error;
}

export async function obtenerTendenciasSemanales() {
  const hoy = new Date();
  const hace7dias = new Date(hoy);
  hace7dias.setDate(hoy.getDate() - 6);
  return obtenerTendenciasRango(getLocalDateString(hace7dias), getLocalDateString(hoy));
}

export async function obtenerTendenciasRango(inicio: string, fin: string) {
  const { data, error } = await supabase
    .from('vista_tendencias_semanales')
    .select('*')
    .gte('fecha', inicio)
    .lte('fecha', fin)
    .order('fecha', { ascending: true });

  if (error) throw error;
  return data as { fecha: string; total_ingresos: number; total_pax: number }[];
}


