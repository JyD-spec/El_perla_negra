import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { supabase } from '../lib/supabase';

/**
 * Genera el nombre del archivo con formato reporte-DD-MM-YYYY
 */
function getFormatedFileName(prefix: string = 'reporte') {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${prefix}-${day}-${month}-${year}`;
}

/**
 * EXPORTAR EXCEL (CSV)
 */
export async function exportarExcel(rangoInicio: string, rangoFin: string) {
  const { data, error } = await supabase
    .from('reservacion')
    .select(`
      id_reservacion,
      created_at,
      total_pagar,
      cantidad_personas,
      estado_pago,
      paquete(descripcion),
      vendedor:usuario(nombre),
      viaje(embarcacion(nombre))
    `)
    .gte('created_at', rangoInicio + 'T00:00:00')
    .lte('created_at', rangoFin + 'T23:59:59')
    .eq('estado_pago', 'Pagado');

  if (error) throw error;

  const headers = ['Folio', 'Fecha', 'Hora', 'Barco', 'Vendedor', 'Paquete', 'Pax', 'Ingreso'];
  const rows = ((data as any[]) || []).map(r => {
    const d = new Date(r.created_at);
    return [
      r.id_reservacion,
      d.toLocaleDateString('es-MX'),
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      r.viaje?.embarcacion?.nombre || 'N/A',
      r.vendedor?.nombre || 'Online/Caseta',
      r.paquete?.descripcion || 'N/A',
      r.cantidad_personas,
      r.total_pagar
    ].map(val => `"${val}"`).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const fileName = `${getFormatedFileName('reporte')}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // @ts-ignore
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    // @ts-ignore
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar Reporte de Ventas',
      });
    }
  }
}

/**
 * EXPORTAR PDF (CORTE DE CAJA PROFESIONAL)
 */
export async function exportarPDF(statsData: any, fechaInicio: string, fechaFin: string, paymentStats: any[] = []) {
  const { data: detailData, error } = await supabase
    .from('reservacion')
    .select(`
      id_reservacion,
      created_at,
      total_pagar,
      cantidad_personas,
      metodo_pago,
      vendedor:usuario(nombre),
      paquete(descripcion)
    `)
    .gte('created_at', fechaInicio + 'T00:00:00')
    .lte('created_at', fechaFin + 'T23:59:59')
    .eq('estado_pago', 'Pagado')
    .order('created_at', { ascending: true });

  if (error) console.error("Error fetching details for PDF:", error);

  const detailRows = (detailData as any[] || []).map(r => `
    <tr>
      <td style="border-bottom: 1px solid #eee; padding: 8px;">${r.id_reservacion}</td>
      <td style="border-bottom: 1px solid #eee; padding: 8px;">${new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
      <td style="border-bottom: 1px solid #eee; padding: 8px;">${r.vendedor?.nombre || 'Online/Caseta'}</td>
      <td style="border-bottom: 1px solid #eee; padding: 8px;">${r.paquete?.descripcion || '—'}</td>
      <td style="border-bottom: 1px solid #eee; padding: 8px;">${r.metodo_pago || 'Card/Online'}</td>
      <td style="border-bottom: 1px solid #eee; padding: 8px; text-align: right; font-weight: bold;">$${Number(r.total_pagar).toLocaleString()}</td>
    </tr>
  `).join('');

  const paymentRows = (paymentStats || []).map(p => `
    <tr>
      <td style="border-bottom: 1px solid #eee; padding: 8px;">${p.metodo_pago || 'Desconocido'}</td>
      <td style="border-bottom: 1px solid #eee; padding: 8px; text-align: right;">$${Number(p.total_ingresos || 0).toLocaleString()}</td>
      <td style="border-bottom: 1px solid #eee; padding: 8px; text-align: right;">${p.total_transacciones || 0} ops</td>
    </tr>
  `).join('');

  const dynamicTitle = getFormatedFileName('reporte');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${dynamicTitle}</title>
      <style>
        body { font-family: sans-serif; color: #333; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #8e7343; margin-bottom: 20px; padding-bottom: 10px; }
        .title { font-size: 24px; font-weight: bold; color: #8e7343; }
        .summary { display: flex; justify-content: space-around; background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #ddd; }
        .stat { text-align: center; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .stat-value { font-size: 20px; font-weight: bold; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #8e7343; color: white; padding: 10px; text-align: left; font-size: 12px; }
        h2 { font-size: 16px; color: #8e7343; border-bottom: 1px solid #8e7343; padding-bottom: 5px; margin-top: 30px; }
        .footer { margin-top: 40px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
        .signatures { display: flex; justify-content: space-around; margin-top: 50px; }
        .sig-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">EL PERLA NEGRA</div>
        <div style="font-size: 14px; color: #666;">CORTE DE CAJA OPERATIVO</div>
        <div style="font-size: 12px; margin-top: 5px;">Periodo: ${fechaInicio} al ${fechaFin}</div>
      </div>

      <div class="summary">
        <div class="stat">
          <div class="stat-label">Ingresos Totales</div>
          <div class="stat-value" style="color: #2e7d32;">$${Number(statsData.totalIngresos || 0).toLocaleString()}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Pasajeros (Pax)</div>
          <div class="stat-value">${statsData.totalPax || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Operaciones</div>
          <div class="stat-value">${(detailData || []).length}</div>
        </div>
      </div>

      <h2>Resumen por Método de Pago</h2>
      <table style="width: 50%;">
        <thead>
          <tr><th>Método</th><th style="text-align: right;">Total</th><th style="text-align: right;">Cant.</th></tr>
        </thead>
        <tbody>
          ${paymentRows.length > 0 ? paymentRows : '<tr><td colspan="3">Sin registros</td></tr>'}
        </tbody>
      </table>

      <h2>Detalle de Movimientos</h2>
      <table>
        <thead>
          <tr>
            <th>Folio</th>
            <th>Hora</th>
            <th>Vendedor</th>
            <th>Paquete</th>
            <th>Método</th>
            <th style="text-align: right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows || '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay movimientos registrados en este periodo</td></tr>'}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">Firma Responsable</div>
        <div class="sig-box">Firma Administración</div>
      </div>

      <div class="footer">
        Generado desde el Sistema Administrativo El Perla Negra - ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    const oldTitle = document.title;
    try {
      // TRUCO: Cambiamos el título de la ventana principal temporalmente.
      // Chrome usa el document.title de la página activa para el nombre del archivo PDF.
      document.title = dynamicTitle;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          document.body.removeChild(iframe);
          // Restauramos el título original después de imprimir
          document.title = oldTitle;
        }, 500);
      } else {
        await Print.printAsync({ html: htmlContent });
        document.title = oldTitle;
      }
    } catch (err) {
      document.title = oldTitle;
      await Print.printAsync({ html: htmlContent });
    }
  } else {
    const fileName = `${dynamicTitle}.pdf`;
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });
    
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Exportar Corte de Caja'
      });
    }
  }
}
