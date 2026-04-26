import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PerlaColors } from '@/constants/theme';
import { globalEvents } from '@/src/lib/events';
import { useToast } from '@/src/contexts/ToastContext';
import {
  obtenerReservacionesDelDia,
  aprobarPase,
  rechazarPase,
  verificarPIN,
  reubicarReservacion,
} from '@/src/services/reservaciones.service';
import { obtenerViajesDelDia, obtenerCupoViaje } from '@/src/services/viajes.service';
import type { ReservacionConDetalles, EstadoPase, Viaje } from '@/src/lib/database.types';
import { supabase } from '@/src/lib/supabase';
import { format12h, getLocalDateString } from '@/src/lib/time';

/* ────────────────────────────────────────────────────────────
   Caseta – Reservaciones
   Aprobar/rechazar, buscar por PIN, filtrar por estado
   ──────────────────────────────────────────────────────────── */

type Filtro = 'Todos' | 'Pendiente_Caseta' | 'Aprobado' | 'Vencido' | 'Abordado';

const FILTROS: { key: Filtro; label: string; icon: string }[] = [
  { key: 'Todos', label: 'Todos', icon: '📋' },
  { key: 'Pendiente_Caseta', label: 'Pendientes', icon: '⏳' },
  { key: 'Aprobado', label: 'Aprobados', icon: '✅' },
  { key: 'Vencido', label: 'Vencidos', icon: '⚠️' },
  { key: 'Abordado', label: 'Abordados', icon: '🏴‍☠️' },
];

const createStatusStyle = (hexColor: string) => ({
  bg: `${hexColor}22`,
  text: hexColor,
});

const ESTADO_STYLE: Record<string, { bg: string; text: string }> = {
  Pendiente_Caseta: createStatusStyle('#F59E0B'),
  Aprobado: createStatusStyle('#10B981'),
  Rechazado: createStatusStyle('#EF4444'),
  Abordado: createStatusStyle(PerlaColors.tertiary),
  Vencido: createStatusStyle('#64748B'),
};

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };

