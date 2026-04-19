// src/lib/database.types.ts

export type RangoUsuario = "Vendedor" | "Caseta" | "Barco" | "Comprador";
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

export interface Cliente {
  id_cliente?: number;
  nombre_completo: string;
  telefono: string;
  es_registrado?: boolean;
}

export interface ReservacionInsert {
  id_cliente: number;
  id_paquete: number;
  id_viaje: number;
  cantidad_personas: number;
}
