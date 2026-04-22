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
import { useRouter } from 'expo-router';
import { PerlaColors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { obtenerBarcos, upsertBarco, eliminarBarco } from '@/src/services/catalogos.service';
import type { Embarcacion, EstadoOperativoBarco } from '@/src/lib/database.types';
import { globalEvents } from '@/src/lib/events';
import { supabase } from '@/src/lib/supabase';

export default function BoatsCatalogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [barcos, setBarcos] = useState<Embarcacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedBarco, setSelectedBarco] = useState<Partial<Embarcacion> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerBarcos();
      setBarcos(data);
    } catch (err) {
      console.error('Fetch boats error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
    const unsubscribe = globalEvents.on('fab-press-catalog-boats', handleAddNew);
    return () => unsubscribe();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleEdit = (barco: Embarcacion) => {
    setSelectedBarco(barco);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setSelectedBarco({
      nombre: '',
      capacidad_maxima: 20,
      matricula: '',
      estado_operativo: 'Activo',
      duracion_estandar_viaje: 90,
      margen_tolerancia_minutos: 5,
    });
    setShowModal(true);
  };

  const handleDeleteFromList = (barco: Embarcacion) => {
    Alert.alert(
      'Eliminar Barco',
      '¿Estás seguro de que deseas eliminar este barco? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarBarco(barco.id_embarcacion!);
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', 'No se pudo eliminar el barco. Podría tener viajes asociados.');
            }
          }
        }
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={PerlaColors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Barcos</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingBottom: insets.bottom + 100 }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PerlaColors.tertiary} />
        }
      >
        {barcos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚢</Text>
            <Text style={styles.emptyText}>No hay barcos registrados</Text>
          </View>
        ) : (
          barcos.map((barco) => (
            <Pressable key={barco.id_embarcacion} style={styles.card} onPress={() => handleEdit(barco)}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{barco.nombre}</Text>
                <Text style={styles.cardDetail}>Capacidad: {barco.capacidad_maxima} personas</Text>
                <Text style={styles.cardDetail}>M. Tolerancia: {barco.margen_tolerancia_minutos} min</Text>
              </View>
              <View style={styles.cardActions}>
                <View style={[styles.badge, { backgroundColor: getEstadoColor(barco.estado_operativo) + '22' }]}>
                  <Text style={[styles.badgeText, { color: getEstadoColor(barco.estado_operativo) }]}>
                    {barco.estado_operativo}
                  </Text>
                </View>
                <Pressable onPress={() => handleDeleteFromList(barco)} style={styles.deleteListBtn}>
                  <IconSymbol name="trash.fill" size={20} color={PerlaColors.error} />
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {showModal && (
        <BoatModal
          visible={showModal}
          barco={selectedBarco}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            fetchData();
          }}
        />
      )}
    </View>
  );
}

