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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { obtenerViajeActual } from '@/src/services/viajes.service';
import {
  obtenerReservacionesPorViaje,
  marcarAbordado,
} from '@/src/services/reservaciones.service';
import { supabase } from '@/src/lib/supabase';
import type { ReservacionConDetalles } from '@/src/lib/database.types';
import { CameraView, useCameraPermissions } from 'expo-camera';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [viajeId, setViajeId] = useState<number | null>(null);
  
  // Camera Scanner
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

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

  const filteredReservations = reservaciones.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchesName = r.cliente?.nombre_completo?.toLowerCase().includes(q);
    const matchesPhone = r.cliente?.telefono?.includes(q);
    const matchesPIN = r.pin_verificacion?.toLowerCase().includes(q);
    return matchesName || matchesPhone || matchesPIN;
  });

  const totalPersonas = reservaciones.reduce((s, r) => s + r.cantidad_personas, 0);
  const abordados = filteredReservations.filter(r => r.estado_pase === 'Abordado');
  const personasABordo = reservaciones.filter(r => r.estado_pase === 'Abordado').reduce((s, r) => s + r.cantidad_personas, 0);
  const aprobados = filteredReservations.filter(r => r.estado_pase === 'Aprobado');

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  if (isScanning) {
    if (!permission) {
      return <View style={styles.root} />; // Loading permissions
    }
    if (!permission.granted) {
      return (
        <View style={[styles.root, styles.centered]}>
          <Text style={{ color: PerlaColors.onSurface, marginBottom: 20, textAlign: 'center', paddingHorizontal: 40 }}>
            Necesitamos acceso a la cámara para escanear los boletos de abordaje.
          </Text>
          <Pressable style={styles.boardBtn} onPress={requestPermission}>
            <Text style={styles.boardBtnText}>Conceder Permiso</Text>
          </Pressable>
          <Pressable style={{ marginTop: 24 }} onPress={() => setIsScanning(false)}>
            <Text style={{ color: PerlaColors.onSurfaceVariant }}>Cancelar</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            // Find the reservation matching this PIN in our current list
            const found = reservaciones.find(r => r.pin_verificacion === data);
            
            setSearchQuery(data);
            setIsScanning(false);

            if (found) {
              if (found.estado_pase === 'Aprobado') {
                handleBoardFromList(found);
              } else if (found.estado_pase === 'Abordado') {
                Alert.alert('Ya Abordado', `${found.cliente?.nombre_completo} ya se encuentra a bordo.`);
              }
            } else {
              Alert.alert('Boleto Inválido', 'No se encontró ninguna reservación con este código para este viaje.');
            }
          }}
        />
        
        {/* Semi-transparent dark overlay */}
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerTop} />
          <View style={styles.scannerMiddle}>
            <View style={styles.scannerSide} />
            <View style={styles.scannerTarget} />
            <View style={styles.scannerSide} />
          </View>
          <View style={styles.scannerBottom}>
             <Pressable style={styles.closeScannerCircle} onPress={() => setIsScanning(false)}>
              <Text style={styles.closeScannerCircleText}>✕</Text>
            </Pressable>
            <Text style={styles.scannerHint}>Escanea el código QR del boleto</Text>
          </View>
        </View>
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

      {/* ── Search ───────────────────────────── */}
      <View style={styles.pinSearchContainer}>
        <TextInput
          style={styles.pinSearchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar nombre, tel. o código..."
          placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
        />
        <Pressable 
          style={styles.scanBtn}
          onPress={() => setIsScanning(true)}
        >
          <Text style={styles.scanBtnIcon}>📷</Text>
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
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <Pressable 
        style={[styles.passengerCard, isBoarded && styles.passengerCardBoarded]}
        onPress={() => setShowDetails(true)}
      >
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>
            {isBoarded ? '✅ ' : ''}{r.cliente?.nombre_completo ?? 'Cliente'}
          </Text>
          
          <View style={styles.passengerMetaRow}>
            <Text style={styles.passengerDetail}>👥 {r.cantidad_personas} Pax</Text>
            <Text style={styles.passengerDetail}>📞 {r.cliente?.telefono ?? 'No registrado'}</Text>
          </View>
          
          <Text style={styles.passengerPin}>🔑 NIP: {r.pin_verificacion ?? '—'}</Text>

          <Text style={[styles.passengerDetail, { color: PerlaColors.tertiary, marginTop: 4 }]} numberOfLines={1}>
            {r.detalle_reservacion && r.detalle_reservacion.length > 0 
              ? r.detalle_reservacion.map(d => `${d.cantidad}x ${d.paquete?.descripcion}`).join(', ')
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
      </Pressable>

      <Modal visible={showDetails} transparent animationType="slide" onRequestClose={() => setShowDetails(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del Pase</Text>
              <Pressable onPress={() => setShowDetails(false)} style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 24, color: PerlaColors.onSurfaceVariant }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>PASAJERO</Text>
                <Text style={styles.detailText}>{r.cliente?.nombre_completo ?? 'Cliente Particular'}</Text>
                <Text style={styles.detailSubtext}>📱 {r.cliente?.telefono ?? 'Sin teléfono registrado'}</Text>
                <Text style={styles.detailSubtext}>🎫 NIP: {r.pin_verificacion ?? 'Sin NIP'}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>BOLETO Y PAQUETES</Text>
                <View style={styles.packageBox}>
                  <Text style={styles.packageTitle}>Total Personas: {r.cantidad_personas}</Text>
                  {r.detalle_reservacion && r.detalle_reservacion.length > 0 ? (
                    r.detalle_reservacion.map(d => (
                      <View key={d.id_detalle} style={styles.packageItem}>
                        <Text style={styles.packageItemText}>{d.cantidad}x {d.paquete?.descripcion}</Text>
                        <Text style={styles.packageItemSub}>{d.paquete?.costo_persona ? `$${d.paquete.costo_persona} c/u` : ''}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.packageItemText}>{r.paquete?.descripcion || 'Pase general'}</Text>
                  )}
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>ESTADO DEL PAGO</Text>
                <Text style={[styles.statusBadge, { color: (r.pago && r.pago.length > 0) ? '#66BB6A' : '#EF5350' }]}>
                  {(r.pago && r.pago.length > 0) ? `Pagado (${r.pago[0].metodo_pago})` : 'Pago pendiente'}
                </Text>
              </View>
            </ScrollView>

            <Pressable 
              style={[styles.closeModalFullBtn, { backgroundColor: isBoarded ? '#66BB6A' : PerlaColors.tertiary }]}
              onPress={() => setShowDetails(false)}
            >
              <Text style={styles.closeModalFullBtnText}>{isBoarded ? 'Cerrar' : 'Entendido'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
    fontFamily: 'Manrope-Medium', fontSize: 16, color: PerlaColors.onSurface,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '25',
  },
  scanBtn: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 12,
    width: 54, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '25',
  },
  scanBtnIcon: { fontSize: 24 },

  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scannerTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scannerMiddle: {
    flexDirection: 'row',
    height: 250,
  },
  scannerSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scannerTarget: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: PerlaColors.tertiary,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  scannerBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 40,
  },
  scannerHint: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 20,
    opacity: 0.8,
  },
  closeScannerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  closeScannerCircleText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
  },

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
  passengerMetaRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  passengerPin: { fontFamily: 'Manrope-Bold', fontSize: 13, color: PerlaColors.tertiary, marginBottom: 2 },
  passengerDetail: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },

  boardBtn: {
    backgroundColor: '#26A69A', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  boardBtnText: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#fff' },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontFamily: 'Newsreader', fontSize: 20, color: PerlaColors.onSurface },

  // Modal Styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: PerlaColors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, height: '70%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
  },
  modalTitle: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.onSurface },
  modalCloseBtn: { padding: 4 },
  modalBody: { flex: 1 },
  detailSection: { marginBottom: 24 },
  detailLabel: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.tertiary, letterSpacing: 1, marginBottom: 8 },
  detailText: { fontFamily: 'Newsreader-Bold', fontSize: 20, color: PerlaColors.onSurface, marginBottom: 4 },
  detailSubtext: { fontFamily: 'Manrope-Medium', fontSize: 14, color: PerlaColors.onSurfaceVariant, marginBottom: 2 },
  packageBox: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '30',
  },
  packageTitle: { fontFamily: 'Manrope-Bold', fontSize: 15, color: PerlaColors.onSurface, marginBottom: 12 },
  packageItem: { marginBottom: 8, borderLeftWidth: 2, borderLeftColor: PerlaColors.tertiary, paddingLeft: 12 },
  packageItemText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.onSurface },
  packageItemSub: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  statusBadge: { fontFamily: 'Manrope-Bold', fontSize: 16 },
  closeModalFullBtn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  closeModalFullBtnText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: '#fff' },
});
