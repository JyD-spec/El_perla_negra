import { useState, useEffect, useCallback, useMemo, createElement } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { obtenerViajesDelDia, obtenerCupoViaje } from '@/src/services/viajes.service';
import { crearReservacion } from '@/src/services/reservaciones.service';
import { registrarPago } from '@/src/services/pagos.service';
import { supabase } from '@/src/lib/supabase';
import type { Paquete, Viaje } from '@/src/lib/database.types';
import { format12h } from '@/src/lib/time';

/* ────────────────────────────────────────────────────────────
   Vendedor – Panel de Venta Rápida
   Wizard: Viaje → Paquete → Cliente → Pago → Confirmación
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };

type Step = 'viaje' | 'paquete' | 'cliente' | 'pago' | 'confirmacion';

export default function VendedorPanelScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('viaje');
  const [viajes, setViajes] = useState<ViajeConEmb[]>([]);
  const [cupos, setCupos] = useState<Record<number, number>>({});
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selections
  const [selectedViaje, setSelectedViaje] = useState<ViajeConEmb | null>(null);
  const [selectedPaquete, setSelectedPaquete] = useState<Paquete | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta'>('Efectivo');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Débito');

  // Result
  const [pinGenerado, setPinGenerado] = useState<string | null>(null);

  /* ── Date Carousel State ──────────────────────── */
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchText, setSearchText] = useState('');

  const getLocalDateString = useCallback((d: Date) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  }, []);

  // Fetch Packages once
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('paquete').select('*');
        setPaquetes((data as Paquete[]) ?? []);
      } catch (err) { console.error(err); }
    })();
  }, []);

  // Fetch Trips on Date changes
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const dateStr = getLocalDateString(selectedDate);
        const viajesData = await obtenerViajesDelDia(dateStr);
        setViajes(viajesData as ViajeConEmb[]);

        const cupoResults = await Promise.all(
          viajesData.map(v => obtenerCupoViaje(v.id_viaje).then(c => ({ id: v.id_viaje, cupo: c })))
        );
        const m: Record<number, number> = {};
        cupoResults.forEach(r => { m[r.id] = r.cupo; });
        setCupos(m);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [selectedDate, getLocalDateString]);

  // Compute active trips: all trips that haven't departed yet
  const activeTripsList = useMemo(() => {
    return viajes
      .filter(v => ['Programado', 'Retrasado', 'Abordando'].includes(v.estado_viaje ?? 'Programado'))
      .sort((a, b) => a.hora_salida_programada.localeCompare(b.hora_salida_programada));
  }, [viajes]);

  const filteredTrips = useMemo(() => {
    if (!searchText) return activeTripsList;
    const lowerSearch = searchText.toLowerCase();
    return activeTripsList.filter(v => 
      v.embarcacion.nombre.toLowerCase().includes(lowerSearch) ||
      format12h(v.hora_salida_programada).toLowerCase().includes(lowerSearch)
    );
  }, [activeTripsList, searchText]);

  const cantNum = parseInt(cantidad) || 1;
  const subtotal = (selectedPaquete?.costo_persona ?? 0) * cantNum;

  /* ── Submit Sale ──────────────────────────────── */
  const handleSubmit = async () => {
    if (!selectedViaje || !selectedPaquete || !nombre.trim() || !telefono.trim()) return;
    setSaving(true);
    try {
      // 1. Create reservation
      const res = await crearReservacion({
        nombreCliente: nombre.trim(),
        telefono: telefono.trim(),
        idPaquete: selectedPaquete.id_paquete,
        idViaje: selectedViaje.id_viaje,
        cantidadPersonas: cantNum,
        idVendedor: user?.id,
      });

      // 2. Register payment immediately
      await registrarPago({
        id_reservacion: res.id_reservacion,
        monto_pagado: res.total_pagar,
        metodo_pago: metodoPago,
        numero_cuenta: metodoPago === 'Tarjeta' ? numeroCuenta : null,
        tipo_cuenta: metodoPago === 'Tarjeta' ? tipoCuenta : null,
      });

      // 3. Fetch the updated reservation to get PIN
      const { data: updated } = await supabase
        .from('reservacion')
        .select('pin_verificacion')
        .eq('id_reservacion', res.id_reservacion)
        .single();

      setPinGenerado(updated?.pin_verificacion ?? res.pin_verificacion ?? '------');
      setStep('confirmacion');
    } catch (err: any) {
      Alert.alert('Error en la Venta', err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep('viaje');
    setSelectedViaje(null);
    setSelectedPaquete(null);
    setNombre('');
    setTelefono('');
    setCantidad('1');
    setMetodoPago('Efectivo');
    setNumeroCuenta('');
    setPinGenerado(null);
  };

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
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Venta Rápida</Text>

      {/* ── Progress ──────────────────────────────── */}
      <View style={styles.progressRow}>
        {['viaje', 'paquete', 'cliente', 'pago'].map((s, i) => {
          const stepOrder = ['viaje', 'paquete', 'cliente', 'pago', 'confirmacion'];
          const currentIdx = stepOrder.indexOf(step);
          const thisIdx = i;
          const isDone = thisIdx < currentIdx;
          const isActive = s === step;
          return (
            <View key={s} style={styles.progressItem}>
              <View style={[
                styles.progressDot,
                isDone && styles.progressDotDone,
                isActive && styles.progressDotActive,
              ]}>
                <Text style={styles.progressDotText}>
                  {isDone ? '✓' : String(i + 1)}
                </Text>
              </View>
              <Text style={[styles.progressLabel, isActive && styles.progressLabelActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Step 1: Viaje ─────────────────────────── */}
      {step === 'viaje' && (
        <View>
          {/* Carousel */}
          <View style={styles.carouselHeader}>
            <Pressable 
              disabled={getLocalDateString(selectedDate) <= getLocalDateString(new Date())}
              style={({pressed}) => [
                styles.carouselBtn, 
                (pressed || getLocalDateString(selectedDate) <= getLocalDateString(new Date())) && { opacity: 0.3 }
              ]}
              onPress={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d);
              }}
            >
              <Text style={styles.carouselBtnText}>‹</Text>
            </Pressable>

            <View style={styles.carouselCenter}>
              <Text style={styles.stepTitle}>Selecciona el Viaje</Text>
              
              {/* Nav Date Picker */}
              {Platform.OS === 'web' ? (
                <View style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
                  {createElement('input', {
                    type: 'date',
                    value: getLocalDateString(selectedDate),
                    min: getLocalDateString(new Date()),
                    onChange: (e: any) => {
                      const val = e.target.value;
                      if (val) {
                        const [y, m, d] = val.split('-').map(Number);
                        const newDate = new Date(selectedDate);
                        newDate.setFullYear(y, m - 1, d);
                        setSelectedDate(newDate);
                      }
                    },
                    onClick: (e: any) => { try { if (e.target.showPicker) e.target.showPicker(); } catch (err) {} },
                    style: { width: '100%', height: '100%', cursor: 'pointer' }
                  })}
                </View>
              ) : (
                <Pressable onPress={() => setShowDatePicker(true)} style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 10 }} />
              )}

              <Text style={styles.subtitle}>
                {selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                <Text style={{ fontSize: 10, color: PerlaColors.onSurfaceVariant }}>  ▼</Text>
              </Text>
            </View>

            <Pressable 
              style={({pressed}) => [styles.carouselBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d);
              }}
            >
              <Text style={styles.carouselBtnText}>›</Text>
            </Pressable>
          </View>

          {Platform.OS !== 'web' && showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={(e, d) => {
                setShowDatePicker(false);
                if (d) setSelectedDate(d);
              }}
            />
          )}

          {activeTripsList.length > 0 && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar barco u hora..."
                placeholderTextColor={PerlaColors.onSurfaceVariant + "80"}
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchText !== '' && (
                <Pressable onPress={() => setSearchText('')} style={styles.clearSearch}>
                  <Text style={{ color: PerlaColors.onSurfaceVariant, fontSize: 18 }}>✕</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Listado */}
          {activeTripsList.length === 0 && (
            <Text style={{ color: PerlaColors.onSurfaceVariant, textAlign: 'center', marginTop: 24, fontFamily: 'Manrope' }}>
              No hay viajes disponibles o próximos para el día seleccionado.
            </Text>
          )}

          {filteredTrips.map(v => {
            const ocu = cupos[v.id_viaje] ?? 0;
            const disp = v.embarcacion.capacidad_maxima - ocu;
            return (
              <Pressable
                key={v.id_viaje}
                style={[styles.optionCard, selectedViaje?.id_viaje === v.id_viaje && styles.optionCardActive]}
                onPress={() => { setSelectedViaje(v); setStep('paquete'); }}
              >
                <Text style={styles.optionMain}>🕐 {format12h(v.hora_salida_programada)}</Text>
                <Text style={styles.optionSub}>{v.embarcacion.nombre}</Text>
                <Text style={[styles.optionTag, disp <= 0 && { color: '#EF5350' }]}>
                  {disp > 0 ? `${disp} lugares` : 'LLENO'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ── Step 2: Paquete ────────────────────────── */}
      {step === 'paquete' && (
        <View>
          <Text style={styles.stepTitle}>Selecciona el Paquete</Text>
          {paquetes.map(p => (
            <Pressable
              key={p.id_paquete}
              style={[styles.optionCard, selectedPaquete?.id_paquete === p.id_paquete && styles.optionCardActive]}
              onPress={() => { setSelectedPaquete(p); setStep('cliente'); }}
            >
              <Text style={styles.optionMain}>{p.descripcion}</Text>
              <Text style={[styles.optionTag, { color: PerlaColors.tertiary }]}>
                ${p.costo_persona}/persona
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.backBtn} onPress={() => setStep('viaje')}>
            <Text style={styles.backBtnText}>← Cambiar viaje</Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 3: Cliente ────────────────────────── */}
      {step === 'cliente' && (
        <View>
          <Text style={styles.stepTitle}>Datos del Cliente</Text>
          <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del cliente" placeholderTextColor={PerlaColors.onSurfaceVariant + '50'} />
          <Text style={styles.fieldLabel}>TELÉFONO</Text>
          <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="10 dígitos" keyboardType="phone-pad" maxLength={10} placeholderTextColor={PerlaColors.onSurfaceVariant + '50'} />
          <Text style={styles.fieldLabel}>CANTIDAD DE PERSONAS</Text>
          <TextInput style={styles.input} value={cantidad} onChangeText={setCantidad} keyboardType="number-pad" placeholderTextColor={PerlaColors.onSurfaceVariant + '50'} />

          <Pressable
            style={[styles.nextBtn, (!nombre.trim() || !telefono.trim()) && { opacity: 0.4 }]}
            onPress={() => setStep('pago')}
            disabled={!nombre.trim() || !telefono.trim()}
          >
            <Text style={styles.nextBtnText}>Continuar al Pago →</Text>
          </Pressable>
          <Pressable style={styles.backBtn} onPress={() => setStep('paquete')}>
            <Text style={styles.backBtnText}>← Cambiar paquete</Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 4: Pago ──────────────────────────── */}
      {step === 'pago' && (
        <View>
          <Text style={styles.stepTitle}>Método de Pago</Text>

          {/* Summary */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLine}>📋 {selectedPaquete?.descripcion}</Text>
            <Text style={styles.summaryLine}>👥 {cantNum} persona{cantNum !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryLine}>🕐 {format12h(selectedViaje?.hora_salida_programada)} — {selectedViaje?.embarcacion.nombre}</Text>
            <View style={styles.summaryDivider} />
            <Text style={styles.summaryTotal}>Total: ${subtotal.toFixed(0)} MXN</Text>
          </View>

          {/* Payment method */}
          <View style={styles.paymentRow}>
            {(['Efectivo', 'Tarjeta'] as const).map(m => (
              <Pressable
                key={m}
                style={[styles.paymentBtn, metodoPago === m && styles.paymentBtnActive]}
                onPress={() => setMetodoPago(m)}
              >
                <Text style={[styles.paymentBtnText, metodoPago === m && styles.paymentBtnTextActive]}>
                  {m === 'Efectivo' ? '💵' : '💳'} {m}
                </Text>
              </Pressable>
            ))}
          </View>

          {metodoPago === 'Tarjeta' && (
            <>
              <Text style={styles.fieldLabel}>NÚMERO DE CUENTA</Text>
              <TextInput style={styles.input} value={numeroCuenta} onChangeText={setNumeroCuenta} placeholder="Últimos 4 dígitos" keyboardType="number-pad" placeholderTextColor={PerlaColors.onSurfaceVariant + '50'} />
              <Text style={styles.fieldLabel}>TIPO DE CUENTA</Text>
              <View style={styles.paymentRow}>
                {['Débito', 'Crédito'].map(t => (
                  <Pressable
                    key={t}
                    style={[styles.paymentBtn, tipoCuenta === t && styles.paymentBtnActive]}
                    onPress={() => setTipoCuenta(t)}
                  >
                    <Text style={[styles.paymentBtnText, tipoCuenta === t && styles.paymentBtnTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Pressable
            style={[styles.sellBtn, saving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={PerlaColors.onTertiary} />
            ) : (
              <Text style={styles.sellBtnText}>💰 Registrar Venta</Text>
            )}
          </Pressable>
          <Pressable style={styles.backBtn} onPress={() => setStep('cliente')}>
            <Text style={styles.backBtnText}>← Cambiar datos</Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 5: Confirmación ────────────────── */}
      {step === 'confirmacion' && pinGenerado && (
        <View style={styles.confirmSection}>
          <Text style={styles.confirmIcon}>✅</Text>
          <Text style={styles.confirmTitle}>¡Venta Registrada!</Text>
          <Text style={styles.confirmSubtitle}>
            {nombre} — {cantNum} persona{cantNum !== 1 ? 's' : ''}
          </Text>

          <Text style={styles.pinLabel}>PIN DE ABORDAJE</Text>
          <View style={styles.pinContainer}>
            {pinGenerado.split('').map((char, i) => (
              <View key={i} style={styles.pinBox}>
                <Text style={styles.pinChar}>{char}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.confirmHint}>
            Comparta este PIN con el cliente para abordar
          </Text>

          <Pressable style={styles.newSaleBtn} onPress={resetForm}>
            <Text style={styles.newSaleBtnText}>🔄 Nueva Venta</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: 'center', justifyContent: 'center' },

  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 20 },

  /* Progress */
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, gap: 4 },
  progressItem: { alignItems: 'center', flex: 1 },
  progressDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PerlaColors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  progressDotDone: { backgroundColor: '#66BB6A' },
  progressDotActive: { backgroundColor: PerlaColors.tertiary },
  progressDotText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurface },
  progressLabel: { fontFamily: 'Manrope', fontSize: 10, color: PerlaColors.onSurfaceVariant },
  progressLabelActive: { fontFamily: 'Manrope-Bold', color: PerlaColors.tertiary },

  /* Steps */
  /* Carousel Styles */
  carouselHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  carouselBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerHigh },
  carouselBtnText: { fontSize: 24, color: PerlaColors.onSurface, lineHeight: 28 },
  carouselCenter: { alignItems: 'center', flex: 1 },
  subtitle: { fontFamily: 'Manrope-Bold', fontSize: 13, color: PerlaColors.primary, marginTop: 4, textTransform: 'capitalize' },
  stepTitle: { fontFamily: 'Newsreader', fontSize: 22, color: PerlaColors.onSurface, marginBottom: 16 },

  optionCard: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  optionCardActive: { borderColor: PerlaColors.tertiary + '60' },
  optionMain: { fontFamily: 'Manrope-Bold', fontSize: 17, color: PerlaColors.onSurface, marginBottom: 4 },
  optionSub: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  optionTag: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#66BB6A', marginTop: 6 },

  fieldLabel: {
    fontFamily: 'Manrope-SemiBold', fontSize: 11, color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.8, marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'Manrope', fontSize: 16, color: PerlaColors.onSurface,
    borderWidth: 1, borderColor: PerlaColors.outlineVariant + '25',
  },

  /* Payment */
  summaryBox: {
    backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14, padding: 16, marginBottom: 20,
  },
  summaryLine: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurface, marginBottom: 6 },
  summaryDivider: { height: 1, backgroundColor: PerlaColors.outlineVariant + '30', marginVertical: 10 },
  summaryTotal: { fontFamily: 'Newsreader-Bold', fontSize: 22, color: PerlaColors.tertiary },

  paymentRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  paymentBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12,
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  paymentBtnActive: { borderColor: PerlaColors.tertiary + '60', backgroundColor: PerlaColors.tertiary + '12' },
  paymentBtnText: { fontFamily: 'Manrope-Medium', fontSize: 14, color: PerlaColors.onSurfaceVariant },
  paymentBtnTextActive: { color: PerlaColors.tertiary, fontFamily: 'Manrope-Bold' },

  nextBtn: {
    backgroundColor: PerlaColors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  nextBtnText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onPrimary },

  sellBtn: {
    backgroundColor: PerlaColors.tertiary, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginTop: 20,
    shadowColor: PerlaColors.tertiary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  sellBtnText: { fontFamily: 'Manrope-Bold', fontSize: 17, color: PerlaColors.onTertiary },

  backBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  backBtnText: { fontFamily: 'Manrope-Medium', fontSize: 14, color: PerlaColors.primary },

  /* Confirmation */
  confirmSection: { alignItems: 'center', paddingTop: 20 },
  confirmIcon: { fontSize: 56, marginBottom: 16 },
  confirmTitle: { fontFamily: 'Newsreader', fontSize: 28, color: PerlaColors.onSurface, marginBottom: 6 },
  confirmSubtitle: { fontFamily: 'Manrope', fontSize: 15, color: PerlaColors.onSurfaceVariant, marginBottom: 28 },
  pinLabel: { fontFamily: 'Manrope-Bold', fontSize: 10, color: PerlaColors.onSurfaceVariant, letterSpacing: 2, marginBottom: 12 },
  pinContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pinBox: {
    width: 44, height: 52, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainer,
    borderWidth: 1.5, borderColor: PerlaColors.tertiary + '40', alignItems: 'center', justifyContent: 'center',
  },
  pinChar: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.tertiary },
  confirmHint: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant + '80', textAlign: 'center', marginBottom: 28 },
  newSaleBtn: {
    backgroundColor: PerlaColors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32,
  },
  newSaleBtnText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onPrimary },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '20',
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: PerlaColors.onSurface,
  },
  clearSearch: {
    padding: 8,
  },
});
