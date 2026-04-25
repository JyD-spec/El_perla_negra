// src/services/pagos.service.ts
import { supabase } from '@/src/lib/supabase';
import type { Pago, PagoInsert } from '@/src/lib/database.types';
import { getLocalDateString } from '@/src/lib/time';

/**
 * Registrar un pago.
 * El trigger trg_actualizar_estado_pago se encarga de:
 *  - Sumar todos los pagos de la reservación
 *  - Si el total cubierto >= total_pagar → estado_pago = 'Pagado' + estado_pase = 'Aprobado'
 */
export async function registrarPago(pago: PagoInsert) {
  const { data, error } = await supabase
    .from('pago')
    .insert(pago)
    .select()
    .single();

  if (error) throw error;
  return data as Pago;
}

/**
 * Obtener pagos de una reservación.
 */
export async function obtenerPagos(idReservacion: number) {
  const { data, error } = await supabase
    .from('pago')
    .select('*')
    .eq('id_reservacion', idReservacion)
    .order('fecha_pago', { ascending: true });

  if (error) throw error;
  return data as Pago[];
}

/**
 * Obtener resumen de pagos de un día (Caseta — para reportes).
 */
export async function resumenPagosDelDia(fecha?: string) {
  const hoy = fecha ?? getLocalDateString();

  const { data, error } = await supabase
    .from('pago')
    .select(`
      *,
      reservacion!inner (
        id_viaje,
        cantidad_personas,
        total_pagar,
        estado_pago,
        cliente ( nombre_completo ),
        paquete ( descripcion ),
        viaje!inner ( fecha_programada, hora_salida_programada )
      )
    `)
    .eq('reservacion.viaje.fecha_programada', hoy)
    .order('fecha_pago', { ascending: true });

  if (error) throw error;
  return data;
}
