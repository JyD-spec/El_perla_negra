import { supabase } from '@/src/lib/supabase';

export async function obtenerEstadisticasHistoricasVendedores() {
  const { data, error } = await supabase
    .from('vista_estadisticas_vendedores')
    .select('*')
    .order('total_ingresos', { ascending: false });

  if (error) throw error;
  return data as any[];
}

export async function obtenerEstadisticasHistoricasBarcos() {
  const { data, error } = await supabase
    .from('vista_estadisticas_barcos')
    .select('*')
    .order('total_ingresos', { ascending: false });

  if (error) throw error;
  return data as any[];
}
