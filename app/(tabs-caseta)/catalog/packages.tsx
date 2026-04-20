import { IconSymbol } from "@/components/ui/icon-symbol";
import { PerlaColors } from "@/constants/theme";
import type { Paquete } from "@/src/lib/database.types";
import { globalEvents } from "@/src/lib/events";
import {
  eliminarPaquete,
  obtenerPaquetes,
  upsertPaquete,
} from "@/src/services/catalogos.service";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PackagesCatalogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPaquete, setSelectedPaquete] =
    useState<Partial<Paquete> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerPaquetes();
      setPaquetes(data);
    } catch (err) {
      console.error("Fetch packages error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const unsubscribe = globalEvents.on(
      "fab-press-catalog-packages",
      handleAddNew,
    );
    return () => unsubscribe();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleEdit = (paquete: Paquete) => {
    setSelectedPaquete(paquete);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setSelectedPaquete({ descripcion: "", costo_persona: 0 });
    setShowModal(true);
  };

  const handleDeleteFromList = (item: Paquete) => {
    Alert.alert(
      "Eliminar Paquete",
      "¿Estás seguro de que deseas eliminar este paquete? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminarPaquete(item.id_paquete!);
              fetchData();
            } catch (err: any) {
              Alert.alert("Error", "No se pudo eliminar el paquete.");
            }
          },
        },
      ],
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
          <IconSymbol
            name="chevron.left"
            size={24}
            color={PerlaColors.onSurface}
          />
        </Pressable>
        <Text style={styles.title}>Paquetes</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PerlaColors.tertiary}
          />
        }
      >
        {paquetes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎁</Text>
            <Text style={styles.emptyText}>No hay paquetes registrados</Text>
          </View>
        ) : (
          paquetes.map((paquete) => (
            <Pressable
              key={paquete.id_paquete}
              onPress={() => handleEdit(paquete)}
              style={styles.card}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{paquete.nombre}</Text>
                {paquete.descripcion && (
                  <Text style={styles.cardDescription}>{paquete.descripcion}</Text>
                )}
                <Text style={styles.cardDetail}>
                  Costo: ${paquete.costo_persona} por persona
                </Text>
              </View>
              <Pressable onPress={() => handleDeleteFromList(paquete)} style={styles.deleteListBtn}>
                <IconSymbol
                  name="trash.fill"
                  size={20}
                  color={PerlaColors.error}
                />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      {showModal && (
        <PackageModal
          visible={showModal}
          paquete={selectedPaquete}
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

function PackageModal({
  visible,
  paquete,
  onClose,
  onSaved,
}: {
  visible: boolean;
  paquete: Partial<Paquete> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState<Partial<Paquete>>(paquete || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.nombre) return Alert.alert("Error", "El nombre es requerido");
    setSaving(true);
    try {
      await upsertPaquete(formData);
      onSaved();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {paquete?.id_paquete ? "Editar Paquete" : "Nuevo Paquete"}
          </Text>
          <Text style={styles.label}>NOMBRE DEL PAQUETE</Text>
          <TextInput
            style={styles.input}
            value={formData.nombre}
            onChangeText={(v) => setFormData({ ...formData, nombre: v })}
            placeholder="Ej. Con comida incluida"
            placeholderTextColor={PerlaColors.onSurfaceVariant + "AA"}
          />

          <Text style={styles.label}>DESCRIPCIÓN DETALLADA</Text>
          <TextInput
            style={styles.input}
            value={formData.descripcion}
            onChangeText={(v) => setFormData({ ...formData, descripcion: v })}
            placeholder="Ej. Bebidas y snacks incluidos"
            placeholderTextColor={PerlaColors.onSurfaceVariant + "AA"}
          />
          <Text style={styles.label}>COSTO POR PERSONA ($)</Text>
          <TextInput
            style={styles.input}
            value={String(formData.costo_persona || "")}
            onChangeText={(v) =>
              setFormData({ ...formData, costo_persona: Number(v) })
            }
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={PerlaColors.onSurfaceVariant + "AA"}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={[
                styles.saveBtn,
                { backgroundColor: PerlaColors.tertiary },
                saving && { opacity: 0.6 },
              ]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar Paquete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  centered: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  title: {
    flex: 1,
    fontFamily: "Newsreader-Bold",
    fontSize: 32,
    color: PerlaColors.onSurface,
  },
  scrollContent: { paddingHorizontal: 20 },
  card: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "22",
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    color: PerlaColors.onSurface,
  },
  cardDescription: {
    fontFamily: "Manrope",
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 2,
  },
  cardDetail: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: PerlaColors.tertiary,
    marginTop: 6,
  },
  emptyState: { padding: 40, alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: {
    fontFamily: "Manrope-Medium",
    color: PerlaColors.onSurfaceVariant,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "33",
  },
  modalTitle: { fontFamily: 'Newsreader-Bold', fontSize: 28, color: PerlaColors.onSurface, marginBottom: 24 },
  label: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  input: {
    backgroundColor: PerlaColors.background,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Manrope",
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "44",
    fontSize: 16,
    color: PerlaColors.onSurface,
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 32 },
  cancelBtn: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant,
  },
  cancelBtnText: {
    fontFamily: "Manrope-Bold",
    color: PerlaColors.onSurfaceVariant,
  },
  saveBtn: { flex: 2, padding: 16, alignItems: "center", borderRadius: 12 },
  deleteListBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PerlaColors.error + "10",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: { fontFamily: "Manrope-Bold", color: PerlaColors.onTertiary },
});
