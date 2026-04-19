// src/services/viajes.service.ts
import { supabase } from '@/src/lib/supabase';
import type { Viaje, ViajeInsert, ViajeConDetalles, VistaEstadisticasDiarias, VistaKpiOperativos, VistaOperativaViajes } from '@/src/lib/database.types';

/* ── Queries ────────────────────────────────────────────── */

/**
 * Obtener viajes del día con datos de embarcación.
 * Incluye cupo usado calculado vía subquery.
 */
export async function obtenerViajesDelDia(fecha?: string) {
  const hoy = fecha ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('viaje')
    .select(`
      *,
      embarcacion ( nombre, capacidad_maxima, estado_operativo )
    `)
    .eq('fecha_programada', hoy)
    .order('hora_salida_programada', { ascending: true });

  if (error) throw error;
  return data as (Viaje & { embarcacion: { nombre: string; capacidad_maxima: number; estado_operativo: string } })[];
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
  const hoy = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('viaje')
    .select(`
      *,
      embarcacion ( nombre, capacidad_maxima )
    `)
    .eq('id_encargado_abordaje', idEncargado)
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
  const { data, error } = await supabase
    .from('vista_estadisticas_diarias')
    .select('*');

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
  return data as VistaOperativaViajes[];
}
