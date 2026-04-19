// src/services/ventas.service.ts
import type { Cliente, ReservacionInsert } from "../lib/database.types";
import { supabase } from "../lib/supabase";

export const registrarNuevaVenta = async (
  datosCliente: Cliente,
  datosReserva: Omit<ReservacionInsert, "id_cliente">,
) => {
  try {
    const { data: clienteData, error: errorCliente } = await supabase
      .from("Cliente")
      .insert([
        {
          nombre_completo: datosCliente.nombre_completo,
          telefono: datosCliente.telefono,
        },
      ])
      .select("id_cliente")
      .single();

    if (errorCliente) throw new Error(`Error cliente: ${errorCliente.message}`);

    const { data: reservaData, error: errorReserva } = await supabase
      .from("Reservacion")
      .insert([
        {
          id_cliente: clienteData.id_cliente,
          id_paquete: datosReserva.id_paquete,
          id_viaje: datosReserva.id_viaje,
          cantidad_personas: datosReserva.cantidad_personas,
        },
      ])
      .select("id_reservacion, total_pagar, estado_pase")
      .single();

    if (errorReserva) throw new Error(`Error reserva: ${errorReserva.message}`);

    return { exito: true, datos: reservaData };
  } catch (error) {
    console.error(error);
    return { exito: false, error };
  }
};
