import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useStripe } from '@/src/components/StripeWrapper';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
type Step = 'cliente' | 'viaje' | 'paquete' | 'pago' | 'confirmacion';

const GET_STATUS_STYLE = (status: EstadoViaje) => {
  switch (status) {
    case 'Finalizado': return { label: 'FINALIZADO', color: '#94a3b8', bg: '#1e293b' };
    case 'Cancelado': return { label: 'CANCELADO', color: '#f87171', bg: '#450a0a' };
    case 'En_Navegacion': return { label: 'EN NAVEGACIÓN', color: '#60a5fa', bg: '#172554' };
    case 'Abordando': return { label: 'ABORDAJE', color: '#fbbf24', bg: '#451a03' };
    case 'Retrasado': return { label: 'RETRASADO', color: '#fb923c', bg: '#431407' };
    case 'Programado': return { label: 'PROGRAMADO', color: '#34d399', bg: '#064e3b' };
    default: return { label: String(status).toUpperCase(), color: '#94a3b8', bg: '#1e293b' };
  }
};

/* ────────────────────────────────────────────────────────────
   Vendedor – Wizard Flow (Caseta Style)
   ──────────────────────────────────────────────────────────── */

export default function VendedorWizardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  /* ─── Wizard State ─────────────────────────────────────── */
  const [step, setStep] = useState<Step>('cliente');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ─── Master Data ──────────────────────────────────────── */
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [viajes, setViajes] = useState<ViajeConEmb[]>([]);
  const [allDiscounts, setAllDiscounts] = useState<Descuento[]>([]);
  const [cupos, setCupos] = useState<Record<number, number>>({});
  
  /* ─── Filtering state ──────────────────────────────────── */
  const [boatFilter, setBoatFilter] = useState('Todas');
  const [tripSearch, setTripSearch] = useState('');

  /* ─── Form State ───────────────────────────────────────── */
  const [nombre, setNombre] = useState('');
  const [lada, setLada] = useState('+52');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countries, setCountries] = useState<{name: string, code: string, flag: string, iso: string}[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedViaje, setSelectedViaje] = useState<ViajeConEmb | null>(null);

  const [personas, setPersonas] = useState<string>('1');
  const [packageSelections, setPackageSelections] = useState<Record<number, number>>({});
  const [selectedDiscount, setSelectedDiscount] = useState<Descuento | null>(null);
  const [isManualDiscount, setIsManualDiscount] = useState(false);

  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta'>('Efectivo');
  const [numeroCuenta, setNumeroCuenta] = useState('');

  const [pinGenerado, setPinGenerado] = useState<string | null>(null);

  /* ── Initial Load ─────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const [paqRes, descRes] = await Promise.all([
          supabase.from('paquete').select('*').order('descripcion'),
          obtenerDescuentos()
        ]);
        setPaquetes(paqRes.data || []);
        setAllDiscounts(descRes || []);

        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,idd,flag,cca2');
        const data = await res.json();
        const list = data
          .map((c: any) => ({
            name: c.name.common,
            code: c.idd.root + (c.idd.suffixes?.[0] || ''),
            flag: c.flag,
            iso: c.cca2
          }))
          .filter((c: any) => c.code)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setCountries(list);

      } catch (err) {
        console.error('Error in init:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Auto-recognize Client ───────────────────────────── */
  useEffect(() => {
    if (telefono.length < 8) return;

    const timer = setTimeout(async () => {
      const fullPhone = `${lada}${telefono}`;
      const { data } = await supabase
        .from('cliente')
        .select('nombre_completo, email')
        .or(`telefono.eq.${telefono},telefono.eq.${fullPhone}`)
        .maybeSingle();
      
      if (data) {
        if (!nombre) setNombre(data.nombre_completo);
        if (!email && data.email) setEmail(data.email);
        toast.success(`Cliente reconocido: ${data.nombre_completo}`);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [telefono, lada]);

  /* ── Fetch Trips ──────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const dateStr = getLocalDateString(selectedDate);
      try {
        const data = await obtenerViajesDelDia(dateStr);
        setViajes(data as ViajeConEmb[]);
        
        const cupoResults = await Promise.all(
          data.map(v => obtenerCupoViaje(v.id_viaje).then(c => ({ id: v.id_viaje, cupo: c })))
        );
        const m: Record<number, number> = {};
        cupoResults.forEach(r => { m[r.id] = r.cupo; });
        setCupos(m);
      } catch (err) {
        console.error('Error fetching trips:', err);
      }
    })();
  }, [selectedDate]);

  /* ── Derived ───────────────────────────────────────────── */
  const personasNum = parseInt(personas) || 1;

  const filteredViajes = useMemo(() => {
    return viajes.filter(v => {
      // 1. Boat filter
      if (boatFilter !== 'Todas' && v.embarcacion.nombre !== boatFilter) return false;
      // 2. Search filter
      if (tripSearch) {
        const s = tripSearch.toLowerCase();
        const matchBoat = v.embarcacion.nombre.toLowerCase().includes(s);
        const matchTime = v.hora_salida_programada.toLowerCase().includes(s);
        if (!matchBoat && !matchTime) return false;
      }
      // 3. Status filter (Solo Programado y Abordando son visibles para vender)
      if (v.estado_viaje !== 'Programado' && v.estado_viaje !== 'Abordando') return false;

      return true;
    }).sort((a, b) => a.hora_salida_programada.localeCompare(b.hora_salida_programada));
  }, [viajes, boatFilter, tripSearch]);

  const uniqueBoats = useMemo(() => {
    const names = Array.from(new Set(viajes.map((v) => v.embarcacion.nombre)));
    return ['Todas', ...names];
  }, [viajes]);

  const subtotal = useMemo(() => {
    return Object.entries(packageSelections).reduce((acc, [id, qty]) => {
      const p = paquetes.find(x => x.id_paquete === Number(id));
      return acc + (p?.costo_persona || 0) * qty;
    }, 0);
  }, [packageSelections, paquetes]);

  useEffect(() => {
    if (isManualDiscount) return;
    const applicable = allDiscounts.filter(d => {
      if (!d.activo || !d.es_default) return false;
      
      // Rule: Minimum total tickets
      if (d.cantidad_minima_boletos && personasNum < d.cantidad_minima_boletos) return false;
      
      // Rule: Specific package requirement
      if (d.id_paquete_condicion) {
        const qty = packageSelections[Number(d.id_paquete_condicion)] || 0;
        if (qty < (d.cantidad_minima_boletos || 1)) return false;
      }

      return true;
    });
    setSelectedDiscount(applicable.sort((a, b) => Number(b.porcentaje) - Number(a.porcentaje))[0] || null);
  }, [personasNum, packageSelections, allDiscounts, isManualDiscount]);

  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0;
    return subtotal * (Number(selectedDiscount.porcentaje) / 100);
  }, [subtotal, selectedDiscount]);

  const total = subtotal - discountAmount;

  /* ── Handlers ──────────────────────────────────────────── */
  const resetForm = () => {
    setStep('cliente');
    setNombre('');
    setTelefono('');
    setEmail('');
    setLada('+52');
    setSelectedViaje(null);
    setPersonas('1');
    setPackageSelections({});
    setSelectedDiscount(null);
    setIsManualDiscount(false);
    setMetodoPago('Efectivo');
    setNumeroCuenta('');
    setPinGenerado(null);
  };

  const handleNext = () => {
    if (step === 'cliente') {
      if (!nombre.trim() || telefono.length < 10) return toast.warning('Datos de cliente incompletos');
      setStep('viaje');
    } else if (step === 'viaje') {
      if (!selectedViaje) return toast.warning('Selecciona un viaje');
      setStep('paquete');
    } else if (step === 'paquete') {
      const selectedCount = Object.values(packageSelections).reduce((a, b) => a + b, 0);
      if (selectedCount !== personasNum) return toast.warning('Asigna todos los lugares');
      setStep('pago');
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // ── Stripe flow for card payments ──
      if (metodoPago === 'Tarjeta') {
        const { data: sheetData, error: sheetError } = await supabase.functions.invoke('stripe-payment-sheet', {
          body: { amount: total, currency: 'mxn', email: email.trim(), name: nombre.trim(), phone: telefono.trim() }
        });
        if (sheetError) throw new Error(sheetError.message || 'Error al conectar con Stripe');

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'El Perla Negra',
          customerId: sheetData.customer,
          customerEphemeralKeySecret: sheetData.ephemeralKey,
          paymentIntentClientSecret: sheetData.paymentIntent,
          allowsDelayedPaymentMethods: true,
          defaultBillingDetails: { name: nombre.trim(), email: email.trim(), phone: telefono.trim() },
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
          if (presentError.code === 'Canceled') { setSaving(false); return; }
          throw presentError;
        }
      }

      // ── Create reservation (Aprobado for efectivo & tarjeta) ──
      const res = await crearReservacion({
        nombreCliente: nombre.trim(),
        telefono: telefono.trim(),
        lada,
        email: email.trim(),
        idViaje: selectedViaje!.id_viaje,
        cantidadPersonas: personasNum,
        idVendedor: user?.id,
        paquetes: Object.entries(packageSelections)
          .filter(([_, q]) => q > 0)
          .map(([id, q]) => ({ idPaquete: Number(id), cantidad: q })),
        estadoPase: 'Aprobado',
        estadoPago: 'Pagado',
      });

      await registrarPago({
        id_reservacion: res.id_reservacion,
        metodo_pago: metodoPago === 'Tarjeta' ? 'Stripe' : 'Efectivo',
        monto_pagado: total,
      });

      const { data: updated } = await supabase
        .from('reservacion')
        .select('pin_verificacion')
        .eq('id_reservacion', res.id_reservacion)
        .single();

      setPinGenerado(updated?.pin_verificacion || '------');
      setStep('confirmacion');
      toast.success('¡Venta Exitosa!');
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la venta');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={PerlaColors.tertiary} /></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.glowTop} />
      
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Venta Rápida</Text>
        
        {/* Progress Stepper */}
        {step !== 'confirmacion' && (
          <View style={styles.stepper}>
            {['cliente', 'viaje', 'paquete', 'pago'].map((s, i) => {
              const active = step === s;
              const idx = ['cliente', 'viaje', 'paquete', 'pago'].indexOf(step);
              const done = i < idx;
              return (
                <View key={s} style={styles.stepItem}>
                  <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                    <Text style={[styles.stepDotText, (active || done) && { color: '#fff' }]}>{done ? '✓' : i + 1}</Text>
                  </View>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{s.toUpperCase()}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* STEP 1: CLIENTE */}
        {step === 'cliente' && (
          <View style={styles.wizardCard}>
            <Text style={styles.stepTitle}>Información del Cliente</Text>
            
            <Text style={styles.fieldLabel}>NÚMERO DE TELÉFONO</Text>
            <View style={styles.ladaInputRow}>
              <Pressable style={styles.ladaBtn} onPress={() => setShowCountryPicker(true)}>
                <Text style={styles.ladaIso}>{countries.find(c => c.code === lada)?.iso || '??'}</Text>
                <Text style={styles.ladaCode}>{lada}</Text>
              </Pressable>
              <TextInput 
                style={[styles.input, { flex: 1 }]} 
                value={telefono} 
                onChangeText={setTelefono} 
                keyboardType="phone-pad" 
                placeholder="Número de teléfono" 
                placeholderTextColor={PerlaColors.onSurfaceVariant + '40'} 
              />
            </View>

            <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
            <TextInput 
              style={[styles.input, { marginBottom: 16 }]} 
              value={nombre} 
              onChangeText={setNombre} 
              placeholder="Ej. Juan Pérez" 
              placeholderTextColor={PerlaColors.onSurfaceVariant + '40'} 
            />

            <Text style={styles.fieldLabel}>EMAIL (OPCIONAL)</Text>
            <TextInput 
              style={[styles.input, { marginBottom: 24 }]} 
              value={email} 
              onChangeText={setEmail} 
              placeholder="cliente@email.com" 
              keyboardType="email-address" 
              autoCapitalize="none" 
              placeholderTextColor={PerlaColors.onSurfaceVariant + '40'} 
            />

            <Pressable style={[styles.nextBtn, (!nombre.trim() || telefono.length < 8) && styles.btnDisabled]} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Siguiente: Elegir Viaje →</Text>
            </Pressable>
          </View>
        )}

        {/* STEP 2: VIAJE */}
        {step === 'viaje' && (
          <View style={styles.wizardCard}>
            <Text style={styles.stepTitle}>Barco y Horario</Text>
            
            <View style={styles.dateSelectorRow}>
              <Pressable 
                style={styles.dateArrow} 
                onPress={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  if (d >= new Date(new Date().setHours(0,0,0,0))) setSelectedDate(d);
                }}
              >
                <Text style={styles.dateArrowText}>‹</Text>
              </Pressable>
              
              <Pressable style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateText}>📅 {selectedDate.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
              </Pressable>

              <Pressable 
                style={styles.dateArrow} 
                onPress={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d);
                }}
              >
                <Text style={styles.dateArrowText}>›</Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker 
                value={selectedDate} 
                mode="date" 
                display="default" 
                minimumDate={new Date()} 
                onChange={(e, d) => { setShowDatePicker(false); if(d) setSelectedDate(d); }} 
              />
            )}

            {/* Trip Filters */}
            <View style={styles.tripFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {uniqueBoats.map(b => (
                  <Pressable key={b} style={[styles.filterChip, boatFilter === b && styles.filterChipActive]} onPress={() => setBoatFilter(b)}>
                    <Text style={[styles.filterChipText, boatFilter === b && styles.filterChipTextActive]}>{b}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.searchBarMini}>
              <Text style={{ fontSize: 14 }}>🔍</Text>
              <TextInput style={styles.searchBarMiniInput} placeholder="Buscar por barco u hora..." value={tripSearch} onChangeText={setTripSearch} placeholderTextColor={PerlaColors.onSurfaceVariant + '40'} />
            </View>

            <View style={styles.tripList}>
              {filteredViajes.length === 0 && <Text style={styles.emptyText}>No hay viajes que coincidan.</Text>}
              {filteredViajes.map(v => {
                const isSelected = selectedViaje?.id_viaje === v.id_viaje;
                const status = GET_STATUS_STYLE(v.estado_viaje as EstadoViaje);
                const disp = v.embarcacion.capacidad_maxima - (cupos[v.id_viaje] ?? 0);
                
                // Solo Programado y Abordando son seleccionables
                const isSelectable = v.estado_viaje === 'Programado' || v.estado_viaje === 'Abordando';
                const isFull = disp <= 0;
                const isDisabled = isFull || !isSelectable;

                return (
                  <Pressable 
                    key={v.id_viaje} 
                    style={[styles.tripItem, isSelected && styles.tripItemSelected, isDisabled && { opacity: 0.5 }]} 
                    disabled={isDisabled}
                    onPress={() => setSelectedViaje(v)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={styles.tripTime}>{format12h(v.hora_salida_programada)}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.tripBoat}>{v.embarcacion.nombre}</Text>
                    </View>
                    <Text style={styles.tripSpots}>{!isSelectable ? 'NO DISP.' : isFull ? 'LLENO' : `${disp} disp.`}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.btnRow}>
              <Pressable style={styles.backBtn} onPress={() => setStep('cliente')}><Text style={styles.backBtnText}>Regresar</Text></Pressable>
              <Pressable style={[styles.nextBtn, !selectedViaje && styles.btnDisabled, { flex: 1 }]} onPress={handleNext}>
                <Text style={styles.nextBtnText}>Siguiente: Paquetes →</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* STEP 3: PAQUETE */}
        {step === 'paquete' && (
          <View style={styles.wizardCard}>
            <Text style={styles.stepTitle}>Paquetes y Cantidad</Text>

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Cantidad de Personas</Text>
              <View style={styles.counterRow}>
                <Pressable style={styles.counterBtn} onPress={() => setPersonas(String(Math.max(1, personasNum - 1)))}>
                  <Text style={styles.counterBtnText}>−</Text>
                </Pressable>
                <TextInput 
                  style={styles.counterInput} 
                  value={personas} 
                  onChangeText={setPersonas} 
                  keyboardType="number-pad" 
                  textAlign="center" 
                />
                <Pressable style={styles.counterBtn} onPress={() => setPersonas(String(personasNum + 1))}>
                  <Text style={styles.counterBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.packageList}>
              {paquetes.map(p => {
                const qty = packageSelections[p.id_paquete] || 0;
                return (
                  <View key={p.id_paquete} style={[styles.packageItem, qty > 0 && styles.packageItemSelected]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.packageName, qty > 0 && styles.packageNameSelected]}>{p.descripcion}</Text>
                      <Text style={styles.packagePrice}>${p.costo_persona}</Text>
                    </View>
                    <View style={styles.packageCounter}>
                      <Pressable style={styles.qtyBtn} onPress={() => setPackageSelections(prev => ({ ...prev, [p.id_paquete]: Math.max(0, qty - 1) }))}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <Pressable style={styles.qtyBtn} onPress={() => {
                        const current = Object.values(packageSelections).reduce((a, b) => a + b, 0);
                        if (current < personasNum) setPackageSelections(prev => ({ ...prev, [p.id_paquete]: qty + 1 }));
                      }}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.discountSection}>
              <Text style={styles.fieldLabel}>DESCUENTO APLICADO</Text>
              <Pressable style={styles.discountSelector} onPress={() => setIsManualDiscount(true)}>
                <Text style={styles.discountText}>
                  {selectedDiscount ? `🏷️ ${selectedDiscount.nombre} (${selectedDiscount.porcentaje}%)` : 'Sin descuento'}
                </Text>
                <Text style={styles.changeText}>Cambiar</Text>
              </Pressable>
            </View>

            <View style={styles.btnRow}>
              <Pressable style={styles.backBtn} onPress={() => setStep('viaje')}><Text style={styles.backBtnText}>Regresar</Text></Pressable>
              <Pressable style={[styles.nextBtn, { flex: 1 }]} onPress={handleNext}><Text style={styles.nextBtnText}>Siguiente: Pago →</Text></Pressable>
            </View>
          </View>
        )}

        {/* STEP 4: PAGO */}
        {step === 'pago' && (
          <View style={styles.wizardCard}>
            <Text style={styles.stepTitle}>Método de Pago</Text>

            <View style={styles.paymentToggleRow}>
              {(['Efectivo', 'Tarjeta'] as const).map(m => (
                <Pressable key={m} style={[styles.paymentToggle, metodoPago === m && styles.paymentToggleActive]} onPress={() => setMetodoPago(m)}>
                  <Text style={styles.paymentToggleIcon}>{m === 'Efectivo' ? '💵' : '💳'}</Text>
                  <Text style={[styles.paymentToggleText, metodoPago === m && { color: '#fff' }]}>{m}</Text>
                </Pressable>
              ))}
            </View>

            {metodoPago === 'Tarjeta' && Platform.OS === 'web' && (
              <Text style={{ fontSize: 11, color: PerlaColors.onSurfaceVariant, textAlign: 'center', marginBottom: 12 }}>
                * Los pagos con tarjeta requieren la App nativa (iOS/Android)
              </Text>
            )}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen de Venta</Text>
              <View style={styles.summaryRow}><Text style={styles.sumLabel}>Cliente</Text><Text style={styles.sumValue}>{nombre}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumValue}>${subtotal.toLocaleString()}</Text></View>
              {selectedDiscount && (
                <View style={styles.summaryRow}><Text style={[styles.sumLabel, { color: '#4ade80' }]}>Desc. {selectedDiscount.porcentaje}%</Text><Text style={[styles.sumValue, { color: '#4ade80' }]}>−${discountAmount.toLocaleString()}</Text></View>
              )}
              <View style={styles.sumDivider} />
              <View style={styles.summaryRow}><Text style={styles.totalLabel}>TOTAL</Text><Text style={styles.totalValue}>${total.toLocaleString()} MXN</Text></View>
            </View>

            <View style={styles.btnRow}>
              <Pressable style={styles.backBtn} onPress={() => setStep('paquete')}><Text style={styles.backBtnText}>Regresar</Text></Pressable>
              <Pressable style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>🏴‍☠️ Confirmar Venta</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* STEP 5: CONFIRMACION */}
        {step === 'confirmacion' && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmIcon}>✅</Text>
            <Text style={styles.confirmTitle}>¡Venta Registrada!</Text>
            <Text style={styles.confirmSubtitle}>El cliente ya puede abordar con su PIN</Text>
            
            <View style={styles.pinContainer}>
              {pinGenerado?.split('').map((c, i) => (
                <View key={i} style={styles.pinBox}><Text style={styles.pinChar}>{c}</Text></View>
              ))}
            </View>

            <Pressable style={styles.finishBtn} onPress={resetForm}><Text style={styles.finishBtnText}>⚓ Nueva Venta</Text></Pressable>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar País</Text>
              <Pressable onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            
            <TextInput
              style={styles.modalSearch}
              placeholder="Buscar país..."
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
            />

            <FlatList
              data={countries.filter(c => 
                c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
                c.code.includes(countrySearch) ||
                c.iso.toLowerCase().includes(countrySearch.toLowerCase())
              )}
              keyExtractor={(item) => item.name}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable 
                  style={styles.countryItem}
                  onPress={() => {
                    setLada(item.code);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.isoCodeItem}>{item.iso}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCode}>{item.code}</Text>
                </Pressable>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={isManualDiscount && step === 'paquete'} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Descuentos</Text>
              <Pressable onPress={() => setIsManualDiscount(false)}><Text style={styles.modalClose}>✕</Text></Pressable>
            </View>
            <Pressable style={styles.modalItem} onPress={() => { setSelectedDiscount(null); setIsManualDiscount(false); }}>
              <Text style={styles.modalItemText}>Sin descuento</Text>
            </Pressable>
            {allDiscounts.map(d => (
              <Pressable key={d.id_descuento} style={styles.modalItem} onPress={() => { setSelectedDiscount(d); setIsManualDiscount(false); }}>
                <Text style={styles.modalItemText}>{d.nombre} ({d.porcentaje}%)</Text>
              </Pressable>
            ))}
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.surface },
  content: { paddingHorizontal: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PerlaColors.surface },
  glowTop: {
    position: "absolute",
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: PerlaColors.tertiary + "05",
  },
  title: { fontFamily: 'Newsreader', fontSize: 34, color: PerlaColors.onSurface, marginBottom: 24 },
  
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, backgroundColor: PerlaColors.surfaceContainerLow, padding: 8, borderRadius: 16 },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: PerlaColors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stepDotActive: { backgroundColor: PerlaColors.tertiary },
  stepDotDone: { backgroundColor: '#4ade80' },
  stepDotText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurfaceVariant },
  stepLabel: { fontFamily: 'Manrope-Bold', fontSize: 9, color: PerlaColors.onSurfaceVariant },
  stepLabelActive: { color: PerlaColors.tertiary },

  wizardCard: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '15', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 2 },
  stepTitle: { fontFamily: 'Newsreader', fontSize: 24, color: PerlaColors.onSurface, marginBottom: 20 },
  
  fieldLabel: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurfaceVariant, letterSpacing: 1, marginBottom: 8 },
  input: { height: 56, backgroundColor: PerlaColors.surfaceContainer, borderRadius: 14, paddingHorizontal: 16, color: PerlaColors.onSurface, fontFamily: 'Manrope', fontSize: 16, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  ladaInputRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'center' },
  ladaBtn: { height: 56, backgroundColor: PerlaColors.surfaceContainer, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  ladaIso: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.tertiary },
  ladaCode: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.onSurface },

  nextBtn: { backgroundColor: PerlaColors.tertiary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', elevation: 4 },
  nextBtnText: { color: PerlaColors.onTertiary, fontFamily: 'Manrope-Bold', fontSize: 16 },
  btnDisabled: { opacity: 0.4 },

  dateSelectorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dateArrow: { width: 44, height: 50, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainer, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  dateArrowText: { color: PerlaColors.tertiary, fontSize: 24, lineHeight: 28 },
  datePickerBtn: { flex: 1, height: 50, backgroundColor: PerlaColors.surfaceContainer, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  dateText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurface, fontSize: 14 },

  tripList: { gap: 12, marginBottom: 24 },
  tripItem: { flexDirection: 'row', padding: 18, borderRadius: 18, backgroundColor: PerlaColors.surfaceContainer, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  tripItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  tripTime: { fontFamily: 'Newsreader', fontSize: 22, color: PerlaColors.onSurface },
  tripBoat: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  tripSpots: { fontFamily: 'Manrope-Bold', fontSize: 13, color: PerlaColors.tertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  backBtn: { paddingHorizontal: 20, justifyContent: 'center' },
  backBtnText: { color: PerlaColors.onSurfaceVariant, fontFamily: 'Manrope-Bold' },

  fieldCard: { backgroundColor: PerlaColors.surfaceContainer, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '15' },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 8 },
  counterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 20, color: PerlaColors.onSurface },
  counterInput: { fontSize: 28, color: PerlaColors.tertiary, minWidth: 60, fontWeight: 'bold', textAlign: 'center', fontFamily: 'Manrope-Bold' },

  packageList: { gap: 10, marginBottom: 24 },
  packageItem: { flexDirection: 'row', padding: 16, borderRadius: 16, backgroundColor: PerlaColors.surfaceContainer, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  packageItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  packageName: { fontFamily: 'Manrope-Medium', color: PerlaColors.onSurfaceVariant, fontSize: 15 },
  packageNameSelected: { color: PerlaColors.tertiary, fontFamily: 'Manrope-Bold' },
  packagePrice: { fontFamily: 'Newsreader', color: PerlaColors.onSurface, fontSize: 18, marginTop: 2 },
  packageCounter: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: PerlaColors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: PerlaColors.onSurface },
  qtyText: { fontFamily: 'Manrope-Bold', minWidth: 20, textAlign: 'center', fontSize: 16, color: PerlaColors.onSurface },

  discountSection: { marginBottom: 24 },
  discountSelector: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: PerlaColors.surfaceContainer, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  discountText: { fontFamily: 'Manrope-Bold', color: PerlaColors.tertiary },
  changeText: { fontSize: 12, color: PerlaColors.onSurfaceVariant },

  paymentToggleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  paymentToggle: { flex: 1, padding: 18, borderRadius: 18, backgroundColor: PerlaColors.surfaceContainer, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  paymentToggleActive: { backgroundColor: PerlaColors.tertiary, borderColor: PerlaColors.tertiary },
  paymentToggleIcon: { fontSize: 26 },
  paymentToggleText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurfaceVariant },

  summaryCard: { backgroundColor: PerlaColors.surfaceContainer, padding: 20, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  summaryTitle: { fontFamily: 'Newsreader', fontSize: 20, marginBottom: 16, color: PerlaColors.onSurface },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sumLabel: { fontSize: 13, color: PerlaColors.onSurfaceVariant, fontFamily: 'Manrope' },
  sumValue: { fontFamily: 'Manrope-Bold', fontSize: 13, color: PerlaColors.onSurface },
  sumDivider: { height: 1, backgroundColor: PerlaColors.outlineVariant + '20', marginVertical: 12 },
  totalLabel: { fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onSurface },
  totalValue: { fontFamily: 'Newsreader-Bold', fontSize: 26, color: PerlaColors.tertiary },

  submitBtn: { flex: 1, backgroundColor: PerlaColors.tertiary, borderRadius: 18, paddingVertical: 20, alignItems: 'center', elevation: 4 },
  submitBtnText: { color: PerlaColors.onTertiary, fontFamily: 'Manrope-Bold', fontSize: 18 },

  confirmCard: { alignItems: 'center', paddingTop: 60 },
  confirmIcon: { fontSize: 72, marginBottom: 24 },
  confirmTitle: { fontFamily: 'Newsreader', fontSize: 36, color: PerlaColors.onSurface },
  confirmSubtitle: { fontFamily: 'Manrope', color: PerlaColors.onSurfaceVariant, fontSize: 16, marginBottom: 40 },
  pinContainer: { flexDirection: 'row', gap: 12, marginBottom: 60 },
  pinBox: { width: 52, height: 64, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: PerlaColors.tertiary },
  pinChar: { fontSize: 32, fontFamily: 'Newsreader-Bold', color: PerlaColors.tertiary },
  finishBtn: { backgroundColor: PerlaColors.primary, paddingVertical: 20, paddingHorizontal: 48, borderRadius: 24 },
  finishBtnText: { color: '#fff', fontFamily: 'Manrope-Bold', fontSize: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: PerlaColors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, height: '75%', borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' },
  modalTitle: { fontSize: 24, fontFamily: 'Newsreader-Bold', color: PerlaColors.onSurface },
  modalClose: { fontSize: 28, color: PerlaColors.onSurfaceVariant },
  modalSearch: { backgroundColor: PerlaColors.surfaceContainerLow, padding: 16, borderRadius: 16, marginBottom: 20, color: PerlaColors.onSurface, fontFamily: 'Manrope', borderWidth: 1, borderColor: PerlaColors.outlineVariant + '15' },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: PerlaColors.outlineVariant + '10' },
  isoCodeItem: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.tertiary, width: 45 },
  countryName: { flex: 1, fontFamily: 'Manrope-Medium', fontSize: 16, color: PerlaColors.onSurface },
  countryCode: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.tertiary },
  modalItem: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: PerlaColors.outlineVariant + '10' },
  modalItemText: { fontSize: 17, color: PerlaColors.onSurface, fontFamily: 'Manrope-Medium' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: PerlaColors.surfaceContainer, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '20' },
  filterChipActive: { backgroundColor: PerlaColors.tertiary + '15', borderColor: PerlaColors.tertiary + '40' },
  filterChipText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurfaceVariant },
  filterChipTextActive: { color: PerlaColors.tertiary },
  tripFilterRow: { marginBottom: 12 },
  searchBarMini: { flexDirection: 'row', alignItems: 'center', backgroundColor: PerlaColors.surfaceContainer, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: PerlaColors.outlineVariant + '15' },
  searchBarMiniInput: { flex: 1, paddingVertical: 10, marginLeft: 8, color: PerlaColors.onSurface, fontFamily: 'Manrope', fontSize: 14 },
  emptyText: { textAlign: 'center', color: PerlaColors.onSurfaceVariant, marginTop: 24, fontFamily: 'Manrope' },
});
