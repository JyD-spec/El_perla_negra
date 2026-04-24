// src/services/reservaciones.service.ts
import { supabase } from '@/src/lib/supabase';
import type {
  Reservacion,
  ReservacionInsert,
  ReservacionConDetalles,
  Cliente,
} from '@/src/lib/database.types';

/* ── Queries ────────────────────────────────────────────── */

/**
 * Obtener mis reservaciones (Comprador).
 * Busca el cliente vinculado a auth.uid() y luego sus reservaciones.
 */
export async function obtenerMisReservaciones() {
  // 1. Find the client linked to me
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: clienteData, error: clienteErr } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (clienteErr) throw clienteErr;
  
  // If no client profile exists yet, it's impossible to have reservations
  if (!clienteData) return [];

  // 2. Get reservations with related data
  const { data, error } = await supabase
    .from('reservacion')
    .select(`
      *,
      paquete ( descripcion, costo_persona ),
      viaje ( fecha_programada, hora_salida_programada, estado_viaje,
              embarcacion ( nombre ) ),
      detalle_reservacion ( *, paquete ( * ) )
    `)
    .eq('id_cliente', clienteData.id_cliente)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ReservacionConDetalles[];
}

/**
 * Obtener reservaciones por viaje (Caseta / Barco).
 */
export async function obtenerReservacionesPorViaje(idViaje: number) {
  const { data, error } = await supabase
    .from('reservacion')
    .select(`
      *,
      cliente ( nombre_completo, telefono ),
      paquete ( descripcion, costo_persona ),
      detalle_reservacion ( *, paquete ( * ) )
    `)
    .eq('id_viaje', idViaje)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as ReservacionConDetalles[];
}

/**
 * Obtener todas las reservaciones del día (Caseta).
 */
export async function obtenerReservacionesDelDia(fecha?: string) {
  const hoy = fecha ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('reservacion')
    .select(`
      *,
      cliente ( nombre_completo, telefono ),
      paquete ( descripcion, costo_persona ),
      viaje!inner ( fecha_programada, hora_salida_programada, embarcacion ( nombre ) ),
      pago ( metodo_pago, monto_pagado ),
      detalle_reservacion ( *, paquete ( * ) )
    `)
    .eq('viaje.fecha_programada', hoy)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ReservacionConDetalles[];
}

/**
 * Verificar un pase por PIN (Barco / Caseta).
 */
export async function verificarPIN(pin: string) {
  const { data, error } = await supabase
    .from('reservacion')
    .select(`
      *,
      cliente ( nombre_completo, telefono ),
      paquete ( descripcion ),
      viaje ( fecha_programada, hora_salida_programada ),
      detalle_reservacion ( *, paquete ( * ) )
    `)
    .eq('pin_verificacion', pin.toUpperCase())
    .single();

  if (error) throw error;
  return data as ReservacionConDetalles;
}

/**
 * Obtener ventas del vendedor actual (Vendedor).
 */
export async function obtenerMisVentas(fecha?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const hoy = fecha ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('reservacion')
    .select(`
      *,
      cliente ( nombre_completo, telefono ),
      paquete ( descripcion, costo_persona ),
      viaje!inner ( fecha_programada, hora_salida_programada ),
      detalle_reservacion ( *, paquete ( * ) )
    `)
    .eq('id_vendedor', user.id)
    .eq('viaje.fecha_programada', hoy)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ReservacionConDetalles[];
}

/* ── Mutations ──────────────────────────────────────────── */

/**
 * Crear una nueva reservación.
 * Triggers automáticos calculan totales, validan capacidad, y generan PIN.
 */
