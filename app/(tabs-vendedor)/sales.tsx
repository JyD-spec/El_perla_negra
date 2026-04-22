import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { obtenerMisVentas } from '@/src/services/reservaciones.service';
import type { ReservacionConDetalles } from '@/src/lib/database.types';
import { format12h } from '@/src/lib/time';

/* ────────────────────────────────────────────────────────────
   Vendedor – Historial de Ventas del Día
   ──────────────────────────────────────────────────────────── */

export default function VendedorSalesScreen() {
  const insets = useSafeAreaInsets();
  const [ventas, setVentas] = useState<ReservacionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerMisVentas();
      setVentas(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalVentas = ventas.reduce((s, v) => s + v.total_pagar, 0);
  const totalPersonas = ventas.reduce((s, v) => s + v.cantidad_personas, 0);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={PerlaColors.tertiary} />
      }
    >
      <Text style={styles.title}>Mis Ventas</Text>
      <Text style={styles.dateText}>
        {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>

      {/* ── Summary ────────────────────────────────── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{ventas.length}</Text>
          <Text style={styles.summaryLabel}>Ventas</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalPersonas}</Text>
          <Text style={styles.summaryLabel}>Personas</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: PerlaColors.tertiary }]}>
            ${totalVentas.toLocaleString('es-MX')}
          </Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      {/* ── Sales List ─────────────────────────────── */}
      {ventas.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Sin ventas hoy</Text>
          <Text style={styles.emptyText}>Ve al panel para registrar tu primera venta</Text>
        </View>
      )}

      {ventas.map(v => (
        <View key={v.id_reservacion} style={styles.saleCard}>
          <View style={styles.saleHeader}>
            <Text style={styles.saleName}>{v.cliente?.nombre_completo ?? 'Cliente'}</Text>
            <Text style={[styles.saleAmount, { color: PerlaColors.tertiary }]}>
              ${v.total_pagar.toFixed(0)}
            </Text>
          </View>
          <Text style={styles.saleDetail}>
            {v.paquete?.descripcion} · {v.cantidad_personas} persona{v.cantidad_personas !== 1 ? 's' : ''}
          </Text>
          <View style={styles.saleFooter}>
            <Text style={styles.saleTime}>
              🕐 {format12h((v.viaje as any)?.hora_salida_programada)}
            </Text>
            <View style={[
              styles.saleBadge,
              { backgroundColor: v.estado_pago === 'Pagado' ? '#66BB6A22' : '#FFA72622' },
            ]}>
              <Text style={[
                styles.saleBadgeText,
                { color: v.estado_pago === 'Pagado' ? '#66BB6A' : '#FFA726' },
              ]}>
                {v.estado_pago ?? 'Pendiente'}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 4 },
  dateText: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, marginBottom: 20, textTransform: 'capitalize' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  summaryValue: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.onSurface, marginBottom: 4 },
  summaryLabel: { fontFamily: 'Manrope', fontSize: 10, color: PerlaColors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.8 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontFamily: 'Newsreader', fontSize: 20, color: PerlaColors.onSurface, marginBottom: 6 },
  emptyText: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant },

  saleCard: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '15',
  },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  saleName: { fontFamily: 'Manrope-Bold', fontSize: 15, color: PerlaColors.onSurface },
  saleAmount: { fontFamily: 'Newsreader-Bold', fontSize: 18 },
  saleDetail: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant, marginBottom: 10 },
  saleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saleTime: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  saleBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  saleBadgeText: { fontFamily: 'Manrope-Bold', fontSize: 10, textTransform: 'uppercase' },
});