export default function CasetaReservationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [reservaciones, setReservaciones] = useState<ReservacionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => { } });

  /* ── Reubicar state ──────────────────────────────── */
  const [reubicarModal, setReubicarModal] = useState<{
    visible: boolean;
    reservacion: ReservacionConDetalles | null;
  }>({ visible: false, reservacion: null });
  const [reubicarViajes, setReubicarViajes] = useState<ViajeConEmb[]>([]);
  const [reubicarCupos, setReubicarCupos] = useState<Record<number, number>>({});
  const [reubicarLoading, setReubicarLoading] = useState(false);
  const [reubicarSaving, setReubicarSaving] = useState(false);
  const [reubicarSuccess, setReubicarSuccess] = useState<{
    visible: boolean;
    tripTime?: string;
    boatName?: string;
  }>({ visible: false });
  const toast = useToast();

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerReservacionesDelDia();
      setReservaciones(data);
    } catch (err) {
      console.error('Reservations error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates for reservations
    const channel = supabase
      .channel('reservacion-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservacion' },
        (payload) => {
          console.log('Realtime update received:', payload.eventType);
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // FAB event listener
    const unsubscribe = globalEvents.on('fab-press-reservations', () => {
      router.push('/(tabs-caseta)/new-reservation');
    });

    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  /* ── Filtered list ──────────────────────────────── */
  // Exclude Vencido originals that were already relocated
  // (es_reubicacion=true on the original means it spawned a new reservation)
  const activeReservaciones = reservaciones.filter(r => {
    if (r.estado_pase === 'Vencido' && r.es_reubicacion && !r.reservacion_original_id) return false;
    return true;
  });

  const filtered = activeReservaciones.filter(r => {
    if (filtro !== 'Todos' && r.estado_pase !== filtro) return false;
    if (busqueda) {
      const q = busqueda.toUpperCase();
      const nombre = (r.cliente?.nombre_completo ?? '').toUpperCase();
      const pin = (r.pin_verificacion ?? '').toUpperCase();
      const tel = (r.cliente?.telefono ?? '');
      if (!nombre.includes(q) && !pin.includes(q) && !tel.includes(q)) return false;
    }
    return true;
  });

  /* ── Actions ────────────────────────────────────── */
  const handleAprobar = async (id: number) => {
    setActionLoading(id);
    try {
      await aprobarPase(id);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRechazar = (id: number) => {
    setConfirmModal({
      visible: true,
      title: 'Rechazar Pase',
      message: '¿Estás seguro de que deseas rechazar este pase?',
      onConfirm: async () => {
        setActionLoading(id);
        try {
          await rechazarPase(id);
          await fetchData();
        } catch (err: any) {
          if (Platform.OS === 'web') alert(err.message);
          else Alert.alert('Error', err.message);
        } finally {
          setActionLoading(null);
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }
      }
    });
  };

  /* ── Reubicar ───────────────────────────────────── */
  const openReubicar = async (r: ReservacionConDetalles) => {
    setReubicarModal({ visible: true, reservacion: r });
    setReubicarLoading(true);
    try {
      const hoy = getLocalDateString();
      const viajesData = await obtenerViajesDelDia(hoy);
      // Filter out the current trip and non-reservable trips
      const currentViajeId = (r.viaje as any)?.id_viaje ?? r.id_viaje;
      const available = (viajesData as ViajeConEmb[]).filter(
        v => v.id_viaje !== currentViajeId &&
             v.estado_viaje !== 'Finalizado' &&
             v.estado_viaje !== 'Cancelado'
      );
      setReubicarViajes(available);

      const cupoResults = await Promise.all(
        available.map(v =>
          obtenerCupoViaje(v.id_viaje).then(c => ({ id: v.id_viaje, cupo: c }))
        )
      );
      const m: Record<number, number> = {};
      cupoResults.forEach(c => { m[c.id] = c.cupo; });
      setReubicarCupos(m);
    } catch (err) {
      console.error('Error fetching trips for reubicar:', err);
    } finally {
      setReubicarLoading(false);
    }
  };

  const handleReubicar = async (idViajeNuevo: number) => {
    if (!reubicarModal.reservacion) return;
    setReubicarSaving(true);
    try {
      await reubicarReservacion(reubicarModal.reservacion.id_reservacion, idViajeNuevo);

      // Find the selected trip details for the success message
      const selectedTrip = reubicarViajes.find(v => v.id_viaje === idViajeNuevo);

      // Show success state inside the modal
      setReubicarSaving(false);
      setReubicarSuccess({
        visible: true,
        tripTime: selectedTrip ? format12h(selectedTrip.hora_salida_programada) : undefined,
        boatName: selectedTrip?.embarcacion?.nombre,
      });

      // Auto-dismiss after 1.8s
      setTimeout(async () => {
        setReubicarSuccess({ visible: false });
        setReubicarModal({ visible: false, reservacion: null });
        await fetchData();
      }, 1800);
    } catch (err: any) {
      toast.error(err.message || 'Error al reubicar la reservación.');
    } finally {
      setReubicarSaving(false);
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PerlaColors.tertiary} />
      }
    >
      <Text style={styles.title}>Reservaciones</Text>

      {/* ── Search ──────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar por nombre, PIN o teléfono"
          placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
        />
        {busqueda.length > 0 && (
          <Pressable onPress={() => setBusqueda('')}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* ── Filter Chips ───────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTROS.map(f => {
          const count = f.key === 'Todos'
            ? activeReservaciones.length
            : activeReservaciones.filter(r => r.estado_pase === f.key).length;
          const isActive = filtro === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFiltro(f.key)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {f.icon} {f.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Results ────────────────────────────────── */}
      <Text style={styles.resultsCount}>
        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
      </Text>

      {filtered.map(r => {
        const estado = ESTADO_STYLE[r.estado_pase ?? 'Pendiente_Caseta'] ?? ESTADO_STYLE.Pendiente_Caseta;
        const isLoading = actionLoading === r.id_reservacion;

        return (
          <View key={r.id_reservacion} style={styles.resCard}>
            {/* Header */}
            <View style={styles.resHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resName}>
                  {r.cliente?.nombre_completo ?? 'Cliente'}
                </Text>
                <Text style={styles.resDetail}>
                  📱 {r.cliente?.telefono ?? '—'} · {r.cantidad_personas} pers.
                  {r.pago && r.pago.length > 0 && (
                    <Text style={{ color: r.estado_pago === 'Pendiente' ? '#FFA726' : PerlaColors.onSurfaceVariant }}>
                      {' '}· 💳 {r.pago[0].metodo_pago}{r.estado_pago === 'Pendiente' ? ' (Pend.)' : ''}
                    </Text>
                  )}
                </Text>
              </View>
              <View style={[styles.resBadge, { backgroundColor: estado.bg }]}>
                <Text style={[styles.resBadgeText, { color: estado.text }]}>
                  {(r.estado_pase === 'Pendiente_Caseta' ? 'Pendiente' : (r.estado_pase ?? 'Pendiente')).replace('_', ' ')}
                </Text>
              </View>
            </View>

            {/* Info */}
            <View style={styles.resInfoRow}>
              <Text style={styles.resInfo}>
                🎫 {r.paquete?.descripcion ?? 'Paquete'}
              </Text>
              <Text style={styles.resInfo}>
                🕐 {format12h((r.viaje as any)?.hora_salida_programada)}
              </Text>
              <Text style={[styles.resInfo, { color: PerlaColors.tertiary }]}>
                ${r.total_pagar.toFixed(0)}
              </Text>
            </View>

            {/* PIN */}
            {r.pin_verificacion && (
              <Text style={styles.resPin}>
                PIN: {r.pin_verificacion}
              </Text>
            )}

            {/* Actions — only for Pendiente */}
            {r.estado_pase === 'Pendiente_Caseta' && (
              <View style={styles.resActions}>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleRechazar(r.id_reservacion)}
                  disabled={isLoading}
                >
                  <Text style={styles.rejectText}>❌ Rechazar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleAprobar(r.id_reservacion)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.approveText}>✅ Aprobar</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* Vencido — reubicar */}
            {r.estado_pase === 'Vencido' && (
              <Pressable
                style={[styles.actionBtn, styles.reubicarBtn]}
                onPress={() => openReubicar(r)}
              >
                <Text style={styles.reubicarText}>🔄 Reubicar en otro viaje</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {/* ── Confirm Modal ─────────────────────────── */}
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                style={styles.modalConfirmBtn}
                onPress={confirmModal.onConfirm}
              >
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reubicar Modal ─────────────────────────── */}
      <Modal visible={reubicarModal.visible} transparent animationType="slide">
        <View style={styles.reubicarOverlay}>
          <View style={styles.reubicarSheet}>
            {/* Drag handle */}
            <View style={styles.reubicarDragHandle} />

            {/* Header */}
            <View style={styles.reubicarHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reubicarTitle}>🔄 Reubicar Reservación</Text>
                <Text style={styles.reubicarHeaderHint}>Selecciona el nuevo viaje para este pasajero</Text>
              </View>
              <Pressable
                style={styles.reubicarCloseCircle}
                onPress={() => setReubicarModal({ visible: false, reservacion: null })}
              >
                <Text style={styles.reubicarCloseX}>✕</Text>
              </Pressable>
            </View>

            {/* Reservation summary card */}
            {reubicarModal.reservacion && (
              <View style={styles.reubicarSummaryCard}>
                <View style={styles.reubicarSummaryRow}>
                  <Text style={styles.reubicarSummaryIcon}>👤</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reubicarSummaryName}>
                      {reubicarModal.reservacion.cliente?.nombre_completo ?? 'Cliente'}
                    </Text>
                    <Text style={styles.reubicarSummaryMeta}>
                      {reubicarModal.reservacion.cantidad_personas} persona{reubicarModal.reservacion.cantidad_personas !== 1 ? 's' : ''}
                      {' · '}
                      {reubicarModal.reservacion.paquete?.descripcion ?? 'Paquete'}
                      {' · '}
                      🕒 {format12h((reubicarModal.reservacion.viaje as any)?.hora_salida_programada)}
                    </Text>
                  </View>
                  <Text style={styles.reubicarSummaryAmount}>
                    ${reubicarModal.reservacion.total_pagar?.toFixed(0)}
                  </Text>
                </View>
              </View>
            )}

            {/* Section label */}
            <Text style={styles.reubicarSectionLabel}>Viajes disponibles hoy</Text>

            {/* Content */}
            {reubicarLoading ? (
              <View style={[styles.centered, { flex: 1 }]}>
                <ActivityIndicator size="large" color={PerlaColors.tertiary} />
                <Text style={styles.reubicarLoadingText}>Buscando viajes...</Text>
              </View>
            ) : reubicarViajes.length === 0 ? (
              <View style={[styles.centered, { flex: 1, paddingHorizontal: 32 }]}>
                <Text style={styles.reubicarEmptyIcon}>⛵</Text>
                <Text style={styles.reubicarEmptyTitle}>Sin viajes disponibles</Text>
                <Text style={styles.reubicarEmptyText}>No hay viajes activos para reubicar hoy. Intenta mañana.</Text>
              </View>
            ) : (
              <FlatList
                data={reubicarViajes}
                keyExtractor={v => String(v.id_viaje)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item: v }) => {
                  const cap = v.embarcacion.capacidad_maxima;
                  const occupied = reubicarCupos[v.id_viaje] ?? 0;
                  const disp = cap - occupied;
                  const fillRatio = cap > 0 ? occupied / cap : 0;
                  const isFull = disp <= 0;
                  const needsSpace = reubicarModal.reservacion
                    ? disp < reubicarModal.reservacion.cantidad_personas
                    : false;
                  const isDisabled = isFull || needsSpace || reubicarSaving;

                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.reubicarTripCard,
                        isDisabled && styles.reubicarTripCardDisabled,
                        !isDisabled && pressed && styles.reubicarTripCardPressed,
                      ]}
                      disabled={isDisabled}
                      onPress={() => handleReubicar(v.id_viaje)}
                    >
                      {/* Gold accent bar for available trips */}
                      {!isDisabled && <View style={styles.reubicarTripAccent} />}

                      <View style={styles.reubicarTripBody}>
                        {/* Top row: time + status + spots */}
                        <View style={styles.reubicarTripTopRow}>
                          <Text style={styles.reubicarTripTime}>{format12h(v.hora_salida_programada)}</Text>
                          <View style={[
                            styles.reubicarTripStatusBadge,
                            { backgroundColor: v.estado_viaje === 'Abordando' ? '#c084fc22' : '#34d39922' },
                          ]}>
                            <Text style={[
                              styles.reubicarTripStatusText,
                              { color: v.estado_viaje === 'Abordando' ? '#c084fc' : '#34d399' },
                            ]}>
                              {v.estado_viaje === 'Abordando' ? 'ACTIVO' : v.estado_viaje?.toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }} />
                          <Text style={[
                            styles.reubicarTripSpotsText,
                            isFull && { color: '#EF5350' },
                          ]}>
                            {isFull ? 'Agotado' : `${disp} disp.`}
                          </Text>
                        </View>

                        {/* Boat name */}
                        <Text style={styles.reubicarTripBoat}>⛵ {v.embarcacion.nombre}</Text>

                        {/* Capacity bar */}
                        <View style={styles.reubicarCapBarBg}>
                          <View style={[
                            styles.reubicarCapBarFill,
                            {
                              width: `${Math.min(fillRatio * 100, 100)}%`,
                              backgroundColor: fillRatio > 0.85 ? '#EF5350' : fillRatio > 0.6 ? '#FFA726' : PerlaColors.tertiary,
                            },
                          ]} />
                        </View>
                        <Text style={styles.reubicarCapLabel}>{occupied}/{cap} ocupados</Text>

                        {/* Warning */}
                        {needsSpace && !isFull && (
                          <Text style={styles.reubicarTripWarn}>⚠️ Espacio insuficiente para {reubicarModal.reservacion?.cantidad_personas} personas</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}

            {/* Cancel footer button */}
            <Pressable
              style={styles.reubicarCancelBtn}
              onPress={() => setReubicarModal({ visible: false, reservacion: null })}
            >
              <Text style={styles.reubicarCancelText}>Cancelar</Text>
            </Pressable>

            {/* Saving overlay */}
            {reubicarSaving && (
              <View style={styles.reubicarSavingOverlay}>
                <View style={styles.reubicarSavingContent}>
                  <ActivityIndicator size="large" color={PerlaColors.tertiary} />
                  <Text style={styles.reubicarSavingText}>Reubicando reservación...</Text>
                </View>
              </View>
            )}

            {/* Success overlay */}
            {reubicarSuccess.visible && (
              <View style={styles.reubicarSuccessOverlay}>
                <View style={styles.reubicarSuccessContent}>
                  <View style={styles.reubicarSuccessCircle}>
                    <Text style={styles.reubicarSuccessCheck}>✓</Text>
                  </View>
                  <Text style={styles.reubicarSuccessTitle}>¡Reubicación exitosa!</Text>
                  <Text style={styles.reubicarSuccessSubtitle}>
                    Nuevo viaje asignado
                  </Text>
                  {reubicarSuccess.tripTime && (
                    <View style={styles.reubicarSuccessDetail}>
                      <Text style={styles.reubicarSuccessTime}>
                        🕒 {reubicarSuccess.tripTime}
                      </Text>
                      {reubicarSuccess.boatName && (
                        <Text style={styles.reubicarSuccessBoat}>
                          ⛵ {reubicarSuccess.boatName}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: 'center', justifyContent: 'center' },

  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 16 },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '20',
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: {
    flex: 1,
    fontFamily: 'Manrope',
    fontSize: 15,
    color: PerlaColors.onSurface,
    paddingVertical: 14,
  },
  searchClear: {
    fontSize: 16,
    color: PerlaColors.onSurfaceVariant,
    padding: 4,
  },

  /* Filters */
  filterRow: {
    marginBottom: 16,
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PerlaColors.surfaceContainerLow,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: PerlaColors.tertiary + '18',
    borderColor: PerlaColors.tertiary + '40',
  },
  filterChipText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: PerlaColors.tertiary,
    fontFamily: 'Manrope-Bold',
  },

  resultsCount: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 12,
  },

  /* Reservation Card */
  resCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '15',
  },
  resHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  resName: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: PerlaColors.onSurface,
    marginBottom: 2,
  },
  resDetail: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  resBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resBadgeText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  resInfoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  resInfo: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  resPin: {
    fontFamily: 'Manrope-Bold',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant + '80',
    letterSpacing: 1,
    marginBottom: 8,
  },

  /* Actions */
  resActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  rejectBtn: {
    backgroundColor: '#EF5350' + '15',
    borderWidth: 1,
    borderColor: '#EF5350' + '30',
  },
  rejectText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
    color: '#EF5350',
  },
  approveBtn: {
    backgroundColor: '#66BB6A',
  },
  approveText: { fontFamily: 'Manrope-Bold', color: '#fff', fontSize: 14 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '40' },
  modalTitle: { fontFamily: 'Newsreader-Bold', fontSize: 26, color: PerlaColors.onSurface, marginBottom: 12 },
  modalMessage: { fontFamily: 'Manrope', fontSize: 15, color: PerlaColors.onSurfaceVariant, marginBottom: 28, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, backgroundColor: PerlaColors.surfaceContainerHighest },
  modalCancelText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurfaceVariant, fontSize: 14 },
  modalConfirmBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, backgroundColor: '#EF5350' },
  modalConfirmText: { fontFamily: 'Manrope-Bold', color: '#fff', fontSize: 14 },

  reubicarBtn: {
    backgroundColor: '#42A5F5' + '15',
    borderWidth: 1,
    borderColor: '#42A5F5' + '30',
    marginTop: 8,
  },
  reubicarText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
    color: '#42A5F5',
  },

  /* Reubicar Modal — Premium Design */
  reubicarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  reubicarSheet: {
    backgroundColor: PerlaColors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '82%',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: PerlaColors.outlineVariant + '30',
  },
  reubicarDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PerlaColors.outlineVariant + '60',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  reubicarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  reubicarTitle: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 24,
    color: PerlaColors.onSurface,
  },
  reubicarHeaderHint: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 4,
  },
  reubicarCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PerlaColors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reubicarCloseX: {
    fontSize: 16,
    color: PerlaColors.onSurfaceVariant,
    fontWeight: 'bold',
  },

  /* Summary card */
  reubicarSummaryCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '25',
    borderLeftWidth: 3,
    borderLeftColor: '#42A5F5',
  },
  reubicarSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reubicarSummaryIcon: {
    fontSize: 22,
  },
  reubicarSummaryName: {
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
    color: PerlaColors.onSurface,
  },
  reubicarSummaryMeta: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 2,
  },
  reubicarSummaryAmount: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 20,
    color: PerlaColors.tertiary,
  },

  /* Section label */
  reubicarSectionLabel: {
    fontFamily: 'Manrope-Bold',
    fontSize: 11,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  /* Loading / Empty states */
  reubicarLoadingText: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 14,
    textAlign: 'center',
  },
  reubicarEmptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  reubicarEmptyTitle: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 20,
    color: PerlaColors.onSurface,
    marginBottom: 8,
  },
  reubicarEmptyText: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Trip cards */
  reubicarTripCard: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: PerlaColors.surfaceContainerLow,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '20',
  },
  reubicarTripCardDisabled: {
    opacity: 0.35,
  },
  reubicarTripCardPressed: {
    backgroundColor: PerlaColors.surfaceContainer,
    borderColor: PerlaColors.tertiary + '50',
  },
  reubicarTripAccent: {
    width: 4,
    backgroundColor: PerlaColors.tertiary,
  },
  reubicarTripBody: {
    flex: 1,
    padding: 14,
  },
  reubicarTripTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  reubicarTripTime: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 20,
    color: PerlaColors.onSurface,
  },
  reubicarTripStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reubicarTripStatusText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  reubicarTripSpotsText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
    color: PerlaColors.tertiary,
  },
  reubicarTripBoat: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 8,
  },

  /* Capacity bar */
  reubicarCapBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: PerlaColors.surfaceContainerHighest,
    overflow: 'hidden',
    marginBottom: 4,
  },
  reubicarCapBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  reubicarCapLabel: {
    fontFamily: 'Manrope',
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant + '80',
  },
  reubicarTripWarn: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    color: '#FFA726',
    marginTop: 6,
  },

  /* Cancel button */
  reubicarCancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PerlaColors.surfaceContainerHighest,
    alignItems: 'center',
    marginTop: 8,
  },
  reubicarCancelText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },

  /* Saving overlay */
  reubicarSavingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reubicarSavingContent: {
    alignItems: 'center',
    gap: 16,
  },
  reubicarSavingText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: PerlaColors.onSurface,
  },

  /* Success overlay */
  reubicarSuccessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PerlaColors.background + 'F5',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reubicarSuccessContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  reubicarSuccessCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981' + '20',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  reubicarSuccessCheck: {
    fontSize: 32,
    color: '#10B981',
    fontWeight: 'bold',
  },
  reubicarSuccessTitle: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 24,
    color: PerlaColors.onSurface,
    marginBottom: 6,
  },
  reubicarSuccessSubtitle: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 20,
  },
  reubicarSuccessDetail: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PerlaColors.tertiary + '30',
    gap: 4,
  },
  reubicarSuccessTime: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 22,
    color: PerlaColors.tertiary,
  },
  reubicarSuccessBoat: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
});
