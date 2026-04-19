import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { obtenerViajeActual, actualizarEstadoViaje } from '@/src/services/viajes.service';
import type { ViajeConDetalles } from '@/src/lib/database.types';

/* ────────────────────────────────────────────────────────────
   Barco – Viaje Actual
   Shows current trip state and action buttons for state transitions
   ──────────────────────────────────────────────────────────── */

const ESTADO_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  Programado:    { color: '#42A5F5', label: 'Esperando Salida', icon: '⏳' },
  Retrasado:     { color: '#FFA726', label: 'Retrasado',        icon: '⚠️' },
  Abordando:     { color: '#AB47BC', label: 'Abordando',        icon: '🚶' },
  En_Navegacion: { color: '#26A69A', label: 'En Navegación',    icon: '⛵' },
  Finalizado:    { color: '#66BB6A', label: 'Finalizado',       icon: '✅' },
  Cancelado:     { color: '#EF5350', label: 'Cancelado',        icon: '❌' },
};

export default function BarcoViajeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [viaje, setViaje] = useState<ViajeConDetalles | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await obtenerViajeActual(user.id);
      setViaje(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (campo: 'hora_inicio_abordaje' | 'hora_salida_real' | 'hora_llegada_real') => {
    if (!viaje) return;
    setActionLoading(true);
    try {
      await actualizarEstadoViaje(viaje.id_viaje, campo);
      await fetchData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  if (!viaje) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={PerlaColors.tertiary} />}
      >
        <Text style={styles.title}>Viaje Actual</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⛵</Text>
          <Text style={styles.emptyTitle}>Sin viaje asignado</Text>
          <Text style={styles.emptyText}>No tienes viajes programados para hoy{'\n'}o tu encargado aún no te asignó.</Text>
        </View>
      </ScrollView>
    );
  }

  const estado = ESTADO_CONFIG[viaje.estado_viaje ?? 'Programado'];
  const barcoNombre = (viaje as any)?.embarcacion?.nombre ?? 'Embarcación';
  const capacidad = (viaje as any)?.embarcacion?.capacidad_maxima ?? 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={PerlaColors.tertiary} />}
    >
      <Text style={styles.title}>Viaje Actual</Text>

      {/* ── Estado Card ──────────────────────────── */}
      <View style={[styles.estadoCard, { borderColor: estado.color + '40' }]}>
        <Text style={styles.estadoIcon}>{estado.icon}</Text>
        <Text style={[styles.estadoLabel, { color: estado.color }]}>{estado.label}</Text>
        <Text style={styles.estadoBarco}>{barcoNombre} · Cap. {capacidad}</Text>
      </View>

      {/* ── Trip Details ─────────────────────────── */}
      <View style={styles.detailsCard}>
        <DetailRow icon="📅" label="Fecha" value={viaje.fecha_programada} />
        <DetailRow icon="🕐" label="Salida Programada" value={viaje.hora_salida_programada.slice(0, 5)} />
        {viaje.hora_inicio_abordaje && (
          <DetailRow icon="🚶" label="Inicio Abordaje" value={viaje.hora_inicio_abordaje.slice(11, 16)} />
        )}
        {viaje.hora_salida_real && (
          <DetailRow icon="🚀" label="Salida Real" value={viaje.hora_salida_real.slice(11, 16)} />
        )}
        {viaje.hora_llegada_real && (
          <DetailRow icon="🏁" label="Llegada" value={viaje.hora_llegada_real.slice(11, 16)} />
        )}
        {(viaje.retraso_minutos ?? 0) > 0 && (
          <DetailRow icon="⚠️" label="Retraso" value={`${viaje.retraso_minutos} min`} warning />
        )}
      </View>

      {/* ── Action Buttons ──────────────────────── */}
      {viaje.estado_viaje === 'Programado' && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: '#AB47BC' }, actionLoading && { opacity: 0.6 }]}
          onPress={() => handleAction('hora_inicio_abordaje')}
          disabled={actionLoading}
        >
          {actionLoading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.actionBtnText}>🚶 Iniciar Abordaje</Text>
          )}
        </Pressable>
      )}

      {viaje.estado_viaje === 'Abordando' && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: '#26A69A' }, actionLoading && { opacity: 0.6 }]}
          onPress={() => handleAction('hora_salida_real')}
          disabled={actionLoading}
        >
          {actionLoading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.actionBtnText}>⛵ Confirmar Zarpe</Text>
          )}
        </Pressable>
      )}

      {viaje.estado_viaje === 'En_Navegacion' && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: '#66BB6A' }, actionLoading && { opacity: 0.6 }]}
          onPress={() => handleAction('hora_llegada_real')}
          disabled={actionLoading}
        >
          {actionLoading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.actionBtnText}>🏁 Confirmar Llegada</Text>
          )}
        </Pressable>
      )}

      {viaje.estado_viaje === 'Finalizado' && (
        <View style={styles.finishedBanner}>
          <Text style={styles.finishedText}>✅ Viaje Finalizado</Text>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ icon, label, value, warning }: {
  icon: string; label: string; value: string; warning?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, warning && { color: '#FFA726' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 20 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Newsreader', fontSize: 24, color: PerlaColors.onSurface, marginBottom: 8 },
  emptyText: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, textAlign: 'center', lineHeight: 22 },

  estadoCard: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20, borderWidth: 1.5,
  },
  estadoIcon: { fontSize: 48, marginBottom: 12 },
  estadoLabel: { fontFamily: 'Newsreader-Bold', fontSize: 24, marginBottom: 6 },
  estadoBarco: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant },

  detailsCard: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 18, marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: PerlaColors.outlineVariant + '15',
  },
  detailIcon: { fontSize: 16, marginRight: 12 },
  detailLabel: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, flex: 1 },
  detailValue: { fontFamily: 'Manrope-Bold', fontSize: 15, color: PerlaColors.onSurface },

  actionBtn: {
    borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  actionBtnText: { fontFamily: 'Manrope-Bold', fontSize: 17, color: '#fff' },

  finishedBanner: {
    backgroundColor: '#66BB6A22', borderRadius: 14, paddingVertical: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#66BB6A40',
  },
  finishedText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: '#66BB6A' },
});
