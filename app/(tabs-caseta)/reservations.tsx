import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PerlaColors } from '@/constants/theme';
import { globalEvents } from '@/src/lib/events';
import {
  obtenerReservacionesDelDia,
  aprobarPase,
  rechazarPase,
  verificarPIN,
} from '@/src/services/reservaciones.service';
import type { ReservacionConDetalles, EstadoPase } from '@/src/lib/database.types';
import { supabase } from '@/src/lib/supabase';
import { format12h } from '@/src/lib/time';

/* ────────────────────────────────────────────────────────────
   Caseta – Reservaciones
   Aprobar/rechazar, buscar por PIN, filtrar por estado
   ──────────────────────────────────────────────────────────── */

type Filtro = 'Todos' | 'Pendiente_Caseta' | 'Aprobado' | 'Vencido' | 'Abordado';

const FILTROS: { key: Filtro; label: string; icon: string }[] = [
  { key: 'Todos',            label: 'Todos',      icon: '📋' },
  { key: 'Pendiente_Caseta', label: 'Pendientes', icon: '⏳' },
  { key: 'Aprobado',         label: 'Aprobados',  icon: '✅' },
  { key: 'Vencido',          label: 'Vencidos',    icon: '⚠️' },
  { key: 'Abordado',         label: 'Abordados',   icon: '🏴‍☠️' },
];

const ESTADO_STYLE: Record<string, { bg: string; text: string }> = {
  Pendiente_Caseta: { bg: '#FFA726' + '22', text: '#FFA726' },
  Aprobado:         { bg: '#66BB6A' + '22', text: '#66BB6A' },
  Rechazado:        { bg: '#EF5350' + '22', text: '#EF5350' },
  Abordado:         { bg: PerlaColors.tertiary + '22', text: PerlaColors.tertiary },
  Vencido:          { bg: '#78909C' + '22', text: '#78909C' },
};

export default function CasetaReservationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [reservaciones, setReservaciones] = useState<ReservacionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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
  const filtered = reservaciones.filter(r => {
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

  const handleRechazar = async (id: number) => {
    const confirmRechazo = () => {
      Alert.alert('Rechazar Pase', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(id);
            try {
              await rechazarPase(id);
              await fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que deseas rechazar este pase?')) {
        setActionLoading(id);
        try {
          await rechazarPase(id);
          await fetchData();
        } catch (err: any) {
          alert('Error: ' + err.message);
        } finally {
          setActionLoading(null);
        }
      }
    } else {
      confirmRechazo();
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
            ? reservaciones.length
            : reservaciones.filter(r => r.estado_pase === f.key).length;
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
                  📱 {r.cliente?.telefono ?? '—'} · {r.cantidad_personas} persona{r.cantidad_personas !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={[styles.resBadge, { backgroundColor: estado.bg }]}>
                <Text style={[styles.resBadgeText, { color: estado.text }]}>
                  {(r.estado_pase ?? 'Pendiente').replace('_', ' ')}
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
              <Pressable style={[styles.actionBtn, styles.reubicarBtn]}>
                <Text style={styles.reubicarText}>🔄 Reubicar en otro viaje</Text>
              </Pressable>
            )}
          </View>
        );
      })}
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
  approveText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
    color: '#fff',
  },
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
});
