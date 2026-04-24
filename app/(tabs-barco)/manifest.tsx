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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { obtenerViajeActual } from '@/src/services/viajes.service';
import {
  obtenerReservacionesPorViaje,
  verificarPIN,
  marcarAbordado,
} from '@/src/services/reservaciones.service';
import { supabase } from '@/src/lib/supabase';
import type { ReservacionConDetalles } from '@/src/lib/database.types';

/* ────────────────────────────────────────────────────────────
   Barco – Manifiesto de Pasajeros
   Lists all passengers, verify by PIN, mark as boarded
   ──────────────────────────────────────────────────────────── */

export default function BarcoManifestScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [reservaciones, setReservaciones] = useState<ReservacionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [viajeId, setViajeId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const viaje = await obtenerViajeActual(user.id);
      if (viaje) {
        setViajeId(viaje.id_viaje);
        const data = await obtenerReservacionesPorViaje(viaje.id_viaje);
        setReservaciones(data);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { 
    fetchData(); 

    // Subscribe to real-time updates for reservations of this trip
    const channel = supabase
      .channel('manifest-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservacion' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  /* ── PIN Verification ──────────────────────────── */
  const handleVerifyPIN = async () => {
    if (pinInput.length < 4) return;
    setVerifying(true);
    try {
      const res = await verificarPIN(pinInput.trim());
      if (!res) {
        Alert.alert('PIN No Válido', 'No se encontró una reservación con ese PIN.');
        return;
      }
      if (res.estado_pase === 'Abordado') {
        Alert.alert('Ya Abordó', `${res.cliente?.nombre_completo} ya fue registrado.`);
        return;
      }
      if (res.estado_pase !== 'Aprobado') {
        Alert.alert('Pase No Válido', `Estado actual: ${res.estado_pase?.replace('_', ' ')}`);
        return;
      }
      // Confirm boarding
      Alert.alert(
        'Confirmar Abordaje',
        `${res.cliente?.nombre_completo}\n${res.cantidad_personas} persona(s)\n` +
        (res.detalles && res.detalles.length > 0 
          ? res.detalles.map(d => `• ${d.cantidad}x ${d.paquete?.descripcion}`).join('\n')
          : `• ${res.paquete?.descripcion ?? '—'}`),
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: '🏴‍☠️ ¡A Bordo!',
            onPress: async () => {
              try {
                await marcarAbordado(res.id_reservacion);
                setPinInput('');
                await fetchData();
                Alert.alert('✅ Abordaje Exitoso', `${res.cliente?.nombre_completo} ya está a bordo.`);
              } catch (err: any) {
                Alert.alert('Error', err.message);
              }
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Error', 'PIN no encontrado en el sistema.');
    } finally {
      setVerifying(false);
    }
  };

  /* ── Direct Board from List ──────────────────── */
  const handleBoardFromList = async (r: ReservacionConDetalles) => {
    if (r.estado_pase !== 'Aprobado') return;
    setActionLoading(r.id_reservacion);
    try {
      await marcarAbordado(r.id_reservacion);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPersonas = reservaciones.reduce((s, r) => s + r.cantidad_personas, 0);
  const abordados = reservaciones.filter(r => r.estado_pase === 'Abordado');
  const personasABordo = abordados.reduce((s, r) => s + r.cantidad_personas, 0);
  const aprobados = reservaciones.filter(r => r.estado_pase === 'Aprobado');

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
      <Text style={styles.title}>Manifiesto</Text>

      {/* ── Counter ──────────────────────────────── */}
      <View style={styles.counterRow}>
        <View style={styles.counterCard}>
          <Text style={[styles.counterValue, { color: '#66BB6A' }]}>{personasABordo}</Text>
          <Text style={styles.counterLabel}>A Bordo</Text>
        </View>
        <View style={styles.counterDivider} />
        <View style={styles.counterCard}>
          <Text style={[styles.counterValue, { color: '#FFA726' }]}>{aprobados.length}</Text>
          <Text style={styles.counterLabel}>Por Abordar</Text>
        </View>
        <View style={styles.counterDivider} />
        <View style={styles.counterCard}>
          <Text style={styles.counterValue}>{totalPersonas}</Text>
          <Text style={styles.counterLabel}>Total</Text>
        </View>
      </View>

      {/* ── PIN Search ───────────────────────────── */}
      <View style={styles.pinSearchContainer}>
        <TextInput
          style={styles.pinSearchInput}
          value={pinInput}
          onChangeText={setPinInput}
          placeholder="Ingresar PIN de abordaje"
          placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
          autoCapitalize="characters"
          maxLength={8}
        />
        <Pressable
          style={[styles.pinSearchBtn, verifying && { opacity: 0.6 }]}
          onPress={handleVerifyPIN}
          disabled={verifying || pinInput.length < 4}
        >
          {verifying ? (
            <ActivityIndicator size="small" color={PerlaColors.onTertiary} />
          ) : (
            <Text style={styles.pinSearchBtnText}>Verificar</Text>
          )}
        </Pressable>
      </View>

      {/* ── Passenger List ──────────────────────── */}
      {!viajeId && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Sin viaje asignado</Text>
        </View>
      )}

      {/* Pending boarding first */}
      {aprobados.length > 0 && (
        <Text style={styles.sectionTitle}>⏳ Por Abordar ({aprobados.length})</Text>
      )}
      {aprobados.map(r => (
        <PassengerCard
          key={r.id_reservacion}
          reservacion={r}
          onBoard={handleBoardFromList}
          loading={actionLoading === r.id_reservacion}
        />
      ))}

      {/* Already boarded */}
      {abordados.length > 0 && (
        <Text style={styles.sectionTitle}>🏴‍☠️ A Bordo ({abordados.length})</Text>
      )}
      {abordados.map(r => (
        <PassengerCard
          key={r.id_reservacion}
          reservacion={r}
          onBoard={handleBoardFromList}
          loading={false}
        />
      ))}
    </ScrollView>
  );
}

function PassengerCard({ reservacion: r, onBoard, loading }: {
  reservacion: ReservacionConDetalles;
  onBoard: (r: ReservacionConDetalles) => void;
  loading: boolean;
}) {
  const isApproved = r.estado_pase === 'Aprobado';
  const isBoarded = r.estado_pase === 'Abordado';

  return (
    <View style={[styles.passengerCard, isBoarded && styles.passengerCardBoarded]}>
      <View style={styles.passengerInfo}>
        <Text style={styles.passengerName}>
          {isBoarded ? '✅ ' : ''}{r.cliente?.nombre_completo ?? 'Cliente'}
        </Text>
        <Text style={styles.passengerDetail}>
          👥 {r.cantidad_personas} · PIN: {r.pin_verificacion ?? '—'}
        </Text>
        <Text style={[styles.passengerDetail, { color: PerlaColors.tertiary }]}>
          {r.detalles && r.detalles.length > 0 
            ? r.detalles.map(d => `${d.cantidad}x ${d.paquete?.descripcion}`).join(', ')
            : r.paquete?.descripcion ?? '—'}
        </Text>

      </View>
      {isApproved && (
        <Pressable
          style={[styles.boardBtn, loading && { opacity: 0.6 }]}
          onPress={() => onBoard(r)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.boardBtnText}>Abordar</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 20 },

  counterRow: {
    flexDirection: 'row', backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center',
  },
  counterCard: { flex: 1, alignItems: 'center' },
  counterValue: { fontFamily: 'Newsreader-Bold', fontSize: 28, color: PerlaColors.onSurface, marginBottom: 4 },
  counterLabel: { fontFamily: 'Manrope', fontSize: 10, color: PerlaColors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.8 },
  counterDivider: { width: 1, height: 36, backgroundColor: PerlaColors.outlineVariant + '30' },

  pinSearchContainer: {
    flexDirection: 'row', gap: 10, marginBottom: 20,
  },
  pinSearchInput: {
    flex: 1, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onSurface, letterSpacing: 2,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '25',
  },
  pinSearchBtn: {
    backgroundColor: PerlaColors.tertiary, borderRadius: 12,
    paddingHorizontal: 20, justifyContent: 'center',
  },
  pinSearchBtnText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.onTertiary },

  sectionTitle: {
    fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.onSurfaceVariant,
    marginBottom: 10, marginTop: 8,
  },

  passengerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '15',
  },
  passengerCardBoarded: {
    borderColor: '#66BB6A30', backgroundColor: '#66BB6A08',
  },
  passengerInfo: { flex: 1 },
  passengerName: { fontFamily: 'Manrope-Bold', fontSize: 15, color: PerlaColors.onSurface, marginBottom: 4 },
  passengerDetail: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },

  boardBtn: {
    backgroundColor: '#26A69A', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  boardBtnText: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#fff' },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontFamily: 'Newsreader', fontSize: 20, color: PerlaColors.onSurface },
});
