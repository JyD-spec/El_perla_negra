import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { obtenerViajesDelDia, obtenerCupoViaje } from '@/src/services/viajes.service';
import { crearReservacion } from '@/src/services/reservaciones.service';
import { supabase } from '@/src/lib/supabase';
import type { Paquete, Viaje } from '@/src/lib/database.types';

/* ────────────────────────────────────────────────────────────
   Comprador – Reserva de Viajes
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };

export default function CompradorReserveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [viajes, setViajes] = useState<ViajeConEmb[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [cupos, setCupos] = useState<Record<number, number>>({});

  const [selectedViaje, setSelectedViaje] = useState<ViajeConEmb | null>(null);
  const [selectedPaquete, setSelectedPaquete] = useState<Paquete | null>(null);
  const [cantidad, setCantidad] = useState('1');

  useEffect(() => {
    (async () => {
      try {
        const [viajesData, paqData] = await Promise.all([
          obtenerViajesDelDia(),
          supabase.from('paquete').select('*').then(r => r.data as Paquete[]),
        ]);
        setViajes(viajesData as ViajeConEmb[]);
        setPaquetes(paqData ?? []);

        const cupoResults = await Promise.all(
          viajesData.map(v => obtenerCupoViaje(v.id_viaje).then(c => ({ id: v.id_viaje, cupo: c })))
        );
        const m: Record<number, number> = {};
        cupoResults.forEach(r => { m[r.id] = r.cupo; });
        setCupos(m);

        // Auto-select first available package
        if (paqData && paqData.length > 0) setSelectedPaquete(paqData[0]);

      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleReservar = async () => {
    if (!selectedViaje || !selectedPaquete) {
      Alert.alert('Faltan Datos', 'Selecciona un viaje y paquete.');
      return;
    }
    
    const cantNum = parseInt(cantidad) || 1;
    const disp = selectedViaje.embarcacion.capacidad_maxima - (cupos[selectedViaje.id_viaje] ?? 0);
    
    if (cantNum > disp) {
      Alert.alert('Cupo Insuficiente', `Solo quedan ${disp} lugares disponibles en este viaje.`);
      return;
    }

    setSaving(true);
    try {
      // Cliente profile should exist, if not, we use basic fallback
      const { data: profile } = await supabase.from('cliente').select('nombre_completo, telefono').eq('id_cliente', user?.id).single();
      
      const res = await crearReservacion({
        nombreCliente: profile?.nombre_completo ?? 'Invitado',
        telefono: profile?.telefono ?? '0000000000',
        idPaquete: selectedPaquete.id_paquete,
        idViaje: selectedViaje.id_viaje,
        cantidadPersonas: cantNum,
      });

      Alert.alert(
        '¡Reservación Exitosa!', 
        'Tu reservación está pendiente de pago. Por favor paga en caseta para liberar tu pase de abordar.',
        [{ text: 'Ver Mis Boletos', onPress: () => router.replace('/(tabs-comprador)/tickets') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const cantNum = parseInt(cantidad) || 1;
  const subtotal = (selectedPaquete?.costo_persona ?? 0) * cantNum;

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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
    >
      <Text style={styles.title}>Reservar Aventura</Text>
      <Text style={styles.subtitle}>Selecciona un viaje para zarpar hoy mismo</Text>

      {/* ── 1. Viajes ─────────────────────────── */}
      <Text style={styles.sectionLabel}>VIAJES DE HOY</Text>
      {viajes.filter(v => v.estado_viaje === 'Programado').length === 0 && (
        <Text style={styles.emptyInfo}>No hay viajes programados disponibles por ahora.</Text>
      )}
      {viajes.filter(v => v.estado_viaje === 'Programado').map(v => {
        const ocu = cupos[v.id_viaje] ?? 0;
        const disp = v.embarcacion.capacidad_maxima - ocu;
        return (
          <Pressable
            key={v.id_viaje}
            style={[styles.card, selectedViaje?.id_viaje === v.id_viaje && styles.cardActive]}
            onPress={() => setSelectedViaje(v)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>🕐 {v.hora_salida_programada.slice(0, 5)}</Text>
              <Text style={styles.cardSub}>{v.embarcacion.nombre}</Text>
            </View>
            <Text style={[styles.disponibilidad, disp <= 0 && { color: '#EF5350' }]}>
              {disp > 0 ? `${disp} lugares` : 'LLENO'}
            </Text>
          </Pressable>
        );
      })}

      {/* ── 2. Paquetes ───────────────────────── */}
      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>TIPO DE PAQUETE</Text>
      {paquetes.map(p => (
        <Pressable
          key={p.id_paquete}
          style={[styles.card, selectedPaquete?.id_paquete === p.id_paquete && styles.cardActive]}
          onPress={() => setSelectedPaquete(p)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{p.descripcion}</Text>
            <Text style={styles.cardSub}>Por persona</Text>
          </View>
          <Text style={[styles.disponibilidad, { color: PerlaColors.tertiary, fontSize: 18, fontFamily: 'Newsreader-Bold' }]}>
            ${p.costo_persona}
          </Text>
        </Pressable>
      ))}

      {/* ── 3. Personas ───────────────────────── */}
      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>PASAJEROS</Text>
      <View style={styles.personasCard}>
        <TextInput
          style={styles.input}
          value={cantidad}
          onChangeText={setCantidad}
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
        />
        <Text style={styles.personasLabel}>Adultos / Niños</Text>
      </View>

      {/* ── Summary & Checkout ───────────────── */}
      {selectedViaje && selectedPaquete && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Total a Pagar</Text>
          <Text style={styles.summaryTotal}>${subtotal.toFixed(0)} MXN</Text>
          <Text style={styles.summaryHint}>
            El pago debe realizarse en caseta para autorizar tu abordaje.
          </Text>
          
          <Pressable
            style={[styles.reserveBtn, saving && { opacity: 0.6 }]}
            onPress={handleReservar}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={PerlaColors.onTertiary} />
            ) : (
              <Text style={styles.reserveBtnText}>Confirmar Reservación</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 4 },
  subtitle: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, marginBottom: 20 },

  sectionLabel: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurfaceVariant, letterSpacing: 1.2, marginBottom: 10 },
  emptyInfo: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, marginBottom: 16 },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent',
  },
  cardActive: { borderColor: PerlaColors.tertiary + '80', backgroundColor: PerlaColors.tertiary + '10' },
  cardTitle: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onSurface, marginBottom: 2 },
  cardSub: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  disponibilidad: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#66BB6A' },

  personasCard: { alignItems: 'center', backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14, padding: 24, marginBottom: 20 },
  input: { fontFamily: 'Newsreader-Bold', fontSize: 36, color: PerlaColors.tertiary, borderBottomWidth: 1, borderBottomColor: PerlaColors.tertiary, minWidth: 60, paddingBottom: 4, marginBottom: 12 },
  personasLabel: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },

  summaryBox: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 20, marginTop: 10, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '30' },
  summaryTitle: { fontFamily: 'Manrope-Medium', fontSize: 13, color: PerlaColors.onSurfaceVariant, textTransform: 'uppercase', marginBottom: 6 },
  summaryTotal: { fontFamily: 'Newsreader-Bold', fontSize: 32, color: PerlaColors.tertiary, marginBottom: 12 },
  summaryHint: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 20 },
  reserveBtn: { backgroundColor: PerlaColors.tertiary, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  reserveBtnText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onTertiary },
});
