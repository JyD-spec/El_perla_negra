import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { supabase } from '@/src/lib/supabase';
import { format12h } from '@/src/lib/time';
import { obtenerMisVentas } from '@/src/services/reservaciones.service';
import type { ReservacionConDetalles } from '@/src/lib/database.types';

/* ────────────────────────────────────────────────────────────
   Vendedor – Mis Ventas (Caseta Reservations Style)
   ──────────────────────────────────────────────────────────── */

type Filtro = 'Todos' | 'Pendiente' | 'Pagado' | 'Rechazado';

const FILTROS: { key: Filtro; label: string; icon: string }[] = [
  { key: 'Todos',     label: 'Todas',      icon: '📋' },
  { key: 'Pendiente', label: 'Pendientes', icon: '⏳' },
  { key: 'Pagado',    label: 'Pagadas',    icon: '✅' },
  { key: 'Rechazado', label: 'Rechazadas', icon: '❌' },
];

const ESTADO_STYLE: Record<string, { bg: string; text: string }> = {
  Pendiente: { bg: '#FFA726' + '22', text: '#FFA726' },
  Pagado:    { bg: '#66BB6A' + '22', text: '#66BB6A' },
  Rechazado: { bg: '#EF5350' + '22', text: '#EF5350' },
};

export default function VendedorSalesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();

  const [ventas, setVentas] = useState<ReservacionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    id: number | null;
    type: 'aprobar' | 'rechazar';
  }>({ visible: false, title: '', message: '', id: null, type: 'aprobar' });

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerMisVentas();
      setVentas(data);
    } catch (err) {
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('mis-ventas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservacion', filter: `id_vendedor=eq.${user?.id}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  /* ── Filtered list ──────────────────────────────── */
  const filtered = ventas.filter(v => {
    // Primero el filtro de estado
    const estado = v.estado_pase === 'Rechazado' ? 'Rechazado' : v.estado_pago;
    if (filtro !== 'Todos' && estado !== filtro) return false;

    // Luego la búsqueda
    if (busqueda) {
      const q = busqueda.toUpperCase();
      const nombre = (v.cliente?.nombre_completo || v.nombre_cliente_manual || '').toUpperCase();
      const pin = (v.pin_verificacion || '').toUpperCase();
      const tel = (v.cliente?.telefono || '');
      if (!nombre.includes(q) && !pin.includes(q) && !tel.includes(q)) return false;
    }
    return true;
  });

  /* ── Stats ──────────────────────────────────────── */
  const totalVentas = ventas.reduce((s, v) => v.estado_pase !== 'Rechazado' ? s + v.total_pagar : s, 0);
  const totalPersonas = ventas.reduce((s, v) => v.estado_pase !== 'Rechazado' ? s + v.cantidad_personas : s, 0);

  /* ── Handlers ──────────────────────────────────────────── */
  const handleAprobarPago = async (id: number) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('reservacion')
        .update({ estado_pago: 'Pagado', estado_pase: 'Aprobado' })
        .eq('id_reservacion', id);

      if (error) throw error;
      toast.success('Pago aprobado correctamente');
      fetchData();
    } catch (err) {
      toast.error('Error al aprobar el pago');
    } finally {
      setActionLoading(null);
      setConfirmModal(p => ({ ...p, visible: false }));
    }
  };

  const handleRechazarVenta = async (id: number) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('reservacion')
        .update({ estado_pase: 'Rechazado' })
        .eq('id_reservacion', id);

      if (error) throw error;
      toast.success('Venta rechazada');
      fetchData();
    } catch (err) {
      toast.error('Error al rechazar');
    } finally {
      setActionLoading(null);
      setConfirmModal(p => ({ ...p, visible: false }));
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.glowTop} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PerlaColors.tertiary} />
        }
      >
        <Text style={styles.title}>Mis Ventas</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        {/* ── Stats Bento Row ──────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statVal}>{ventas.filter(v => v.estado_pase !== 'Rechazado').length}</Text>
            <Text style={styles.statLab}>VENTAS</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statVal}>{totalPersonas}</Text>
            <Text style={styles.statLab}>PERSONAS</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: PerlaColors.tertiary + '10' }]}>
            <Text style={[styles.statVal, { color: PerlaColors.tertiary }]}>${totalVentas.toLocaleString()}</Text>
            <Text style={styles.statLab}>INGRESOS</Text>
          </View>
        </View>

        {/* ── Search Bar (Caseta Style) ──────────────── */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Nombre, PIN o teléfono..."
            placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
          />
          {busqueda.length > 0 && (
            <Pressable onPress={() => setBusqueda('')}><Text style={styles.searchClear}>✕</Text></Pressable>
          )}
        </View>

        {/* ── Filter Chips ───────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {FILTROS.map(f => {
            const isActive = filtro === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFiltro(f.key)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {f.icon} {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.resultsCount}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</Text>

        {/* ── Results List ──────────────────────────── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>Sin ventas</Text>
            <Text style={styles.emptyText}>No hay registros que coincidan.</Text>
          </View>
        ) : (
          filtered.map((v) => {
            const estadoActual = v.estado_pase === 'Rechazado' ? 'Rechazado' : v.estado_pago || 'Pendiente';
            const estilo = ESTADO_STYLE[estadoActual] || ESTADO_STYLE.Pendiente;
            const isRechazado = v.estado_pase === 'Rechazado';
            const isPending = v.estado_pago === 'Pendiente' && !isRechazado;
            const isLoading = actionLoading === v.id_reservacion;

            return (
              <View key={v.id_reservacion} style={[styles.resCard, isRechazado && { opacity: 0.6 }]}>
                {/* Header */}
                <View style={styles.resHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resName}>
                      {v.cliente?.nombre_completo || v.nombre_cliente_manual || 'Invitado'}
                    </Text>
                    <Text style={styles.resDetail}>
                      📱 {v.cliente?.telefono || '—'} · {v.cantidad_personas} pers. · {v.paquete?.descripcion || 'Paquete'}
                    </Text>
                  </View>
                  <View style={[styles.resBadge, { backgroundColor: estilo.bg }]}>
                    <Text style={[styles.resBadgeText, { color: estilo.text }]}>
                      {estadoActual.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Info Row */}
                <View style={styles.resInfoRow}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🕐</Text>
                    <Text style={styles.infoText}>{format12h((v.viaje as any)?.hora_salida_programada)}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🚤</Text>
                    <Text style={styles.infoText}>{(v.viaje as any)?.embarcacion?.nombre || 'Barco'}</Text>
                  </View>
                  <Text style={styles.resPrice}>${v.total_pagar.toLocaleString()}</Text>
                </View>

                {/* Footer / PIN / Payment */}
                <View style={styles.resFooter}>
                  <Text style={styles.resPin}>
                    {v.pin_verificacion ? `PIN: ${v.pin_verificacion}` : '---'}
                  </Text>
                  <Text style={styles.paymentMeta}>
                    {v.pago?.[0]?.metodo_pago === 'Transferencia' ? '🏦 Transf.' : 
                     v.pago?.[0]?.metodo_pago === 'Tarjeta' ? '💳 Tarjeta' : '💵 Efectivo'}
                  </Text>
                </View>

                {/* Actions (Only if Pending) */}
                {isPending && (
                  <View style={styles.resActions}>
                    <Pressable
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => setConfirmModal({
                        visible: true, title: 'Rechazar Venta', message: '¿Estás seguro de cancelar esta reservación?', id: v.id_reservacion, type: 'rechazar'
                      })}
                      disabled={isLoading}
                    >
                      <Text style={styles.rejectText}>✕ Rechazar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => setConfirmModal({
                        visible: true, title: 'Confirmar Pago', message: '¿Verificaste que el dinero llegó a la cuenta?', id: v.id_reservacion, type: 'aprobar'
                      })}
                      disabled={isLoading}
                    >
                      {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>✅ Aprobar</Text>}
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Caseta Style Confirm Modal ────────────── */}
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={30} tint="dark" style={styles.modalContent}>
            <Text style={styles.modalTitle}>{confirmModal.title}</Text>
            <Text style={styles.modalMessage}>{confirmModal.message}</Text>
            <View style={styles.modalActions}>
              <Pressable 
                style={styles.modalCancelBtn} 
                onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalConfirmBtn, confirmModal.type === 'rechazar' && { backgroundColor: '#EF5350' }]} 
                onPress={() => {
                  if (confirmModal.id) {
                    confirmModal.type === 'aprobar' ? handleAprobarPago(confirmModal.id) : handleRechazarVenta(confirmModal.id);
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.surface },
  content: { paddingHorizontal: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  glowTop: {
    position: "absolute",
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: PerlaColors.tertiary + "05",
  },
  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 4 },
  subtitle: { fontFamily: 'Manrope-Bold', fontSize: 13, color: PerlaColors.onSurfaceVariant, marginBottom: 24, textTransform: 'capitalize' },

  /* Stats Bento */
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statTile: { flex: 1, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: PerlaColors.outlineVariant + '15' },
  statVal: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.onSurface, marginBottom: 2 },
  statLab: { fontFamily: 'Manrope-Bold', fontSize: 9, color: PerlaColors.onSurfaceVariant, letterSpacing: 0.8 },

  /* Search Bar (Exact Caseta) */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '20',
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontFamily: 'Manrope', fontSize: 15, color: PerlaColors.onSurface, paddingVertical: 14 },
  searchClear: { fontSize: 16, color: PerlaColors.onSurfaceVariant, padding: 4 },

  /* Filters Chips */
  filterRow: { marginBottom: 16, flexGrow: 0 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: PerlaColors.surfaceContainerLow, marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  filterChipActive: { backgroundColor: PerlaColors.tertiary + '18', borderColor: PerlaColors.tertiary + '40' },
  filterChipText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  filterChipTextActive: { color: PerlaColors.tertiary, fontFamily: 'Manrope-Bold' },

  resultsCount: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant, marginBottom: 12 },

  /* Reservation Card (Caseta Style) */
  resCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '15',
  },
  resHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  resName: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onSurface, marginBottom: 2 },
  resDetail: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  resBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  resBadgeText: { fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 0.5 },

  resInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: PerlaColors.outlineVariant + '10' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoIcon: { fontSize: 14 },
  infoText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  resPrice: { fontFamily: 'Newsreader-Bold', fontSize: 20, color: PerlaColors.tertiary, marginLeft: 'auto' },

  resFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resPin: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.onSurfaceVariant + '80', letterSpacing: 1 },
  paymentMeta: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurfaceVariant },

  /* Actions (Caseta Style) */
  resActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  rejectBtn: { backgroundColor: '#EF5350' + '15', borderWidth: 1, borderColor: '#EF5350' + '30' },
  rejectText: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#EF5350' },
  approveBtn: { backgroundColor: '#66BB6A' },
  approveText: { fontFamily: 'Manrope-Bold', color: '#fff', fontSize: 14 },

  /* Modal (Caseta Style) */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20', overflow: 'hidden' },
  modalTitle: { fontFamily: 'Newsreader-Bold', fontSize: 26, color: PerlaColors.onSurface, marginBottom: 12 },
  modalMessage: { fontFamily: 'Manrope', fontSize: 15, color: PerlaColors.onSurfaceVariant, marginBottom: 28, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, backgroundColor: PerlaColors.surfaceContainerHighest },
  modalCancelText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurfaceVariant, fontSize: 14 },
  modalConfirmBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, backgroundColor: '#66BB6A' },
  modalConfirmText: { fontFamily: 'Manrope-Bold', color: '#fff', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Newsreader', fontSize: 22, color: PerlaColors.onSurface, marginBottom: 8 },
  emptyText: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, textAlign: 'center' },
});
