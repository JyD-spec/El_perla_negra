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
  const { data, error } = await supabase
    .from('embarcacion')
    .upsert(barco)
    .select()
    .single();
  if (error) throw error;
  return data as Embarcacion;
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
  const { data, error } = await supabase
    .from('paquete')
    .upsert(paquete)
    .select()
    .single();
  if (error) throw error;
  return data as Paquete;
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
  const { data, error } = await supabase
    .from('descuento')
    .upsert(descuento)
    .select()
    .single();
  if (error) throw error;
  return data as Descuento;
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
