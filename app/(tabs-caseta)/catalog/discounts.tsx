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
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PerlaColors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { obtenerDescuentos, obtenerPaquetes, upsertDescuento, eliminarDescuento } from '@/src/services/catalogos.service';
import type { Descuento, Paquete } from '@/src/lib/database.types';
import { globalEvents } from '@/src/lib/events';

export default function DiscountsCatalogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDescuento, setSelectedDescuento] = useState<Partial<Descuento> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerDescuentos();
      setDescuentos(data);
    } catch (err) {
      console.error('Fetch discounts error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
    const unsubscribe = globalEvents.on('fab-press-catalog-discounts', handleAddNew);
    return () => unsubscribe();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleEdit = (descuento: Descuento) => {
    setSelectedDescuento(descuento);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setSelectedDescuento({
      nombre: '',
      porcentaje: 0,
      aplica_comprador: false,
      cantidad_minima_boletos: 0,
      id_paquete_condicion: null,
      activo: true,
      es_default: true,
    });
    setShowModal(true);
  };

  const handleDeleteFromList = (item: Descuento) => {
    Alert.alert(
      'Eliminar Descuento',
      '¿Estás seguro de que deseas eliminar este descuento? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarDescuento(item.id_descuento!);
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', 'No se pudo eliminar el descuento.');
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
        <Text style={styles.title}>Descuentos</Text>
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
        {descuentos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏷️</Text>
            <Text style={styles.emptyText}>No hay descuentos registrados</Text>
          </View>
        ) : (
          descuentos.map((d) => (
            <Pressable key={d.id_descuento} onPress={() => handleEdit(d)} style={styles.card}>
              <View style={styles.cardInfo}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{d.nombre}</Text>
                  <Text style={styles.cardPct}>{d.porcentaje}%</Text>
                </View>
                <Text style={styles.cardLogic}>
                  {d.aplica_comprador ? '✅ Aplica Comprador' : '❌ Solo Caseta/Vendedor'}
                </Text>
                {d.cantidad_minima_boletos > 0 && (
                  <Text style={styles.cardCondition}>
                    Mínimo {d.cantidad_minima_boletos} boletos 
                    {d.paquete_condicion ? ` (${d.paquete_condicion.descripcion})` : ''}
                  </Text>
                )}
              </View>
              <View style={styles.cardActions}>
                <View style={[styles.activeIndicator, { backgroundColor: d.activo ? '#66BB6A' : '#EF5350' }]} />
                <Pressable onPress={(e) => { e.stopPropagation(); handleDeleteFromList(d); }} style={styles.deleteListBtn}>
                  <IconSymbol name="trash.fill" size={16} color={PerlaColors.error} />
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {showModal && (
        <DiscountModal
          visible={showModal}
          descuento={selectedDescuento}
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

function DiscountModal({ visible, descuento, onClose, onSaved }: { 
  visible: boolean; 
  descuento: Partial<Descuento> | null; 
  onClose: () => void; 
  onSaved: () => void 
}) {
  const [formData, setFormData] = useState<Partial<Descuento>>(descuento || {});
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    obtenerPaquetes().then(setPaquetes);
  }, []);

  const handleSave = async () => {
    if (!formData.nombre) return Alert.alert('Error', 'El nombre es requerido');
    setSaving(true);
    try {
      await upsertDescuento(formData);
      onSaved();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{descuento?.id_descuento ? 'Editar Descuento' : 'Nuevo Descuento'}</Text>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>NOMBRE DEL DESCUENTO</Text>
            <TextInput
              style={styles.input}
              value={formData.nombre}
              onChangeText={(t) => setFormData({ ...formData, nombre: t })}
              placeholder="Ej. Descuento Familiar"
              placeholderTextColor={PerlaColors.onSurfaceVariant + 'AA'}
            />

            <Text style={styles.label}>PORCENTAJE (%)</Text>
            <TextInput
              style={styles.input}
              value={formData.porcentaje?.toString()}
              onChangeText={(t) => setFormData({ ...formData, porcentaje: parseFloat(t) || 0 })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={PerlaColors.onSurfaceVariant + 'AA'}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>APLICA AL COMPRADOR</Text>
                <Text style={styles.switchDesc}>Si se activa, el cliente podrá ver y aplicar este descuento si cumple las reglas.</Text>
              </View>
              <Switch
                value={formData.aplica_comprador}
                onValueChange={(v) => setFormData({ ...formData, aplica_comprador: v })}
                trackColor={{ false: '#767577', true: PerlaColors.tertiary }}
              />
            </View>

            <Text style={[styles.label, { marginTop: 24 }]}>REGLAS AUTOMÁTICAS (CONDICIONES)</Text>
            
            <Text style={styles.label}>CANTIDAD MÍNIMA DE BOLETOS</Text>
            <TextInput
              style={styles.input}
              value={formData.cantidad_minima_boletos?.toString()}
              onChangeText={(t) => setFormData({ ...formData, cantidad_minima_boletos: parseInt(t) || 0 })}
              keyboardType="numeric"
              placeholder="0 (Sin mínimo)"
              placeholderTextColor={PerlaColors.onSurfaceVariant + 'AA'}
            />

            <Text style={styles.label}>PAQUETE ESPECÍFICO (OPCIONAL)</Text>
            <View style={styles.paqueteList}>
              <Pressable
                onPress={() => setFormData({ ...formData, id_paquete_condicion: null })}
                style={[styles.paqueteBtn, formData.id_paquete_condicion === null && styles.paqueteBtnActive]}
              >
                <Text style={[styles.paqueteBtnText, formData.id_paquete_condicion === null && styles.paqueteBtnTextActive]}>
                  Cualquier Paquete
                </Text>
              </Pressable>
              {paquetes.map(p => (
                <Pressable
                  key={p.id_paquete}
                  onPress={() => setFormData({ ...formData, id_paquete_condicion: p.id_paquete })}
                  style={[styles.paqueteBtn, formData.id_paquete_condicion === p.id_paquete && styles.paqueteBtnActive]}
                >
                  <Text style={[styles.paqueteBtnText, formData.id_paquete_condicion === p.id_paquete && styles.paqueteBtnTextActive]}>
                    {p.descripcion}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>ESTADO ACTIVO</Text>
              <Switch
                value={formData.activo}
                onValueChange={(v) => setFormData({ ...formData, activo: v })}
                trackColor={{ false: '#767577', true: PerlaColors.tertiary }}
              />
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
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Guardar Descuento</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
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
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '22',
  },
  cardInfo: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  cardName: { fontFamily: 'Manrope-Bold', fontSize: 17, color: PerlaColors.onSurface },
  cardPct: { fontFamily: 'Newsreader-Bold', fontSize: 20, color: PerlaColors.tertiary },
  cardLogic: { fontFamily: 'Manrope-Medium', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 2 },
  cardCondition: { fontFamily: 'Manrope', fontSize: 11, color: PerlaColors.tertiary, fontStyle: 'italic' },
  activeIndicator: { width: 8, height: 8, borderRadius: 4 },
  cardActions: { alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 2, marginLeft: 14 },
  
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
    fontSize: 16,
    color: PerlaColors.onSurface
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16 },
  switchDesc: { fontFamily: 'Manrope', fontSize: 11, color: PerlaColors.onSurfaceVariant, marginTop: 2, flex: 1 },
  paqueteList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  paqueteBtn: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '44' },
  paqueteBtnActive: { backgroundColor: PerlaColors.tertiary + '15', borderColor: PerlaColors.tertiary },
  paqueteBtnText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  paqueteBtnTextActive: { color: PerlaColors.tertiary, fontFamily: 'Manrope-Bold' },
  
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
  deleteListBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: PerlaColors.error + '10', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});
