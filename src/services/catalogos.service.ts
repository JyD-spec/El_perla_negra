import { supabase } from '@/src/lib/supabase';
import type { Embarcacion, Paquete, Descuento } from '@/src/lib/database.types';

export async function obtenerBarcos() {
  const { data, error } = await supabase
    .from('embarcacion')
    .select('*')
    .order('nombre');
  if (error) throw error;
  return data as Embarcacion[];
}

export async function upsertBarco(barco: Partial<Embarcacion>) {
  console.log("upsertBarco called with:", barco);
  if (barco.id_embarcacion) {
    console.log("Updating existing barco with ID:", barco.id_embarcacion);
    const { id_embarcacion, ...payload } = barco;
    const { data, error } = await supabase
      .from('embarcacion')
      .update(payload)
      .eq('id_embarcacion', id_embarcacion)
      .select()
      .single();
    if (error) {
      console.error("Update Error:", error);
      throw error;
    }
    return data as Embarcacion;
  } else {
    console.log("Inserting new barco");
    const { data, error } = await supabase
      .from('embarcacion')
      .insert(barco)
      .select()
      .single();
    if (error) {
      console.error("Insert Error:", error);
      throw error;
    }
    return data as Embarcacion;
  }
}

export async function obtenerPaquetes() {
  const { data, error } = await supabase
    .from('paquete')
    .select('*')
    .order('descripcion');
  if (error) throw error;
  return data as Paquete[];
}

export async function upsertPaquete(paquete: Partial<Paquete>) {
  if (paquete.id_paquete) {
    const { data, error } = await supabase
      .from('paquete')
      .update(paquete)
      .eq('id_paquete', paquete.id_paquete)
      .select()
      .single();
    if (error) throw error;
    return data as Paquete;
  } else {
    const { data, error } = await supabase
      .from('paquete')
      .insert(paquete)
      .select()
      .single();
    if (error) throw error;
    return data as Paquete;
  }
}

export async function obtenerDescuentos() {
  const { data, error } = await supabase
    .from('descuento')
    .select('*, paquete_condicion:paquete(descripcion)')
    .order('nombre');
  if (error) throw error;
  return data;
}

export async function upsertDescuento(descuento: Partial<Descuento>) {
  if (descuento.id_descuento) {
    const { data, error } = await supabase
      .from('descuento')
      .update(descuento)
      .eq('id_descuento', descuento.id_descuento)
      .select()
      .single();
    if (error) throw error;
    return data as Descuento;
  } else {
    const { data, error } = await supabase
      .from('descuento')
      .insert(descuento)
      .select()
      .single();
    if (error) throw error;
    return data as Descuento;
  }
}

export async function eliminarBarco(id: number) {
  const { error } = await supabase
    .from('embarcacion')
    .delete()
    .eq('id_embarcacion', id);
  if (error) throw error;
}

export async function eliminarPaquete(id: number) {
  const { error } = await supabase
    .from('paquete')
    .delete()
    .eq('id_paquete', id);
  if (error) throw error;
}

export async function eliminarDescuento(id: number) {
  const { error } = await supabase
    .from('descuento')
    .delete()
    .eq('id_descuento', id);
  if (error) throw error;
}
