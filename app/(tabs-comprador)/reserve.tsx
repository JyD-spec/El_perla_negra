import { useStripe } from '@/src/components/StripeWrapper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlowToggle } from '@/components/ui/FlowToggle';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import type { Descuento, EstadoViaje, Paquete, Viaje } from '@/src/lib/database.types';
import { supabase } from '@/src/lib/supabase';
import { format12h, getLocalDateString } from '@/src/lib/time';
import { obtenerDescuentos } from '@/src/services/catalogos.service';
import { registrarPago } from '@/src/services/pagos.service';
import { crearReservacion } from '@/src/services/reservaciones.service';
import { obtenerCupoViaje, obtenerViajesDelDia } from '@/src/services/viajes.service';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };

const GET_STATUS_STYLE = (status: EstadoViaje) => {
  switch (status) {
    case 'Finalizado': return { label: 'FINALIZADO', color: '#94a3b8', bg: '#1e293b', canReserve: false };
    case 'Cancelado': return { label: 'CANCELADO', color: '#f87171', bg: '#450a0a', canReserve: false };
    case 'En_Navegacion': return { label: 'EN NAVEGACIÓN', color: '#60a5fa', bg: '#172554', canReserve: false };
    case 'Abordando': return { label: 'ACTIVO', color: '#fbbf24', bg: '#451a03', canReserve: true };
    case 'Retrasado': return { label: 'RETRASADO', color: '#fb923c', bg: '#431407', canReserve: true };
    case 'Programado': return { label: 'PROGRAMADO', color: '#34d399', bg: '#064e3b', canReserve: true };
    default: return { label: String(status).toUpperCase(), color: '#94a3b8', bg: '#1e293b', canReserve: true };
  }
};

/* ────────────────────────────────────────────────────────────
   Comprador – Reservation Screen
   ──────────────────────────────────────────────────────────── */

