import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { supabase } from '@/src/lib/supabase';
import { obtenerViajesDelDia, obtenerCupoViaje } from '@/src/services/viajes.service';
import { crearReservacion } from '@/src/services/reservaciones.service';
import type { Paquete, Viaje } from '@/src/lib/database.types';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };
type PaymentMethod = 'efectivo' | 'tarjeta';
type AccountType = 'debito' | 'credito';

const DISCOUNT_THRESHOLD = 5;
const DISCOUNT_RATE = 0.10;

/* ────────────────────────────────────────────────────────────
   Reservation Screen – Redesigned & Functional
   ──────────────────────────────────────────────────────────── */

export default function ReservarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ paquete?: string; bebida?: string }>();

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

  /* ─── Date state ───────────────────────────────────────── */
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  /* ─── Payment state ────────────────────────────────────── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('debito');

  /* ─── Initial Load ─────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const { data: paqData } = await supabase.from('paquete').select('*');
        setPaquetes(paqData || []);
        
        // Auto-select package if coming from params
        if (params.paquete && paqData) {
          const p = paqData.find(x => x.descripcion.toLowerCase().includes(params.paquete!.toLowerCase()));
          if (p) setSelectedPackage(p.id_paquete);
        } else if (paqData && paqData.length > 0) {
          setSelectedPackage(paqData[0].id_paquete);
        }

        // Fill user data
        if (user) {
          const { data: profile } = await supabase
            .from('cliente')
            .select('nombre_completo, telefono')
            .eq('auth_id', user.id)
            .maybeSingle();
          
          if (profile) {
            setNombre(profile.nombre_completo || '');
            setTelefono(profile.telefono || '');
          }
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, params.paquete]);

  /* ─── Fetch Trips when Date changes ────────────────────── */
  useEffect(() => {
    (async () => {
      const formatted = date.toISOString().split('T')[0];
      try {
        const viajesData = await obtenerViajesDelDia(formatted);
        setViajes(viajesData as ViajeConEmb[]);
        
        // Reset selected trip if it's not in the new list
        setSelectedViaje(null);

        // Fetch remaining spots
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

  const formatDate = useCallback((d: Date) => {
    return d.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const handleReservar = async () => {
    if (!selectedPackage) {
      toast.warning('Por favor selecciona un paquete.');
      return;
    }
    if (!selectedViaje) {
      toast.warning('Por favor selecciona un horario de salida.');
      return;
    }
    if (!nombre.trim()) {
      toast.warning('Por favor ingresa tu nombre.');
      return;
    }
    if (!telefono.trim() || telefono.length < 10) {
      toast.warning('Por favor ingresa un teléfono válido (10 dígitos).');
      return;
    }

    const disp = selectedViaje.embarcacion.capacidad_maxima - (cupos[selectedViaje.id_viaje] ?? 0);
    if (personasNum > disp) {
      toast.warning(`Cupo insuficiente. Solo quedan ${disp} lugares.`);
      return;
    }

    setSaving(true);
    try {
      await crearReservacion({
        nombreCliente: nombre.trim(),
        telefono: telefono.trim(),
        idPaquete: selectedPackage,
        idViaje: selectedViaje.id_viaje,
        cantidadPersonas: personasNum,
      });

      toast.success('¡Reservación Exitosa! Bienvenido a bordo, capitán.');
      
      setTimeout(() => {
        router.replace('/(tabs-comprador)/tickets');
      }, 2000);
    } catch (err: any) {
      toast.error('Ocurrió un error al procesar tu reservación.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Increment / Decrement helpers ────────────────────── */
  const incrementPersonas = () => setPersonas(String(Math.min(personasNum + 1, 50)));
  const decrementPersonas = () => setPersonas(String(Math.max(personasNum - 1, 1)));

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
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────── */}
        <Text style={styles.screenTitle}>Reservar Aventura</Text>
        <Text style={styles.screenSubtitle}>
          Prepara tu tripulación para zarpar
        </Text>

        {/* ════════════════════════════════════════════════
            SECTION 1: Paquete
            ════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionNumber}>1</Text>
          <Text style={styles.sectionLabel}>Elige tu Paquete</Text>
        </View>

        {paquetes.map((pkg) => {
          const isSelected = selectedPackage === pkg.id_paquete;
          return (
            <Pressable
              key={pkg.id_paquete}
              style={[
                styles.packageOption,
                isSelected && styles.packageOptionSelected,
              ]}
              onPress={() => setSelectedPackage(pkg.id_paquete)}
            >
              <View style={styles.packageLeft}>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.packageName}>
                    {pkg.descripcion.includes('Comida') ? '🍽️' : pkg.descripcion.includes('Fiesta') ? '🍹' : '🧭'}  {pkg.descripcion}
                  </Text>
                  <Text style={styles.packageDesc}>{pkg.descripcion}</Text>
                </View>
              </View>
              <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                ${pkg.costo_persona}
              </Text>
            </Pressable>
          );
        })}

        {/* ════════════════════════════════════════════════
            SECTION 2: Personas y Fecha
            ════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionNumber}>2</Text>
          <Text style={styles.sectionLabel}>Personas y Fecha</Text>
        </View>

        {/* Personas counter */}
        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Número de Personas</Text>
          <View style={styles.counterRow}>
            <Pressable style={styles.counterBtn} onPress={decrementPersonas}>
              <Text style={styles.counterBtnText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.counterInput}
              value={personas}
              onChangeText={setPersonas}
              keyboardType="number-pad"
              maxLength={2}
              textAlign="center"
            />
            <Pressable style={styles.counterBtn} onPress={incrementPersonas}>
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>
                🏷️  ¡10% de descuento aplicado!
              </Text>
            </View>
          )}
        </View>

        {/* Date picker */}
        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Fecha de Reservación</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateIcon}>📅</Text>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onDateChange}
            themeVariant="dark"
          />
        )}

        {/* ─── Trip Selection (Functional Add-on) ────── */}
        {viajes.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
              <Text style={styles.sectionNumber}>3</Text>
              <Text style={styles.sectionLabel}>Horario de Salida</Text>
            </View>
            {viajes.map((v) => {
              const isSelected = selectedViaje?.id_viaje === v.id_viaje;
              const disp = v.embarcacion.capacidad_maxima - (cupos[v.id_viaje] ?? 0);
              const isFull = disp <= 0;

              return (
                <Pressable
                  key={v.id_viaje}
                  disabled={isFull}
                  style={[
                    styles.packageOption,
                    isSelected && styles.packageOptionSelected,
                    isFull && { opacity: 0.5 }
                  ]}
                  onPress={() => setSelectedViaje(v)}
                >
                  <View style={styles.packageLeft}>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageName}>🚢 {v.hora_salida_programada.slice(0, 5)} hrs</Text>
                      <Text style={styles.packageDesc}>{v.embarcacion.nombre}</Text>
                    </View>
                  </View>
                  <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected, { fontSize: 13, fontFamily: 'Manrope' }]}>
                    {isFull ? 'Agotado' : `${disp} lugares`}
                  </Text>
                </Pressable>
              );
            })}
          </>
        ) : (
          <View style={styles.paymentNote}>
            <Text style={styles.paymentNoteIcon}>⚠️</Text>
            <Text style={styles.paymentNoteText}>No hay viajes programados para esta fecha.</Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════
            SECTION 3: Datos del Cliente (Now Section 4)
            ════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionNumber}>4</Text>
          <Text style={styles.sectionLabel}>Datos del Capitán</Text>
        </View>

        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Nombre Completo</Text>
          <TextInput
            style={styles.textInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej. Jack Sparrow"
            placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Teléfono</Text>
          <TextInput
            style={styles.textInput}
            value={telefono}
            onChangeText={setTelefono}
            placeholder="10 dígitos"
            placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        {/* ════════════════════════════════════════════════
            SECTION 4: Método de Pago (Now Section 5)
            ════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionNumber}>5</Text>
          <Text style={styles.sectionLabel}>Método de Pago</Text>
        </View>

        <View style={styles.paymentToggleRow}>
          <Pressable
            style={[styles.paymentToggle, paymentMethod === 'efectivo' && styles.paymentToggleActive]}
            onPress={() => setPaymentMethod('efectivo')}
          >
            <Text style={styles.paymentToggleIcon}>💵</Text>
            <Text style={[styles.paymentToggleText, paymentMethod === 'efectivo' && styles.paymentToggleTextActive]}>Efectivo</Text>
          </Pressable>

          <Pressable
            style={[styles.paymentToggle, paymentMethod === 'tarjeta' && styles.paymentToggleActive]}
            onPress={() => setPaymentMethod('tarjeta')}
          >
            <Text style={styles.paymentToggleIcon}>💳</Text>
            <Text style={[styles.paymentToggleText, paymentMethod === 'tarjeta' && styles.paymentToggleTextActive]}>Tarjeta</Text>
          </Pressable>
        </View>

        {paymentMethod === 'efectivo' ? (
          <View style={styles.paymentNote}>
            <Text style={styles.paymentNoteIcon}>ℹ️</Text>
            <Text style={styles.paymentNoteText}>El pago se realizará en caseta al momento de abordar para liberar tu boleto.</Text>
          </View>
        ) : (
          <View style={styles.cardFields}>
            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Número de Cuenta</Text>
              <TextInput
                style={styles.textInput}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="•••• •••• •••• ••••"
                placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
                keyboardType="number-pad"
                maxLength={16}
              />
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════
            RESUMEN & CTA
            ════════════════════════════════════════════════ */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen de Reservación</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {activePaquete?.descripcion.includes('Comida') ? '🍽️' : activePaquete?.descripcion.includes('Fiesta') ? '🍹' : '🧭'} {activePaquete?.descripcion || 'Paquete'}
            </Text>
            <Text style={styles.summaryValue}>${activePaquete?.costo_persona || 0} × {personasNum}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toLocaleString()} MXN</Text>
          </View>

          {hasDiscount && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#4ade80' }]}>Descuento 10%</Text>
              <Text style={[styles.summaryValue, { color: '#4ade80' }]}>-${discount.toLocaleString()} MXN</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toLocaleString()} MXN</Text>
          </View>
        </View>

        {/* Main CTA */}
        <Pressable 
          style={[styles.reserveButton, (saving || !selectedViaje) && styles.reserveButtonDisabled]} 
          onPress={handleReservar}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={PerlaColors.onTertiary} />
          ) : (
            <Text style={styles.reserveButtonText}>⚓ Confirmar Reservación</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20 },
  screenTitle: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 6 },
  screenSubtitle: { fontFamily: 'Manrope', fontSize: 15, color: PerlaColors.onSurfaceVariant, marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32, marginBottom: 16 },
  sectionNumber: { fontFamily: 'Newsreader', fontSize: 18, color: PerlaColors.onTertiary, backgroundColor: PerlaColors.tertiary, width: 32, height: 32, borderRadius: 16, textAlign: 'center', lineHeight: 32, overflow: 'hidden' },
  sectionLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 18, color: PerlaColors.onSurface, letterSpacing: 0.3 },
  packageOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 18, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  packageOptionSelected: { borderColor: PerlaColors.tertiary + '80', backgroundColor: PerlaColors.surfaceContainer },
  packageLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: PerlaColors.outline, alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: PerlaColors.tertiary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: PerlaColors.tertiary },
  packageName: { fontFamily: 'Manrope-SemiBold', fontSize: 15, color: PerlaColors.onSurface, marginBottom: 2 },
  packageDesc: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  packagePrice: { fontFamily: 'Newsreader', fontSize: 22, color: PerlaColors.onSurfaceVariant, marginLeft: 8 },
  packagePriceSelected: { color: PerlaColors.tertiary },
  fieldCard: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 18, marginBottom: 12 },
  fieldLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 13, color: PerlaColors.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  counterBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: PerlaColors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontFamily: 'Manrope-Bold', fontSize: 24, color: PerlaColors.onSurface },
  counterInput: { fontFamily: 'Newsreader', fontSize: 36, color: PerlaColors.tertiary, minWidth: 60, textAlign: 'center' },
  discountBadge: { marginTop: 14, backgroundColor: '#4ade801A', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'center' },
  discountBadgeText: { fontFamily: 'Manrope-SemiBold', fontSize: 13, color: '#4ade80', textAlign: 'center' },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PerlaColors.surfaceContainerHighest, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dateIcon: { fontSize: 20 },
  dateText: { fontFamily: 'Manrope-Medium', fontSize: 15, color: PerlaColors.onSurface, textTransform: 'capitalize', flex: 1 },
  textInput: { fontFamily: 'Manrope', fontSize: 16, color: PerlaColors.onSurface, backgroundColor: PerlaColors.surfaceContainerHighest, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '26' },
  paymentToggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  paymentToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, paddingVertical: 20, borderWidth: 1.5, borderColor: 'transparent' },
  paymentToggleActive: { borderColor: PerlaColors.tertiary + '80', backgroundColor: PerlaColors.surfaceContainer },
  paymentToggleIcon: { fontSize: 24 },
  paymentToggleText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: PerlaColors.onSurfaceVariant },
  paymentToggleTextActive: { color: PerlaColors.onSurface },
  paymentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: PerlaColors.primaryContainer + '40', borderRadius: 12, padding: 16 },
  paymentNoteIcon: { fontSize: 16, marginTop: 2 },
  paymentNoteText: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.primary, flex: 1, lineHeight: 20 },
  cardFields: { marginBottom: 4 },
  summaryCard: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 20, padding: 24, marginTop: 32, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '26' },
  summaryTitle: { fontFamily: 'Newsreader', fontSize: 22, color: PerlaColors.onSurface, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant },
  summaryValue: { fontFamily: 'Manrope-Medium', fontSize: 14, color: PerlaColors.onSurface },
  divider: { height: 1, backgroundColor: PerlaColors.outlineVariant + '33', marginVertical: 14 },
  totalLabel: { fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onSurface },
  totalValue: { fontFamily: 'Newsreader', fontSize: 28, color: PerlaColors.tertiary },
  reserveButton: { backgroundColor: PerlaColors.tertiary, borderRadius: 16, paddingVertical: 20, alignItems: 'center', marginTop: 24, shadowColor: PerlaColors.tertiary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  reserveButtonDisabled: { backgroundColor: PerlaColors.surfaceContainerHighest, shadowOpacity: 0, elevation: 0, opacity: 0.6 },
  reserveButtonText: { fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onTertiary, letterSpacing: 0.5 },
});