export async function crearReservacion(datos: {
  nombreCliente: string;
  telefono: string;
  lada?: string;
  email?: string;
  idPaquete?: number; // Legacy or primary
  idViaje: number;
  cantidadPersonas: number;
  idVendedor?: string;
  authId?: string;
  paquetes?: { idPaquete: number; cantidad: number }[]; // New breakdown
  estadoPase?: 'Pendiente_Caseta' | 'Aprobado';
  estadoPago?: 'Pendiente' | 'Pagado';
}) {
  // 1. Create or find the client
  let idCliente: number;

  if (datos.authId) {
    // Client with an app account
    const { data: existing } = await supabase
      .from('cliente')
      .select('id_cliente')
      .eq('auth_id', datos.authId)
      .maybeSingle();

    if (existing) {
      idCliente = existing.id_cliente;
    } else {
      const { data: nuevo, error: cliErr } = await supabase
        .from('cliente')
        .insert({
          auth_id: datos.authId,
          nombre_completo: datos.nombreCliente,
          telefono: datos.telefono,
          lada: datos.lada || null,
          email: datos.email || null,
          es_registrado: true,
        })
        .select('id_cliente')
        .single();
      if (cliErr || !nuevo) throw cliErr ?? new Error('Error creando cliente');
      idCliente = nuevo.id_cliente;
    }
  } else {
    // Walk-in client (vendedor/caseta flow)
    // Check if client already exists by phone to avoid duplicates
    const { data: existing } = await supabase
      .from('cliente')
      .select('id_cliente')
      .eq('telefono', datos.telefono)
      .maybeSingle();

    if (existing) {
      idCliente = existing.id_cliente;
    } else {
      const { data: nuevo, error: cliErr } = await supabase
        .from('cliente')
        .insert({
          nombre_completo: datos.nombreCliente,
          telefono: datos.telefono,
          lada: datos.lada || null,
          email: datos.email || null,
          es_registrado: false,
        })
        .select('id_cliente')
        .single();
      if (cliErr || !nuevo) throw cliErr ?? new Error('Error creando cliente');
      idCliente = nuevo.id_cliente;
    }
  }

  // 2. Get package cost for the trigger (subtotal/total are calculated by trigger,
  //    but we need to send initial values for the insert)
  const { data: paquete } = await supabase
    .from('paquete')
    .select('costo_persona')
    .eq('id_paquete', datos.idPaquete)
    .single();

  const subtotal = (paquete?.costo_persona ?? 0) * datos.cantidadPersonas;

  // 3. Insert reservation — triggers do the heavy lifting
  // Note: We use the first package as "primary" if available, or NULL for mixed
  const primaryPaquete = datos.paquetes && datos.paquetes.length > 0 
    ? datos.paquetes[0].idPaquete 
    : datos.idPaquete;

  const { data: resData, error: resErr } = await supabase
    .from('reservacion')
    .insert({
      id_cliente: idCliente,
      id_paquete: primaryPaquete || null,
      id_viaje: datos.idViaje,
      cantidad_personas: datos.cantidadPersonas,
      id_vendedor: datos.idVendedor || null,
      subtotal: subtotal || 0,
      total_pagar: subtotal || 0,
      estado_pase: datos.estadoPase || 'Pendiente_Caseta',
      estado_pago: datos.estadoPago || 'Pendiente',
    })
    .select()
    .single();

  if (resErr) throw resErr;

  // 4. Insert breakdown into detalle_reservacion
  if (datos.paquetes && datos.paquetes.length > 0) {
    const { error: detErr } = await supabase
      .from('detalle_reservacion')
      .insert(
        datos.paquetes.map(p => ({
          id_reservacion: resData.id_reservacion,
          id_paquete: p.idPaquete,
          cantidad: p.cantidad,
        }))
      );
    if (detErr) throw detErr;
  } else if (datos.idPaquete) {
    // Legacy fallback if only one package provided
    const { error: detErr } = await supabase
      .from('detalle_reservacion')
      .insert({
        id_reservacion: resData.id_reservacion,
        id_paquete: datos.idPaquete,
        cantidad: datos.cantidadPersonas,
      });
    if (detErr) throw detErr;
  }

  return resData as Reservacion;
}

/**
 * Marcar un pase como "Abordado" (Barco).
 */
export async function marcarAbordado(idReservacion: number) {
  const { error } = await supabase
    .from('reservacion')
    .update({ estado_pase: 'Abordado' })
    .eq('id_reservacion', idReservacion)
    .eq('estado_pase', 'Aprobado'); // Only approved passes can board

  if (error) throw error;
}

/**
 * Aprobar un pase manualmente (Caseta).
 */
export async function aprobarPase(idReservacion: number) {
  const { error } = await supabase
    .from('reservacion')
    .update({ estado_pase: 'Aprobado' })
    .eq('id_reservacion', idReservacion);

  if (error) throw error;
}

/**
 * Rechazar un pase (Caseta).
 */
export async function rechazarPase(idReservacion: number) {
  const { error } = await supabase
    .from('reservacion')
    .update({ estado_pase: 'Rechazado' })
    .eq('id_reservacion', idReservacion);

  if (error) throw error;
}

/**
 * Reubicar un no-show a otro viaje (Caseta).
 */
export async function reubicarReservacion(
  idOriginal: number,
  idViajeNuevo: number,
) {
  // Get the original reservation data
  const { data: original, error: fetchErr } = await supabase
    .from('reservacion')
    .select('*')
    .eq('id_reservacion', idOriginal)
    .single();

  if (fetchErr || !original) throw fetchErr ?? new Error('Reservación no encontrada');

  // Create new reservation linked to original
  const { data, error } = await supabase
    .from('reservacion')
    .insert({
      id_cliente: original.id_cliente,
      id_paquete: original.id_paquete,
      id_viaje: idViajeNuevo,
      cantidad_personas: original.cantidad_personas,
      subtotal: original.subtotal,
      total_pagar: original.total_pagar,
      es_reubicacion: true,
      reservacion_original_id: idOriginal,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Reservacion;
}