export default function ReservarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, cliente } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ paquete?: string }>();

  /* ─── Data state ───────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [allDiscounts, setAllDiscounts] = useState<Descuento[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState<Descuento | null>(null);
  const [viajes, setViajes] = useState<ViajeConEmb[]>([]);
  const [cupos, setCupos] = useState<Record<number, number>>({});

  /* ─── Form state ───────────────────────────────────────── */
  const [packageSelections, setPackageSelections] = useState<Record<number, number>>({});
  const [personas, setPersonas] = useState<string>('1');
  const [email, setEmail] = useState('');

  /* ─── Date state ───────────────────────────────────────── */
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  /* ─── Initial Load & Pre-fill ──────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const [paqData, descData] = await Promise.all([
          supabase.from('paquete').select('*'),
          obtenerDescuentos()
        ]);

        setPaquetes(paqData.data || []);
        setAllDiscounts(descData || []);
        
        // Auto-select package from params
        if (params.paquete && paqData.data) {
          const p = paqData.data.find(x => x.descripcion.toLowerCase().includes(params.paquete!.toLowerCase()));
          if (p) setPackageSelections({ [p.id_paquete]: 1 });
        } else if (paqData.data && paqData.data.length > 0) {
          setPackageSelections({ [paqData.data[0].id_paquete]: 1 });
        }

        // Pre-fill email
        if (user) {
          setEmail(user.email || '');
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, cliente, params.paquete]);

  /* ─── Fetch Trips when Date changes ────────────────────── */
  const [selectedViaje, setSelectedViaje] = useState<ViajeConEmb | null>(null);
  useEffect(() => {
    (async () => {
      const formatted = getLocalDateString(date);
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

  const filteredViajes = useMemo(() => {
    return viajes
      .filter((v) => {
        // Only show Programmed or Active (Abordando) trips for clients
        if (v.estado_viaje !== 'Programado' && v.estado_viaje !== 'Abordando' && v.estado_viaje !== 'Retrasado') {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.hora_salida_programada.localeCompare(b.hora_salida_programada));
  }, [viajes]);

  const personasNum = useMemo(() => {
    const n = parseInt(personas, 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }, [personas]);

  // Sync package selections
  useEffect(() => {
    if (paquetes.length === 0) return;
    const totalSelected = Object.values(packageSelections).reduce((a, b) => a + b, 0);
    const diff = personasNum - totalSelected;
    if (diff !== 0) {
      if (totalSelected === 0) {
        setPackageSelections({ [paquetes[0].id_paquete]: personasNum });
      } else {
        const firstId = Object.keys(packageSelections).find(id => packageSelections[Number(id)] > 0) 
                        || paquetes[0].id_paquete.toString();
        setPackageSelections(prev => {
          const newVal = Math.max(0, (prev[Number(firstId)] || 0) + diff);
          return { ...prev, [firstId]: newVal };
        });
      }
    }
  }, [personasNum, paquetes.length]);

  const subtotal = useMemo(() => {
    return Object.entries(packageSelections).reduce((acc, [id, qty]) => {
      const p = paquetes.find(x => x.id_paquete === Number(id));
      return acc + (p?.costo_persona || 0) * qty;
    }, 0);
  }, [packageSelections, paquetes]);

  // Logic for automatic discount
  useEffect(() => {
    const applicable = allDiscounts.filter(d => {
      if (!d.activo || !d.es_default) return false;
      if (d.cantidad_minima_boletos && personasNum < d.cantidad_minima_boletos) return false;
      if (d.id_paquete_condicion) {
        const qty = packageSelections[Number(d.id_paquete_condicion)] || 0;
        if (qty < (d.cantidad_minima_boletos || 1)) return false;
      }
      return true;
    });
    const bestDefault = applicable.sort((a, b) => Number(b.porcentaje) - Number(a.porcentaje))[0];
    setSelectedDiscount(bestDefault || null);
  }, [personasNum, packageSelections, allDiscounts]);

  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0;
    return subtotal * (Number(selectedDiscount.porcentaje) / 100);
  }, [subtotal, selectedDiscount]);

  const total = subtotal - discountAmount;

  /* ─── Handlers ─────────────────────────────────────────── */
  const onDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

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
    const totalAsignado = Object.values(packageSelections).reduce((a, b) => a + b, 0);
    if (totalAsignado !== personasNum) return toast.warning('Asigna todos los lugares.');
    if (!cliente) return toast.error('Error al obtener tu perfil de usuario.');
    const nombre = cliente.nombre_completo;
    const telefono = cliente.telefono;
    const lada = cliente.lada || '+52';
    
    if (!selectedViaje) return toast.warning('Selecciona un horario de salida.');
    if (!email.trim()) return toast.warning('Se requiere email para el recibo.');

    const disp = selectedViaje.embarcacion.capacidad_maxima - (cupos[selectedViaje.id_viaje] ?? 0);
    if (personasNum > disp) return toast.warning(`Cupo insuficiente (Máx: ${disp}).`);

    setSaving(true);
    try {
      // 1. Stripe Payment
      const { data: sheetData, error: sheetError } = await supabase.functions.invoke('stripe-payment-sheet', {
        body: {
          amount: total,
          currency: 'mxn',
          email: email.trim(),
          name: nombre.trim(),
          phone: `${lada}${telefono}`,
        }
      });

      if (sheetError) throw new Error(sheetError.message || 'Error al conectar con Stripe');

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'El Perla Negra',
        customerId: sheetData.customer,
        customerEphemeralKeySecret: sheetData.ephemeralKey,
        paymentIntentClientSecret: sheetData.paymentIntent,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: nombre.trim(),
          email: email.trim(),
          phone: `${lada}${telefono}`,
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

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') {
          setSaving(false);
          return;
        }
        throw presentError;
      }

      // 2. Create Reservation
      const res = await crearReservacion({
        nombreCliente: nombre.trim(),
        telefono: telefono.trim(),
        lada,
        email: email.trim(),
        authId: user?.id,
        paquetes: Object.entries(packageSelections)
          .filter(([_, qty]) => qty > 0)
          .map(([id, qty]) => ({ idPaquete: Number(id), cantidad: qty })),
        idViaje: selectedViaje.id_viaje,
        cantidadPersonas: personasNum,
        estadoPase: 'Aprobado',
        estadoPago: 'Pagado',
      });

      // 3. Register Payment
      await registrarPago({
        id_reservacion: res.id_reservacion,
        metodo_pago: 'Stripe',
        monto_pagado: total,
      });

      toast.success('¡Reservación Exitosa! Bienvenido a bordo.');
      router.replace('/(tabs-comprador)/tickets');
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
        <Text style={styles.screenTitle}>Reservar Aventura</Text>
        <Text style={styles.screenSubtitle}>Prepara tu tripulación para zarpar</Text>

        <FlowToggle activeTab="reserve" />

        {/* 1. Tripulación y Paquetes */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>1</Text></View>
          <Text style={styles.sectionLabel}>Tu Tripulación</Text>
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
            const qty = packageSelections[pkg.id_paquete] || 0;
            return (
              <View key={pkg.id_paquete} style={[styles.packageItem, qty > 0 && styles.packageItemSelected]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.packageName, qty > 0 && styles.packageNameSelected]}>{pkg.descripcion}</Text>
                  <Text style={styles.packagePrice}>${pkg.costo_persona} <Text style={{ fontSize: 12 }}>MXN</Text></Text>
                </View>
                <View style={styles.packageCounter}>
                  <Pressable 
                    style={styles.miniCounterBtn} 
                    onPress={() => setPackageSelections(prev => ({ ...prev, [pkg.id_paquete]: Math.max(0, (prev[pkg.id_paquete] || 0) - 1) }))}
                  >
                    <Text style={styles.miniCounterText}>−</Text>
                  </Pressable>
                  <Text style={styles.packageQty}>{qty}</Text>
                  <Pressable 
                    style={styles.miniCounterBtn} 
                    onPress={() => {
                      const currentTotal = Object.values(packageSelections).reduce((a, b) => a + b, 0);
                      if (currentTotal < personasNum) {
                        setPackageSelections(prev => ({ ...prev, [pkg.id_paquete]: (prev[pkg.id_paquete] || 0) + 1 }));
                      } else {
                        toast.warning(`Ya asignaste los ${personasNum} lugares.`);
                      }
                    }}
                  >
                    <Text style={styles.miniCounterText}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* 2. Fecha y Horario */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>2</Text></View>
          <Text style={styles.sectionLabel}>Fecha y Horario</Text>
        </View>

        <Pressable style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>📅 {formatDate(date)}</Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker value={date} mode="date" display="default" minimumDate={new Date()} onChange={onDateChange} />
        )}

        <View style={{ marginTop: 12 }}>
          {filteredViajes.map((v) => {
            const isSelected = selectedViaje?.id_viaje === v.id_viaje;
            const disp = v.embarcacion.capacidad_maxima - (cupos[v.id_viaje] ?? 0);
            const statusCfg = GET_STATUS_STYLE(v.estado_viaje as EstadoViaje);
            const isFull = disp <= 0;

            return (
              <Pressable
                key={v.id_viaje}
                disabled={isFull}
                style={[styles.tripItem, isSelected && styles.tripItemSelected, isFull && { opacity: 0.5 }]}
                onPress={() => setSelectedViaje(v)}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.tripTime}>{format12h(v.hora_salida_programada)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.tripBoat}>{v.embarcacion.nombre}</Text>
                </View>
                <Text style={styles.tripSpots}>{isFull ? 'Agotado' : `${disp} disp.`}</Text>
              </Pressable>
            );
          })}
          {filteredViajes.length === 0 && <Text style={styles.emptyText}>No hay viajes disponibles hoy.</Text>}
        </View>

        {/* 3. Resumen y Pago */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen de Pago</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLab}>Capitán</Text>
            <Text style={styles.summaryValSmall}>{cliente?.nombre_completo || 'Tripulante'}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLab}>Teléfono</Text>
            <Text style={styles.summaryValSmall}>{cliente?.lada}{cliente?.telefono}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLab}>Subtotal</Text>
            <Text style={styles.summaryValSmall}>${subtotal.toLocaleString()} MXN</Text>
          </View>

          {selectedDiscount && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLab, { color: '#4ade80' }]}>Descuento ({selectedDiscount.nombre})</Text>
              <Text style={[styles.summaryValSmall, { color: '#4ade80' }]}>-${discountAmount.toLocaleString()} MXN</Text>
            </View>
          )}

          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabTotal}>Total</Text>
            <Text style={styles.summaryValTotal}>${total.toLocaleString()} MXN</Text>
          </View>

          <Pressable 
            style={[styles.confirmBtn, (saving || !selectedViaje) && { opacity: 0.6 }]} 
            onPress={handleReservar}
            disabled={saving || !selectedViaje}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>⚓ Pagar con Tarjeta</Text>}
          </Pressable>
          
          <Text style={styles.pagoSeguro}>🔒 Pago seguro procesado por Stripe</Text>
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20 },
  screenTitle: { fontFamily: 'Newsreader-Bold', fontSize: 32, color: PerlaColors.onSurface, marginBottom: 4 },
  screenSubtitle: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant, marginBottom: 20 },
  
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 16 },
  sectionNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: PerlaColors.tertiary, alignItems: 'center', justifyContent: 'center' },
  sectionNumberText: { color: PerlaColors.onTertiary, fontSize: 12, fontWeight: 'bold' },
  sectionLabel: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.onSurface },

  fieldCard: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 12 },
  fieldLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 12, color: PerlaColors.onSurfaceVariant, marginBottom: 8 },
  
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  counterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 20, color: PerlaColors.onSurface },
  counterInput: { fontSize: 32, color: PerlaColors.tertiary, minWidth: 60, fontWeight: 'bold', textAlign: 'center', fontFamily: 'Newsreader' },

  packageList: { gap: 8 },
  packageItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, borderWidth: 1, borderColor: 'transparent' },
  packageItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  packageName: { fontFamily: 'Manrope-SemiBold', color: PerlaColors.onSurface, fontSize: 14 },
  packageNameSelected: { color: PerlaColors.tertiary },
  packagePrice: { fontFamily: 'Newsreader', fontSize: 18, color: PerlaColors.onSurface },

  packageCounter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniCounterBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: PerlaColors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  miniCounterText: { fontSize: 14, color: PerlaColors.onSurface, fontWeight: 'bold' },
  packageQty: { fontFamily: 'Manrope-Bold', fontSize: 15, color: PerlaColors.tertiary, minWidth: 20, textAlign: 'center' },

  datePickerBtn: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: PerlaColors.outlineVariant },
  dateText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurface, fontSize: 14 },

  tripItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  tripItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  tripTime: { fontFamily: 'Newsreader-Bold', fontSize: 18, color: PerlaColors.onSurface },
  tripBoat: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  tripSpots: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.tertiary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontFamily: 'Manrope-Bold', fontSize: 9 },

  textInput: { backgroundColor: PerlaColors.surfaceContainerHighest, borderRadius: 10, padding: 12, color: PerlaColors.onSurface, fontFamily: 'Manrope' },
  ladaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PerlaColors.surfaceContainerHighest, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '33' },
  ladaBtnIso: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.tertiary },
  ladaBtnText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.onSurface },

  summaryCard: { marginTop: 32, padding: 20, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 20, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '40' },
  summaryTitle: { fontFamily: 'Newsreader-Bold', fontSize: 20, color: PerlaColors.onSurface, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLab: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant },
  summaryValSmall: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.onSurface },
  summaryLabTotal: { fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onSurface },
  summaryValTotal: { fontFamily: 'Newsreader-Bold', fontSize: 26, color: PerlaColors.tertiary },
  divider: { height: 1, backgroundColor: PerlaColors.outlineVariant + '30', marginVertical: 12 },
  confirmBtn: { backgroundColor: PerlaColors.tertiary, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  confirmBtnText: { color: PerlaColors.onTertiary, fontFamily: 'Manrope-Bold', fontSize: 15, textAlign: 'center' },
  pagoSeguro: { textAlign: 'center', fontSize: 11, color: PerlaColors.onSurfaceVariant, marginTop: 12, fontFamily: 'Manrope' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: PerlaColors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Newsreader-Bold', fontSize: 22, color: PerlaColors.onSurface },
  modalClose: { fontSize: 24, color: PerlaColors.onSurfaceVariant },
  modalSearch: { backgroundColor: PerlaColors.surfaceContainerLow, padding: 14, borderRadius: 12, marginBottom: 16, color: PerlaColors.onSurface },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: PerlaColors.outlineVariant + '20' },
  isoCodeItem: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.tertiary, width: 35, marginRight: 10 },
  countryName: { flex: 1, fontFamily: 'Manrope-Medium', fontSize: 16, color: PerlaColors.onSurface },
  countryCode: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.tertiary },
  emptyText: { textAlign: 'center', color: PerlaColors.onSurfaceVariant, marginTop: 20, fontFamily: 'Manrope' },
});
