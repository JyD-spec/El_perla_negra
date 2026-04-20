import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { PerlaColors } from '@/constants/theme';
import { obtenerViajesDelDia, programarViaje, obtenerCupoViaje } from '@/src/services/viajes.service';
import { supabase } from '@/src/lib/supabase';
import type { Viaje, Embarcacion } from '@/src/lib/database.types';
import { globalEvents } from '@/src/lib/events';

/* ────────────────────────────────────────────────────────────
   Caseta – Gestión de Viajes
   Programar, ver estado, asignar barco/encargado
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  Programado:     { bg: '#42A5F5' + '22', text: '#42A5F5' },
  Retrasado:      { bg: '#FFA726' + '22', text: '#FFA726' },
  Abordando:      { bg: '#AB47BC' + '22', text: '#AB47BC' },
  En_Navegacion:  { bg: '#26A69A' + '22', text: '#26A69A' },
  Finalizado:     { bg: '#66BB6A' + '22', text: '#66BB6A' },
  Cancelado:      { bg: '#EF5350' + '22', text: '#EF5350' },
};

export default function CasetaTripsScreen() {
  const insets = useSafeAreaInsets();

  const [viajes, setViajes] = useState<ViajeConEmb[]>([]);
  const [cupos, setCupos] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingViaje, setEditingViaje] = useState<ViajeConEmb | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerViajesDelDia();
      setViajes(data as ViajeConEmb[]);

      // Fetch cupos in parallel
      const cupoResults = await Promise.all(
        data.map(v => obtenerCupoViaje(v.id_viaje).then(c => ({ id: v.id_viaje, cupo: c })))
      );
      const cupoMap: Record<number, number> = {};
      cupoResults.forEach(r => { cupoMap[r.id] = r.cupo; });
      setCupos(cupoMap);
    } catch (err) {
      console.error('Trips error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
    
    // FAB event listener
    const unsubscribe = globalEvents.on('fab-press-trips', () => {
      setEditingViaje(null);
      setShowModal(true);
    });
    
    return () => unsubscribe();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PerlaColors.tertiary} />
        }
      >
        <Text style={styles.title}>Viajes del Día</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        {viajes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚢</Text>
            <Text style={styles.emptyTitle}>Sin viajes programados</Text>
            <Text style={styles.emptyText}>Presiona el botón ➕ para programar un viaje</Text>
          </View>
        )}

        {viajes.map(v => {
          const ocupados = cupos[v.id_viaje] ?? 0;
          const capacidad = v.embarcacion.capacidad_maxima;
          const disponible = capacidad - ocupados;
          const pct = capacidad > 0 ? (ocupados / capacidad) : 0;
          const estadoStyle = ESTADO_COLORS[v.estado_viaje ?? 'Programado'] ?? ESTADO_COLORS.Programado;

          return (
            <Pressable 
              key={v.id_viaje} 
              style={({ pressed }) => [styles.viajeCard, pressed && { opacity: 0.8 }]}
              onPress={() => {
                setEditingViaje(v);
                setShowModal(true);
              }}
            >
              {/* Header */}
              <View style={styles.viajeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viajeHora}>
                    🕐 {v.hora_salida_programada.slice(0, 5)}
                  </Text>
                  <Text style={styles.viajeBarco}>
                    {v.embarcacion.nombre}
                  </Text>
                </View>
                <View style={[styles.estadoBadge, { backgroundColor: estadoStyle.bg }]}>
                  <Text style={[styles.estadoText, { color: estadoStyle.text }]}>
                    {(v.estado_viaje ?? 'Programado').replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Capacity Bar */}
              <View style={styles.capacitySection}>
                <View style={styles.capacityHeader}>
                  <Text style={styles.capacityLabel}>
                    Cupo: {ocupados}/{capacidad}
                  </Text>
                  <Text style={[
                    styles.capacityAvail,
                    disponible <= 0 && { color: '#EF5350' },
                  ]}>
                    {disponible > 0 ? `${disponible} disponibles` : 'LLENO'}
                  </Text>
                </View>
                <View style={styles.capacityBarBg}>
                  <View
                    style={[
                      styles.capacityBarFill,
                      {
                        width: `${Math.min(pct * 100, 100)}%`,
                        backgroundColor: pct >= 1 ? '#EF5350' : pct >= 0.8 ? '#FFA726' : '#66BB6A',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Retraso / Clima */}
              {(v.retraso_minutos ?? 0) > 0 && (
                <Text style={styles.retrasoText}>
                  ⚠️ Retraso: {v.retraso_minutos} min
                  {v.motivo_alteracion ? ` — ${v.motivo_alteracion}` : ''}
                </Text>
              )}

              {v.clima_estado && (
                <Text style={styles.climaText}>
                  🌊 {v.clima_estado} · Viento: {v.clima_viento_kmh ?? '—'} km/h
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Trip Modal (Create/Edit) ────────────────────────── */}
      <TripModal
        visible={showModal}
        viaje={editingViaje}
        onClose={() => setShowModal(false)}
        onSaved={() => {
          setShowModal(false);
          fetchData();
        }}
      />
    </View>
  );
}

/* ── Trip Modal (Create/Edit) ────────────────────────────────── */

function TripModal({ visible, viaje, onClose, onSaved }: {
  visible: boolean; viaje: ViajeConEmb | null; onClose: () => void; onSaved: () => void;
}) {
  const [date, setDate] = useState(new Date());
  const [estado, setEstado] = useState<string>('Programado');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [embarcaciones, setEmbarcaciones] = useState<Embarcacion[]>([]);
  const [selectedBarco, setSelectedBarco] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (viaje) {
        // Modo Edición
        const vDate = new Date(`${viaje.fecha_programada}T${viaje.hora_salida_programada}`);
        setDate(vDate);
        setEstado(viaje.estado_viaje || 'Programado');
        setSelectedBarco(viaje.id_embarcacion);
      } else {
        // Modo Creación: ajustar a la hora actual redondeada
        const now = new Date();
        now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
        now.setSeconds(0);
        setDate(now);
        setEstado('Programado');
        setSelectedBarco(null);
      }

      supabase.from('embarcacion').select('*').eq('estado_operativo', 'Activo')
        .then(({ data }) => {
          if (data) {
            setEmbarcaciones(data as Embarcacion[]);
            if (!viaje && data.length > 0) setSelectedBarco(data[0].id_embarcacion);
          }
        });
    }
  }, [visible, viaje]);

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDate(newDate);
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDate(newDate);
    }
  };

  const handleSave = async () => {
    if (!selectedBarco) return;
    
    // Validar pasado solo en creación
    if (!viaje && date.getTime() < new Date().getTime() - 60000) {
      return Alert.alert('Fecha inválida', 'No puedes programar viajes en el pasado.');
    }

    setSaving(true);
    try {
      const dbFecha = date.toISOString().split('T')[0];
      const dbHora = date.toTimeString().split(' ')[0];

      if (viaje) {
        // Update
        const { error } = await supabase
          .from('viaje')
          .update({
            fecha_programada: dbFecha,
            hora_salida_programada: dbHora,
            id_embarcacion: selectedBarco,
            estado_viaje: estado as any,
          })
          .eq('id_viaje', viaje.id_viaje);
        if (error) throw error;
      } else {
        // Create
        await programarViaje({
          fecha_programada: dbFecha,
          hora_salida_programada: dbHora,
          id_embarcacion: selectedBarco,
        });
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDisplayTime = (d: Date) => {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDisplayDate = (d: Date) => {
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const ESTADOS_DISPONIBLES = Object.keys(ESTADO_COLORS);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>
            {viaje ? 'Gestionar Viaje' : 'Programar Viaje'}
          </Text>

          <Text style={modalStyles.label}>FECHA DEL VIAJE</Text>
          <Pressable style={modalStyles.pickerBtn} onPress={() => setShowDatePicker(true)}>
            <Text style={modalStyles.pickerBtnText}>📅 {formatDisplayDate(date)}</Text>
          </Pressable>

          <Text style={modalStyles.label}>HORA DE SALIDA</Text>
          <Pressable style={modalStyles.pickerBtn} onPress={() => setShowTimePicker(true)}>
            <Text style={modalStyles.pickerBtnText}>🕐 {formatDisplayTime(date)}</Text>
          </Pressable>

          {viaje && (
            <>
              <Text style={modalStyles.label}>ESTADO DEL VIAJE</Text>
              <View style={modalStyles.statusGrid}>
                {ESTADOS_DISPONIBLES.map(st => {
                  const stStyle = ESTADO_COLORS[st];
                  const isSelected = estado === st;
                  return (
                    <Pressable
                      key={st}
                      style={[
                        modalStyles.statusBadge,
                        { borderColor: stStyle.text + '40' },
                        isSelected && { backgroundColor: stStyle.text, borderColor: stStyle.text }
                      ]}
                      onPress={() => setEstado(st)}
                    >
                      <Text style={[
                        modalStyles.statusBadgeText,
                        { color: isSelected ? '#fff' : stStyle.text }
                      ]}>
                        {st.replace('_', ' ')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={modalStyles.label}>EMBARCACIÓN</Text>
          <View style={modalStyles.barcoList}>
            {embarcaciones.map(e => (
              <Pressable
                key={e.id_embarcacion}
                style={[
                  modalStyles.barcoBtn,
                  selectedBarco === e.id_embarcacion && modalStyles.barcoBtnActive,
                ]}
                onPress={() => setSelectedBarco(e.id_embarcacion)}
              >
                <Text style={[
                  modalStyles.barcoBtnText,
                  selectedBarco === e.id_embarcacion && modalStyles.barcoBtnTextActive,
                ]}>
                  {e.nombre} ({e.capacidad_maxima})
                </Text>
              </Pressable>
            ))}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={onDateChange}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={date}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onTimeChange}
            />
          )}

          <View style={modalStyles.actions}>
            <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={PerlaColors.onTertiary} size="small" />
              ) : (
                <Text style={modalStyles.saveText}>
                  {viaje ? 'Guardar Cambios' : 'Crear Viaje'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: 'center', justifyContent: 'center' },

  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 4 },
  subtitle: {
    fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant,
    marginBottom: 24, textTransform: 'capitalize',
  },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Newsreader', fontSize: 24, color: PerlaColors.onSurface, marginBottom: 8 },
  emptyText: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, textAlign: 'center' },

  /* Viaje Card */
  viajeCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '15',
  },
  viajeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  viajeHora: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 22,
    color: PerlaColors.onSurface,
    marginBottom: 2,
  },
  viajeBarco: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },
  estadoBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  estadoText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  /* Capacity */
  capacitySection: { marginBottom: 8 },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  capacityLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  capacityAvail: {
    fontFamily: 'Manrope-Bold',
    fontSize: 12,
    color: '#66BB6A',
  },
  capacityBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: PerlaColors.surfaceContainer,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  retrasoText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: '#FFA726',
    marginTop: 8,
  },
  climaText: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 4,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'Newsreader',
    fontSize: 24,
    color: PerlaColors.onSurface,
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 11,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: PerlaColors.surfaceContainer,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Manrope',
    fontSize: 16,
    color: PerlaColors.onSurface,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '30',
  },
  pickerBtn: {
    backgroundColor: PerlaColors.surfaceContainer,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '30',
    marginBottom: 4,
  },
  pickerBtnText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: PerlaColors.onSurface,
  },
  barcoList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  barcoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: PerlaColors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  barcoBtnActive: {
    borderColor: PerlaColors.tertiary + '60',
    backgroundColor: PerlaColors.tertiary + '15',
  },
  barcoBtnText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  barcoBtnTextActive: {
    color: PerlaColors.tertiary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '40',
  },
  cancelText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: PerlaColors.tertiary,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  saveText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
    color: PerlaColors.onTertiary,
  },
});
