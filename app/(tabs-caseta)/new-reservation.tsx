import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PerlaColors } from '@/constants/theme';
import { useToast } from '@/src/contexts/ToastContext';
import { supabase } from '@/src/lib/supabase';
import { obtenerViajesDelDia, obtenerCupoViaje } from '@/src/services/viajes.service';
import { registrarPago } from '@/src/services/pagos.service';
import { crearReservacion } from '@/src/services/reservaciones.service';
import type { Paquete, Viaje } from '@/src/lib/database.types';
import { FlowToggle } from '@/components/ui/FlowToggle';
import { format12h } from '@/src/lib/time';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };
type PaymentMethod = 'efectivo' | 'tarjeta';

const DISCOUNT_THRESHOLD = 5;
const DISCOUNT_RATE = 0.10;

/* ────────────────────────────────────────────────────────────
   Caseta – New Reservation Screen
   ──────────────────────────────────────────────────────────── */

export default function CasetaNewReservationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ paquete?: string }>();

  /* ─── Data state ───────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [viajes, setViajes] = useState<ViajeConEmb[]>([]);
  const [cupos, setCupos] = useState<Record<number, number>>({});

  /* ─── Form state ───────────────────────────────────────── */
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [selectedViaje, setSelectedViaje] = useState<ViajeConEmb | null>(null);
  const [personas, setPersonas] = useState<string>('1');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  /* ─── Date state ───────────────────────────────────────── */
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  /* ─── Payment state ────────────────────────────────────── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');

  /* ─── Initial Load ─────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const { data: paqData } = await supabase.from('paquete').select('*');
        setPaquetes(paqData || []);
        
        if (params.paquete && paqData) {
          const p = paqData.find(x => x.descripcion.toLowerCase().includes(params.paquete!.toLowerCase()));
          if (p) setSelectedPackage(p.id_paquete);
        } else if (paqData && paqData.length > 0) {
          setSelectedPackage(paqData[0].id_paquete);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.paquete]);

  /* ─── Fetch Trips when Date changes ────────────────────── */
  useEffect(() => {
    (async () => {
      const formatted = date.toISOString().split('T')[0];
      try {
        const viajesData = await obtenerViajesDelDia(formatted);
        setViajes(viajesData as ViajeConEmb[]);
        setSelectedViaje(null);

        const cupoResults = await Promise.all(
          viajesData.map(v => obtenerCupoViaje(v.id_viaje).then(c => ({ id: v.id_viaje, cupo: c })))
        );
        const m: Record<number, number> = {};
        cupoResults.forEach(r => { m[r.id] = r.cupo; });
        setCupos(m);
      } catch (err) {
        console.error('Error fetching trips:', err);
      }
    })();
  }, [date]);

  /* ─── Derived values ───────────────────────────────────── */
  const personasNum = useMemo(() => {
    const n = parseInt(personas, 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }, [personas]);

  const activePaquete = useMemo(
    () => paquetes.find((p) => p.id_paquete === selectedPackage),
    [selectedPackage, paquetes]
  );

  const hasDiscount = personasNum >= DISCOUNT_THRESHOLD;
  const subtotal = (activePaquete?.costo_persona || 0) * personasNum;
  const discount = hasDiscount ? subtotal * DISCOUNT_RATE : 0;
  const total = subtotal - discount;

  /* ─── Handlers ─────────────────────────────────────────── */
  const onDateChange = useCallback(
    (_event: DateTimePickerEvent, selected?: Date) => {
      setShowDatePicker(Platform.OS === 'ios');
      if (selected) setDate(selected);
    },
    []
  );

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const formatDate = useCallback((d: Date) => {
    return d.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const handleReservar = async () => {
    if (!selectedPackage) return toast.warning('Selecciona un paquete.');
    if (!selectedViaje) return toast.warning('Selecciona un horario.');
    if (!nombre.trim()) return toast.warning('Ingresa el nombre del cliente.');
    if (!telefono.trim() || telefono.length < 10) return toast.warning('Ingresa un teléfono válido.');
    if (paymentMethod === 'tarjeta' && !email.trim()) return toast.warning('Ingresa el correo para el recibo.');

    const disp = selectedViaje.embarcacion.capacidad_maxima - (cupos[selectedViaje.id_viaje] ?? 0);
    if (personasNum > disp) return toast.warning(`Cupo insuficiente (Máx: ${disp}).`);

    setSaving(true);
    try {
      if (paymentMethod === 'tarjeta') {
        // 1. Obtener sesión de pago desde Supabase Edge Function
        const { data: sheetData, error: sheetError } = await supabase.functions.invoke('stripe-payment-sheet', {
          body: {
            amount: total,
            currency: 'mxn',
            email: email.trim(),
            name: nombre.trim(),
            phone: telefono.trim(),
          }
        });

        if (sheetError) throw new Error(sheetError.message || 'Error al conectar con Stripe');

        // 2. Inicializar el Payment Sheet
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'El Perla Negra',
          customerId: sheetData.customer,
          customerEphemeralKeySecret: sheetData.ephemeralKey,
          paymentIntentClientSecret: sheetData.paymentIntent,
          allowsDelayedPaymentMethods: true,
          defaultBillingDetails: {
            name: nombre.trim(),
            email: email.trim(),
            phone: telefono.trim(),
          },
          appearance: {
            colors: {
              primary: PerlaColors.tertiary,
              background: PerlaColors.surfaceContainerLow,
              componentBackground: PerlaColors.surfaceContainer,
              componentDivider: PerlaColors.outlineVariant,
              primaryText: PerlaColors.onSurface,
              secondaryText: PerlaColors.onSurfaceVariant,
              placeholderText: PerlaColors.onSurfaceVariant + '60',
              icon: PerlaColors.tertiary,
            },
            shapes: { borderRadius: 12 },
          }
        });

        if (initError) throw initError;

        // 3. Presentar el formulario de pago
        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') {
            setSaving(false);
            return;
          }
          throw presentError;
        }
      }

      // 4. Crear la reservación
      const res = await crearReservacion({
        nombreCliente: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        idPaquete: selectedPackage,
        idViaje: selectedViaje.id_viaje,
        cantidadPersonas: personasNum,
      });

      // 5. Registrar el pago si fue exitoso con tarjeta
      if (paymentMethod === 'tarjeta') {
        await registrarPago({
          id_reservacion: res.id_reservacion,
          metodo_pago: 'Stripe',
          monto_pagado: total,
        });
      }

      toast.success('Reservación creada exitosamente.');
      router.back();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la operación.');
      console.error(err);
    } finally {
      setSaving(false);
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: PerlaColors.onSurface, fontSize: 18 }}>✕</Text>
          </Pressable>
          <View>
            <Text style={styles.screenTitle}>Nueva Reservación</Text>
            <Text style={styles.screenSubtitle}>Registro de cliente en caseta</Text>
          </View>
        </View>

        {/* 1. Cliente */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>1</Text></View>
          <Text style={styles.sectionLabel}>Datos del Cliente</Text>
        </View>

        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Nombre Completo</Text>
          <TextInput
            style={styles.textInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del cliente"
            placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
          />
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Teléfono</Text>
          <TextInput
            style={styles.textInput}
            value={telefono}
            onChangeText={setTelefono}
            placeholder="10 dígitos"
            keyboardType="phone-pad"
            maxLength={10}
            placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
          />
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Email (para recibo)</Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder="ejemplo@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
          />
        </View>

        {/* 2. Pago */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>2</Text></View>
          <Text style={styles.sectionLabel}>Método de Pago</Text>
        </View>

        <View style={styles.paymentMethods}>
          <Pressable 
            style={[styles.paymentBtn, paymentMethod === 'efectivo' && styles.paymentBtnActive]}
            onPress={() => setPaymentMethod('efectivo')}
          >
            <Text style={[styles.paymentBtnText, paymentMethod === 'efectivo' && styles.paymentBtnTextActive]}>💵 Efectivo</Text>
          </Pressable>
          <Pressable 
            style={[styles.paymentBtn, paymentMethod === 'tarjeta' && styles.paymentBtnActive]}
            onPress={() => setPaymentMethod('tarjeta')}
          >
            <Text style={[styles.paymentBtnText, paymentMethod === 'tarjeta' && styles.paymentBtnTextActive]}>💳 Tarjeta</Text>
          </Pressable>
        </View>

        {/* 3. Paquete */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>3</Text></View>
          <Text style={styles.sectionLabel}>Paquete y Tripulación</Text>
        </View>

        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Cantidad de Personas</Text>
          <View style={styles.counterRow}>
            <Pressable style={styles.counterBtn} onPress={() => setPersonas(String(Math.max(personasNum - 1, 1)))}>
              <Text style={styles.counterBtnText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.counterInput}
              value={personas}
              onChangeText={setPersonas}
              keyboardType="number-pad"
              textAlign="center"
            />
            <Pressable style={styles.counterBtn} onPress={() => setPersonas(String(Math.min(personasNum + 1, 50)))}>
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.packageList}>
          {paquetes.map((pkg) => {
            const isSelected = selectedPackage === pkg.id_paquete;
            return (
              <Pressable
                key={pkg.id_paquete}
                style={[styles.packageItem, isSelected && styles.packageItemSelected]}
                onPress={() => setSelectedPackage(pkg.id_paquete)}
              >
                <Text style={[styles.packageName, isSelected && styles.packageNameSelected]}>{pkg.descripcion}</Text>
                <Text style={styles.packagePrice}>${pkg.costo_persona}</Text>
              </Pressable>
            );
          })}
        </View>


        {/* 4. Viaje */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>4</Text></View>
          <Text style={styles.sectionLabel}>Fecha y Horario</Text>
        </View>

        <Pressable style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>📅 {formatDate(date)}</Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}

        <View style={{ marginTop: 12 }}>
          {viajes.map((v) => {
            const isSelected = selectedViaje?.id_viaje === v.id_viaje;
            const disp = v.embarcacion.capacidad_maxima - (cupos[v.id_viaje] ?? 0);
            const isFull = disp <= 0;
            return (
              <Pressable
                key={v.id_viaje}
                disabled={isFull}
                style={[styles.tripItem, isSelected && styles.tripItemSelected, isFull && { opacity: 0.4 }]}
                onPress={() => setSelectedViaje(v)}
              >
                <View>
                  <Text style={styles.tripTime}>{format12h(v.hora_salida_programada)}</Text>
                  <Text style={styles.tripBoat}>{v.embarcacion.nombre}</Text>
                </View>
                <Text style={styles.tripSpots}>{isFull ? 'Agotado' : `${disp} disp.`}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLab}>Total a Pagar</Text>
            <Text style={styles.summaryVal}>${total.toLocaleString()} MXN</Text>
          </View>
          <Pressable 
            style={[styles.confirmBtn, (saving || !selectedViaje) && { opacity: 0.6 }]} 
            onPress={handleReservar}
            disabled={saving || !selectedViaje}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Finalizar Registro</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: PerlaColors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.onSurface },
  screenSubtitle: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 16 },
  sectionNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: PerlaColors.tertiary, alignItems: 'center', justifyContent: 'center' },
  sectionNumberText: { color: PerlaColors.onTertiary, fontSize: 12, fontWeight: 'bold' },
  sectionLabel: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onSurface },

  fieldCard: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 12 },
  fieldLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 8 },
  textInput: { backgroundColor: PerlaColors.surfaceContainer, borderRadius: 10, padding: 12, color: PerlaColors.onSurface, fontFamily: 'Manrope' },

  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  counterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 20, color: PerlaColors.onSurface },
  counterInput: { fontSize: 24, color: PerlaColors.tertiary, width: 60, fontWeight: 'bold' },

  packageList: { gap: 8 },
  packageItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, borderWidth: 1, borderColor: 'transparent' },
  packageItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  packageName: { fontFamily: 'Manrope-Medium', color: PerlaColors.onSurfaceVariant },
  packageNameSelected: { color: PerlaColors.tertiary, fontWeight: 'bold' },
  packagePrice: { fontFamily: 'Newsreader', fontSize: 18, color: PerlaColors.onSurface },

  datePickerBtn: { backgroundColor: PerlaColors.surfaceContainerLow, padding: 16, borderRadius: 12, alignItems: 'center' },
  dateText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurface },

  tripItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  tripItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  tripTime: { fontFamily: 'Newsreader-Bold', fontSize: 18, color: PerlaColors.onSurface },
  tripBoat: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  tripSpots: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.tertiary },

  summary: { marginTop: 32, padding: 20, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 20, borderTopWidth: 1, borderTopColor: PerlaColors.outlineVariant },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  summaryLab: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant },
  summaryVal: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.tertiary },
  confirmBtn: { backgroundColor: PerlaColors.tertiary, padding: 18, borderRadius: 14, alignItems: 'center' },
  confirmBtnText: { color: PerlaColors.onTertiary, fontWeight: 'bold', fontSize: 16 },

  /* Payment Methods */
  paymentMethods: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  paymentBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  paymentBtnActive: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  paymentBtnText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurfaceVariant, fontSize: 14 },
  paymentBtnTextActive: { color: PerlaColors.tertiary },
});