function BoatModal({ visible, barco, onClose, onSaved }: { 
  visible: boolean; 
  barco: Partial<Embarcacion> | null; 
  onClose: () => void; 
  onSaved: () => void 
}) {
  const [formData, setFormData] = useState<Partial<Embarcacion>>(barco || { tripulacion_default: [] });
  const [saving, setSaving] = useState(false);
  const [encargados, setEncargados] = useState<{ id_usuario: string; nombre: string }[]>([]);

  useEffect(() => {
    supabase
      .from('usuario')
      .select('id_usuario, nombre')
      .eq('rango', 'Barco')
      .then(({ data }) => {
        if (data) setEncargados(data);
      });
  }, []);

  const toggleEncargado = (id: string) => {
    setFormData(prev => {
      const current = prev.tripulacion_default || [];
      if (current.includes(id)) {
        return { ...prev, tripulacion_default: current.filter(x => x !== id) };
      } else {
        return { ...prev, tripulacion_default: [...current, id] };
      }
    });
  };

  const handleSave = async () => {
    if (!formData.nombre) return Alert.alert('Error', 'El nombre es requerido');
    setSaving(true);
    try {
      await upsertBarco(formData);
      onSaved();
    } catch (err: any) {
      console.error("Full save error:", err);
      Alert.alert('Error Guardando', err.message + '\n\nDetalles: ' + JSON.stringify(err, null, 2));
    } finally {
      setSaving(false);
    }
  };

  const estados: EstadoOperativoBarco[] = ['Activo', 'Mantenimiento', 'Inactivo'];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{barco?.id_embarcacion ? 'Editar Barco' : 'Nuevo Barco'}</Text>
          
          <ScrollView>
            <Text style={styles.label}>NOMBRE</Text>
            <TextInput
              style={styles.input}
              value={formData.nombre}
              onChangeText={(t) => setFormData({ ...formData, nombre: t })}
              placeholder="Ej. Perla Negra"
              placeholderTextColor={PerlaColors.onSurfaceVariant + 'AA'}
            />

            <Text style={styles.label}>MATRÍCULA</Text>
            <TextInput
              style={styles.input}
              value={formData.matricula || ''}
              onChangeText={(t) => setFormData({ ...formData, matricula: t })}
              placeholder="Ej. ABC-123"
              placeholderTextColor={PerlaColors.onSurfaceVariant + 'AA'}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CAPACIDAD MÁX</Text>
                <TextInput
                  style={styles.input}
                  value={formData.capacidad_maxima?.toString()}
                  onChangeText={(t) => setFormData({ ...formData, capacidad_maxima: parseInt(t) || 0 })}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.label}>MARGEN TOLERANCIA (MIN)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.margen_tolerancia_minutos?.toString()}
                  onChangeText={(t) => setFormData({ ...formData, margen_tolerancia_minutos: parseInt(t) || 0 })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.label}>DURACIÓN ESTÁNDAR (MIN)</Text>
            <TextInput
              style={styles.input}
              value={formData.duracion_estandar_viaje?.toString()}
              onChangeText={(t) => setFormData({ ...formData, duracion_estandar_viaje: parseInt(t) || 0 })}
              keyboardType="numeric"
            />

            <Text style={styles.label}>TRIPULACIÓN PREDETERMINADA</Text>
            <View style={styles.barcoList}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {encargados.map(enc => {
                  const isSelected = (formData.tripulacion_default || []).includes(enc.id_usuario);
                  return (
                    <Pressable
                      key={enc.id_usuario}
                      style={[
                        styles.barcoBtn,
                        isSelected && styles.barcoBtnActive,
                      ]}
                      onPress={() => toggleEncargado(enc.id_usuario)}
                    >
                      <Text style={[
                        styles.barcoBtnText,
                        isSelected && styles.barcoBtnTextActive,
                      ]}>
                        {enc.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={styles.label}>ESTADO OPERATIVO</Text>
            <View style={styles.estadoRow}>
              {estados.map(est => (
                <Pressable
                  key={est}
                  onPress={() => setFormData({ ...formData, estado_operativo: est })}
                  style={[styles.estadoBtn, formData.estado_operativo === est && styles.estadoBtnActive]}
                >
                  <Text style={[styles.estadoBtnText, formData.estado_operativo === est && styles.estadoBtnTextActive]}>
                    {est}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable 
              onPress={handleSave} 
              style={[styles.saveBtn, { backgroundColor: PerlaColors.tertiary }, saving && { opacity: 0.6 }]}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Guardar Barco</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getEstadoColor(estado?: EstadoOperativoBarco | null) {
  switch (estado) {
    case 'Activo': return '#66BB6A';
    case 'Mantenimiento': return '#FFA726';
    case 'Inactivo': return '#EF5350';
    default: return '#999';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, fontFamily: 'Newsreader-Bold', fontSize: 32, color: PerlaColors.onSurface },
  scrollContent: { paddingHorizontal: 20 },
  card: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '22',
  },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onSurface, marginBottom: 4 },
  cardDetail: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  cardActions: { alignItems: 'flex-end', gap: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontFamily: 'Manrope-Bold', fontSize: 10, textTransform: 'uppercase' },
  deleteListBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: PerlaColors.error + '10', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Manrope-Medium', color: PerlaColors.onSurfaceVariant },
  
  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalCard: { 
    backgroundColor: PerlaColors.surfaceContainerLow, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24, 
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '33'
  },
  modalTitle: { fontFamily: 'Newsreader-Bold', fontSize: 28, color: PerlaColors.onSurface, marginBottom: 24 },
  label: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  input: { 
    backgroundColor: PerlaColors.surfaceContainerLow, 
    borderRadius: 12, 
    padding: 14, 
    fontFamily: 'Manrope', 
    borderWidth: 1, 
    borderColor: PerlaColors.outlineVariant + '44',
    color: PerlaColors.onSurface,
    fontSize: 16
  },
  row: { flexDirection: 'row' },
  estadoRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  estadoBtn: { 
    flex: 1, 
    padding: 10, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: PerlaColors.outlineVariant + '44', 
    alignItems: 'center' 
  },
  estadoBtnActive: { backgroundColor: PerlaColors.tertiary, borderColor: PerlaColors.tertiary },
  estadoBtnText: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  estadoBtnTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 32, marginBottom: 12 },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: PerlaColors.outlineVariant },
  cancelBtnText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurfaceVariant },
  saveBtn: { flex: 2, padding: 16, alignItems: 'center', borderRadius: 12, backgroundColor: PerlaColors.tertiary },
  saveBtnText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onTertiary },
  deleteBtn: { 
    width: 60, 
    padding: 16, 
    alignItems: 'center', 
    borderRadius: 12, 
    backgroundColor: PerlaColors.error + '15',
    borderWidth: 1,
    borderColor: PerlaColors.error + '30',
  },
  barcoList: {
    marginTop: 4,
    marginBottom: 8,
  },
  barcoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
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
});
