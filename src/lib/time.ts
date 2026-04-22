// src/lib/time.ts

/**
 * Convierte un string de hora pura "HH:mm[:ss]" a formato humano de 12 horas (ej. 9:15 PM)
 */
export const format12h = (timeStr?: string | null) => {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

/**
 * Convierte un Timestamp ISO UTC a formato humano de 12 horas en hora local.
 */
export const format12hISO = (isoStr?: string | null) => {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};
