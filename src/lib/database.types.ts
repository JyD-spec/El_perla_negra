// src/lib/database.types.ts
// Auto-generated from Supabase — DO NOT EDIT manually

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/* ── Enums ──────────────────────────────────────────────── */

export type RangoUsuario = "Vendedor" | "Caseta" | "Barco" | "Comprador" | "Dev";
export type EstadoOperativoBarco = "Activo" | "Mantenimiento" | "Inactivo";
export type EstadoViaje =
  | "Programado"
  | "Retrasado"
  | "Abordando"
  | "En_Navegacion"
  | "Finalizado"
  | "Cancelado";
export type EstadoPase =
  | "Pendiente_Caseta"
  | "Aprobado"
  | "Rechazado"
  | "Abordado"
  | "Vencido";

/* ── Row types (what you SELECT) ────────────────────────── */

export interface Cliente {
  id_cliente: number;
  auth_id: string | null;
  nombre_completo: string;
  telefono: string;
  es_registrado: boolean | null;
  push_token: string | null;
  created_at: string | null;
}

export interface Paquete {
  id_paquete: number;
  descripcion: string;
  costo_persona: number;
}

export interface Embarcacion {
  id_embarcacion: number;
  nombre: string;
  capacidad_maxima: number;
  matricula: string | null;
  estado_operativo: EstadoOperativoBarco | null;
  duracion_estandar_viaje: number | null;
  margen_tolerancia_minutos: number | null;
}

export interface Viaje {
  id_viaje: number;
  fecha_programada: string;
  hora_salida_programada: string;
  estado_viaje: EstadoViaje | null;
  id_embarcacion: number;
  id_encargado_abordaje: string | null;
  retraso_minutos: number | null;
  hora_inicio_abordaje: string | null;
  hora_salida_real: string | null;
  hora_llegada_real: string | null;
  clima_estado: string | null;
  clima_viento_kmh: number | null;
  clima_oleaje_m: number | null;
  es_ultima_vuelta: boolean | null;
  motivo_alteracion: string | null;
  tiempo_estimado_regreso: string | null;
  notificado_salida: boolean | null;
  notificado_llegada: boolean | null;
  created_at: string | null;
}

export interface Reservacion {
  id_reservacion: number;
  id_cliente: number;
  id_paquete: number;
  id_viaje: number;
  id_vendedor: string | null;
  cantidad_personas: number;
  subtotal: number;
  descuento_aplicado: number | null;
  total_pagar: number;
  estado_pago: string | null;
  estado_pase: EstadoPase | null;
  pin_verificacion: string | null;
  codigo_qr: string | null;
  es_reubicacion: boolean | null;
  reservacion_original_id: number | null;
  created_at: string | null;
}

export interface Pago {
  id_pago: number;
  id_reservacion: number;
  monto_pagado: number;
  metodo_pago: string;
  numero_cuenta: string | null;
  tipo_cuenta: string | null;
  fecha_pago: string | null;
}

export interface Usuario {
  id_usuario: string;
  nombre: string;
  rango: RangoUsuario;
}

export interface BitacoraAuditoria {
  id_bitacora: number;
  tabla_afectada: string;
  accion: string;
  id_registro: string;
  usuario_id: string | null;
  datos_anteriores: Json | null;
  datos_nuevos: Json | null;
  fecha_registro: string | null;
}

/* ── View types ─────────────────────────────────────────── */

export interface VistaEstadisticasDiarias {
  fecha: string | null;
  barco: string | null;
  total_viajes: number | null;
  viajes_cancelados: number | null;
  total_pasajeros: number | null;
  ingresos_totales: number | null;
}

export interface VistaKpiOperativos {
  mes: string | null;
  total_viajes_programados: number | null;
  promedio_retraso_minutos: number | null;
  racha_viento_maxima_registrada: number | null;
  eficiencia_puntualidad_pct: number | null;
}

export interface VistaOperativaViajes {
  id_viaje: number | null;
  fecha_programada: string | null;
  hora_salida_programada: string | null;
  estado_viaje: EstadoViaje | null;
  retraso_minutos: number | null;
  nombre_barco: string | null;
  margen_tolerancia_minutos: number | null;
  hora_limite_zarpe: string | null;
}

/* ── Insert types (what you INSERT) ─────────────────────── */

export interface ReservacionInsert {
  id_cliente: number;
  id_paquete: number;
  id_viaje: number;
  cantidad_personas: number;
  id_vendedor?: string | null;
  descuento_aplicado?: number | null;
  subtotal: number;
  total_pagar: number;
}

export interface PagoInsert {
  id_reservacion: number;
  monto_pagado: number;
  metodo_pago: string;
  numero_cuenta?: string | null;
  tipo_cuenta?: string | null;
}

export interface ViajeInsert {
  fecha_programada: string;
  hora_salida_programada: string;
  id_embarcacion: number;
  id_encargado_abordaje?: string | null;
  es_ultima_vuelta?: boolean;
}

/* ── Join types (enriched with relations) ───────────────── */

export interface ReservacionConDetalles extends Reservacion {
  paquete?: Paquete;
  viaje?: Viaje & { embarcacion?: Embarcacion };
  cliente?: Cliente;
}

export interface ViajeConDetalles extends Viaje {
  embarcacion?: Embarcacion;
  encargado?: Usuario;
}
