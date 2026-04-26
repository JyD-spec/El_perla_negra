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
import { 
  obtenerViajeActual, 
  actualizarEstadoViaje, 
  actualizarRegresoEstimado,
  enviarAlertaPasajeros,
  notificarRezagados,
} from '@/src/services/viajes.service';
import { obtenerReservacionesPorViaje } from '@/src/services/reservaciones.service';
import type { ViajeConDetalles } from '@/src/lib/database.types';

import { format12h, format12hISO } from '@/src/lib/time';


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
  const [alertLoading, setAlertLoading] = useState(false);

  // ── Info de Pasajeros ──
  const [totalPasajeros, setTotalPasajeros] = useState<number>(0);

  // ── Zarpe State ──
  const [horasRegresoText, setHorasRegresoText] = useState<string>('1.5');

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await obtenerViajeActual(user.id);
      setViaje(data);

      if (data) {
        // Fetch passengers to show total
        const res = await obtenerReservacionesPorViaje(data.id_viaje);
        const approved = res.filter(r => r.estado_pase === 'Aprobado' || r.estado_pase === 'Abordado');
        const count = approved.reduce((acc, curr) => acc + (curr.cantidad_personas || 0), 0);
        setTotalPasajeros(count);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (campo: 'hora_inicio_abordaje' | 'hora_salida_real' | 'hora_llegada_real') => {
    if (!viaje) return;
    setActionLoading(true);
    try {
      await actualizarEstadoViaje(viaje.id_viaje, campo);
      
      // Si estamos iniciando abordaje, mandar aviso automático
      if (campo === 'hora_inicio_abordaje') {
        try {
          await enviarAlertaPasajeros(viaje.id_viaje, '¡El abordaje ha comenzado! Por favor dirígete a la embarcación.');
        } catch (e) { console.error('Error enviando alerta:', e); }
      }

      await fetchData();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Error al actualizar el viaje');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAvisoSalida = async () => {
    if (!viaje) return;
    setAlertLoading(true);
    try {
      await enviarAlertaPasajeros(viaje.id_viaje, '⚠️ El barco zarpará en 5 minutos. Por favor aborda de inmediato.');
      Alert.alert('Aviso Enviado', 'Se ha notificado a todos los pasajeros.');
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo enviar el aviso: ' + err.message);
    } finally {
      setAlertLoading(false);
    }
  };

  const handleZarpar = async () => {
    if (!viaje) return;
    const horas = parseFloat(horasRegresoText);
    if (isNaN(horas) || horas <= 0) {
      Alert.alert('Valor inválido', 'Por favor ingresa un número de horas válido.');
      return;
    }

    setActionLoading(true);
    try {
      await actualizarRegresoEstimado(viaje.id_viaje, horas);
      
      // Mandar aviso de zarpe a pasajeros a bordo
      try {
        await enviarAlertaPasajeros(viaje.id_viaje, `⛵ ¡El barco ha zarpado! Regresaremos en aproximadamente ${horas} horas.`);
      } catch (e) { console.error('Error enviando alerta de zarpe:', e); }

      // Esperar a que el trigger DB (fn_vencer_pases_no_show) marque
      // a los no-abordados como 'Vencido', luego notificar rezagados
      const viajeId = viaje.id_viaje;
      setTimeout(async () => {
        try {
          const result = await notificarRezagados(viajeId);
          console.log('Rezagados notificados:', result);
        } catch (e) { console.error('Error notificando rezagados:', e); }
      }, 1500);

      await fetchData();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Error al confirmar zarpe');
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
        <DetailRow icon="🕐" label="Salida Programada" value={format12h(viaje.hora_salida_programada)} />
        {viaje.hora_inicio_abordaje && (
          <DetailRow icon="🚶" label="Inicio Abordaje" value={format12h(viaje.hora_inicio_abordaje)} />
        )}
        {viaje.hora_salida_real && (
          <DetailRow icon="🚀" label="Salida Real" value={format12h(viaje.hora_salida_real)} />
        )}
        {viaje.tiempo_estimado_regreso && viaje.estado_viaje !== 'Finalizado' && (
          <DetailRow icon="⏱️" label="Regreso Estimado" value={format12hISO(viaje.tiempo_estimado_regreso)} />
        )}
        {viaje.hora_llegada_real && (
          <DetailRow icon="🏁" label="Llegada" value={format12h(viaje.hora_llegada_real)} />
        )}
        {(viaje.retraso_minutos ?? 0) > 0 && (
          <DetailRow icon="⚠️" label="Retraso" value={`${viaje.retraso_minutos} min`} warning />
        )}
      </View>


      {/* ── Action Buttons ──────────────────────── */}
      {(viaje.estado_viaje === 'Programado' || viaje.estado_viaje === 'Retrasado') && (
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
        <View style={styles.pinSection}>
          <Text style={styles.pinSectionTitle}>Control de Abordaje</Text>
          <Text style={styles.zarpeDesc}>Verifica a los pasajeros al ingresar a la embarcación.</Text>
          
          <View style={styles.resContainer}>
            <Text style={styles.resPersonas}>Total de Pasajeros Registrados:</Text>
            <Text style={styles.resCliente}>{totalPasajeros} pasajeros</Text>
          </View>

          <Pressable
            style={[styles.alertBtn, alertLoading && { opacity: 0.6 }]}
            onPress={handleAvisoSalida}
            disabled={alertLoading}
          >
            {alertLoading ? <ActivityIndicator color={PerlaColors.onSurface} /> : (
              <Text style={styles.alertBtnText}>📢 Mandar Aviso de Salida (5 min)</Text>
            )}
          </Pressable>

          <View style={styles.zarpeSection}>
            <Text style={styles.zarpeTitle}>Confirmar Zarpe</Text>
            <Text style={styles.zarpeDesc}>Ingresa el tiempo estimado de regreso (horas):</Text>
            
            <TextInput
              style={[styles.pinInput, { marginBottom: 16 }]}
              placeholder="Ej: 1.5"
              placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
              value={horasRegresoText}
              onChangeText={setHorasRegresoText}
              keyboardType="numeric"
            />

            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#26A69A' }, actionLoading && { opacity: 0.6 }]}
              onPress={handleZarpar}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.actionBtnText}>⛵ Zarpar {horasRegresoText ? `(Regreso en ${horasRegresoText} hr)` : ''}</Text>
              )}
            </Pressable>
          </View>
        </View>
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

  pinSection: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '30'
  },
  pinSectionTitle: { fontFamily: 'Newsreader', fontSize: 22, color: PerlaColors.onSurface, marginBottom: 12 },
  pinInputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pinInput: {
    flex: 1, backgroundColor: PerlaColors.surfaceContainer, borderRadius: 12,
    paddingHorizontal: 16, color: PerlaColors.onSurface, fontFamily: 'Manrope-Bold', fontSize: 16,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '40'
  },
  verificarBtn: {
    backgroundColor: PerlaColors.tertiary, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center'
  },
  verificarBtnText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onTertiary, fontSize: 15 },
  resContainer: {
    backgroundColor: PerlaColors.surfaceContainerHigh, borderRadius: 12, padding: 16,
    borderLeftWidth: 4, borderLeftColor: PerlaColors.tertiary
  },
  resCliente: { fontFamily: 'Manrope-Bold', fontSize: 22, color: PerlaColors.onSurface, marginTop: 4 },
  resPersonas: { fontFamily: 'Manrope', fontSize: 15, color: PerlaColors.onSurfaceVariant },
  
  alertBtn: {
    backgroundColor: PerlaColors.surfaceContainerHigh,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: PerlaColors.tertiary + '40',
  },
  alertBtnText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
    color: PerlaColors.onSurface,
  },

  finishedBanner: {
    backgroundColor: '#66BB6A22', borderRadius: 14, paddingVertical: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#66BB6A40',
  },
  finishedText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: '#66BB6A' },

  zarpeSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: PerlaColors.outlineVariant + '30',
    paddingTop: 16,
  },
  zarpeTitle: { fontFamily: 'Newsreader-Bold', fontSize: 18, color: PerlaColors.onSurface, marginBottom: 4 },
  zarpeDesc: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, marginBottom: 12 },
});
