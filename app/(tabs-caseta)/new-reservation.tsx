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
  Modal,
  FlatList,
} from 'react-native';
import { useStripe } from '@/src/components/StripeWrapper';
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
import type { EstadoViaje } from '@/src/lib/database.types';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & { embarcacion: { nombre: string; capacidad_maxima: number } };
type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

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
  const [packageSelections, setPackageSelections] = useState<Record<number, number>>({});
  const [personas, setPersonas] = useState<string>('1');
  const [nombre, setNombre] = useState('');
  const [lada, setLada] = useState('+52');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countries, setCountries] = useState<{name: string, code: string, flag: string, iso: string}[]>([]);
  
  /* ─── Filtering & Pagination ────────────────────────── */
  const [boatFilter, setBoatFilter] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(4);

  // Fetch international country codes from API
  useEffect(() => {
    (async () => {
      try {
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
        console.error('Error fetching countries:', err);
        // Fallback basics if API fails
        setCountries([
          { name: 'México', code: '+52', flag: '🇲🇽', iso: 'MX' },
          { name: 'USA', code: '+1', flag: '🇺🇸', iso: 'US' },
        ]);
      }
    })();
  }, []);

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
          if (p) setPackageSelections({ [p.id_paquete]: 1 });
        } else if (paqData && paqData.length > 0) {
          setPackageSelections({ [paqData[0].id_paquete]: 1 });
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.paquete]);

  /* ─── Fetch Trips when Date changes ────────────────────── */
  const [selectedViaje, setSelectedViaje] = useState<ViajeConEmb | null>(null);
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
  
  // Auto-recognize client by phone (debounced for flexible lengths)
  useEffect(() => {
    if (telefono.length < 8) return;

    const timer = setTimeout(async () => {
      // We try searching with and without LADA to support old records
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

  const filteredViajes = useMemo(() => {
    return viajes
      .filter((v) => {
        // 1. Ocultar finalizados o cancelados (a menos que ya esté seleccionado)
        if (
          (v.estado_viaje === 'Finalizado' || v.estado_viaje === 'Cancelado') &&
          selectedViaje?.id_viaje !== v.id_viaje
        ) {
          return false;
        }

        // 2. Filtro por barco
        if (boatFilter !== 'Todas' && v.embarcacion.nombre !== boatFilter) return false;

        // 3. Filtro por búsqueda (hora o barco)
        if (searchQuery) {
          const s = searchQuery.toLowerCase();
          const matchBoat = v.embarcacion.nombre.toLowerCase().includes(s);
          const matchTime = v.hora_salida_programada.toLowerCase().includes(s);
          if (!matchBoat && !matchTime) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Priorizar "Abordando" (Activo)
        if (a.estado_viaje === 'Abordando' && b.estado_viaje !== 'Abordando') return -1;
        if (a.estado_viaje !== 'Abordando' && b.estado_viaje === 'Abordando') return 1;
        // Luego por hora
        return a.hora_salida_programada.localeCompare(b.hora_salida_programada);
      });
  }, [viajes, boatFilter, searchQuery, selectedViaje]);

  const displayedViajes = useMemo(() => {
    return filteredViajes.slice(0, pageSize);
  }, [filteredViajes, pageSize]);

  const uniqueBoats = useMemo(() => {
    const names = Array.from(new Set(viajes.map((v) => v.embarcacion.nombre)));
    return ['Todas', ...names];
  }, [viajes]);

  const personasNum = useMemo(() => {
    const n = parseInt(personas, 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }, [personas]);

  // Sync package selections only when the TOTAL number of people changes
  // This allows the user to manually move people between packages (e.g. decrease one, then increase another)
  useEffect(() => {
    if (paquetes.length === 0) return;

    const totalSelected = Object.values(packageSelections).reduce((a, b) => a + b, 0);
    const diff = personasNum - totalSelected;

    if (diff !== 0) {
      if (totalSelected === 0) {
        setPackageSelections({ [paquetes[0].id_paquete]: personasNum });
      } else {
        // Find the first package with quantity > 0 to adjust, or just the first one
        const firstId = Object.keys(packageSelections).find(id => packageSelections[Number(id)] > 0) 
                        || paquetes[0].id_paquete.toString();
        
        setPackageSelections(prev => {
          const newVal = Math.max(0, (prev[Number(firstId)] || 0) + diff);
          return { ...prev, [firstId]: newVal };
        });
      }
    }
  }, [personasNum, paquetes.length > 0]); // Only when total or packages list changes

  const subtotal = useMemo(() => {
    return Object.entries(packageSelections).reduce((acc, [id, qty]) => {
      const p = paquetes.find(x => x.id_paquete === Number(id));
      return acc + (p?.costo_persona || 0) * qty;
    }, 0);
  }, [packageSelections, paquetes]);

  const hasDiscount = personasNum >= DISCOUNT_THRESHOLD;
  const discount = hasDiscount ? subtotal * DISCOUNT_RATE : 0;
  const total = subtotal - discount;

  /* ─── Handlers ─────────────────────────────────────────── */
  const onDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setSelectedViaje(null);
    }
  };

  const adjustDate = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    
    // Validar que no sea anterior a hoy
    const today = new Date();
    today.setHours(0,0,0,0);
    if (newDate < today) return;
    
    setDate(newDate);
    setSelectedViaje(null);
  };

  const isToday = useMemo(() => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }, [date]);

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
    if (totalAsignado !== personasNum) return toast.warning('Asigna todos los paquetes.');
    if (totalAsignado === 0) return toast.warning('Selecciona al menos un paquete.');
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
        lada,
        email: email.trim(),
        paquetes: Object.entries(packageSelections)
          .filter(([_, qty]) => qty > 0)
          .map(([id, qty]) => ({ idPaquete: Number(id), cantidad: qty })),
        idViaje: selectedViaje.id_viaje,
        cantidadPersonas: personasNum,
        estadoPase: (paymentMethod === 'efectivo' || paymentMethod === 'tarjeta') ? 'Aprobado' : 'Pendiente_Caseta',
      });

      // 5. Registrar el pago
      await registrarPago({
        id_reservacion: res.id_reservacion,
        metodo_pago: paymentMethod === 'tarjeta' ? 'Stripe' : (paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'),
        monto_pagado: total,
      });

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
          <Text style={styles.fieldLabel}>Teléfono (LADA + Número)</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Pressable 
              style={[styles.textInput, { width: 95, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4 }]}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={styles.isoCode}>{countries.find(c => c.code === lada)?.iso || '??'}</Text>
              <Text style={styles.textInputText}>{lada}</Text>
            </Pressable>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Número telefónico"
              keyboardType="phone-pad"
              placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Nombre Completo</Text>
          <TextInput
            style={styles.textInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del cliente"
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
          
          {Platform.OS !== 'web' ? (
            <Pressable 
              style={[styles.paymentBtn, paymentMethod === 'tarjeta' && styles.paymentBtnActive]}
              onPress={() => setPaymentMethod('tarjeta')}
            >
              <Text style={[styles.paymentBtnText, paymentMethod === 'tarjeta' && styles.paymentBtnTextActive]}>💳 Tarjeta</Text>
            </Pressable>
          ) : (
            <View style={[styles.paymentBtn, { opacity: 0.5, backgroundColor: PerlaColors.surfaceContainer }]}>
              <Text style={[styles.paymentBtnText, { color: PerlaColors.onSurfaceVariant }]}>💳 Tarjeta (Solo Móvil)</Text>
            </View>
          )}

          <Pressable 
            style={[styles.paymentBtn, paymentMethod === 'transferencia' && styles.paymentBtnActive]}
            onPress={() => setPaymentMethod('transferencia')}
          >
            <Text style={[styles.paymentBtnText, paymentMethod === 'transferencia' && styles.paymentBtnTextActive]}>🏦 Transf.</Text>
          </Pressable>
        </View>
        {Platform.OS === 'web' && (
          <Text style={{ fontSize: 11, color: PerlaColors.onSurfaceVariant, marginTop: -8, marginBottom: 12, textAlign: 'center' }}>
            * Los pagos con tarjeta requieren la App nativa (iOS/Android)
          </Text>
        )}

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
            const qty = packageSelections[pkg.id_paquete] || 0;
            return (
              <View
                key={pkg.id_paquete}
                style={[styles.packageItem, qty > 0 && styles.packageItemSelected]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.packageName, qty > 0 && styles.packageNameSelected]}>{pkg.descripcion}</Text>
                  <Text style={styles.packagePrice}>${pkg.costo_persona}</Text>
                </View>
                
                <View style={styles.packageCounter}>
                  <Pressable 
                    style={styles.miniCounterBtn} 
                    onPress={() => setPackageSelections(prev => ({
                      ...prev,
                      [pkg.id_paquete]: Math.max(0, (prev[pkg.id_paquete] || 0) - 1)
                    }))}
                  >
                    <Text style={styles.miniCounterText}>−</Text>
                  </Pressable>
                  <Text style={styles.packageQty}>{qty}</Text>
                  <Pressable 
                    style={styles.miniCounterBtn} 
                    onPress={() => {
                      const currentTotal = Object.values(packageSelections).reduce((a, b) => a + b, 0);
                      if (currentTotal < personasNum) {
                        setPackageSelections(prev => ({
                          ...prev,
                          [pkg.id_paquete]: (prev[pkg.id_paquete] || 0) + 1
                        }));
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


        {/* 4. Fecha y Viaje */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>4</Text></View>
          <Text style={styles.sectionLabel}>Fecha y Horario</Text>
        </View>

        <View style={styles.dateSelectorRow}>
          <Pressable 
            style={[styles.dateArrow, isToday && { opacity: 0.3 }]} 
            onPress={() => adjustDate(-1)}
            disabled={isToday}
          >
            <Text style={styles.dateArrowText}>◀</Text>
          </Pressable>

          <Pressable 
            style={({ pressed }) => [styles.datePickerBtn, pressed && { opacity: 0.7 }]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>📅 {formatDate(date)}</Text>
          </Pressable>

          <Pressable style={styles.dateArrow} onPress={() => adjustDate(1)}>
            <Text style={styles.dateArrowText}>▶</Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}

        {/* ─── Filtros de Viajes ─── */}
        <View style={styles.filterBar}>
          <TextInput
            style={styles.searchBox}
            placeholder="Buscar barco u hora..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={PerlaColors.onSurfaceVariant + '60'}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boatChips}>
            {uniqueBoats.map((b) => (
              <Pressable
                key={b}
                style={[styles.chip, boatFilter === b && styles.chipActive]}
                onPress={() => setBoatFilter(b)}
              >
                <Text style={[styles.chipText, boatFilter === b && styles.chipTextActive]}>{b}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: 12 }}>
          {displayedViajes.map((v) => {
            const isSelected = selectedViaje?.id_viaje === v.id_viaje;
            const disp = v.embarcacion.capacidad_maxima - (cupos[v.id_viaje] ?? 0);
            const statusCfg = GET_STATUS_STYLE(v.estado_viaje as EstadoViaje);
            const isFull = disp <= 0;
            const isDisabled = isFull || !statusCfg.canReserve;

            return (
              <Pressable
                key={v.id_viaje}
                disabled={isDisabled}
                style={[
                  styles.tripItem, 
                  isSelected && styles.tripItemSelected, 
                  isDisabled && { opacity: 0.5 }
                ]}
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
                <Text style={styles.tripSpots}>
                  {isFull ? 'Agotado' : `${disp} disp.`}
                </Text>
              </Pressable>
            );
          })}
          
          {filteredViajes.length > pageSize && (
            <Pressable style={styles.moreBtn} onPress={() => setPageSize(prev => prev + 4)}>
              <Text style={styles.moreBtnText}>Ver más viajes (+4)</Text>
            </Pressable>
          )}
          {pageSize > 4 && (
            <Pressable style={styles.lessBtn} onPress={() => setPageSize(4)}>
              <Text style={styles.lessBtnText}>Ver menos</Text>
            </Pressable>
          )}
          {filteredViajes.length === 0 && (
            <Text style={styles.emptyText}>No hay viajes disponibles con estos filtros.</Text>
          )}
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

      {/* ─── Country Picker Modal ───────────────────── */}
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

  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 8 },
  counterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 20, color: PerlaColors.onSurface },
  counterInput: { fontSize: 24, color: PerlaColors.tertiary, minWidth: 60, fontWeight: 'bold', textAlign: 'center' },

  packageList: { gap: 8 },
  packageItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, borderWidth: 1, borderColor: 'transparent' },
  packageItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  packageName: { fontFamily: 'Manrope-Medium', color: PerlaColors.onSurfaceVariant },
  packageNameSelected: { color: PerlaColors.tertiary, fontWeight: 'bold' },
  packagePrice: { fontFamily: 'Newsreader', fontSize: 18, color: PerlaColors.onSurface },

  datePickerBtn: { flex: 1, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: PerlaColors.outlineVariant },
  dateText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurface, fontSize: 14 },
  
  dateSelectorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dateArrow: { width: 44, height: 48, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PerlaColors.outlineVariant },
  dateArrowText: { color: PerlaColors.tertiary, fontSize: 16 },

  tripItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: PerlaColors.surfaceContainerLow, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  tripItemSelected: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  tripTime: { fontFamily: 'Newsreader-Bold', fontSize: 18, color: PerlaColors.onSurface },
  tripBoat: { fontFamily: 'Manrope', fontSize: 12, color: PerlaColors.onSurfaceVariant },
  tripSpots: { fontFamily: 'Manrope-Bold', fontSize: 12, color: PerlaColors.tertiary },

  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontFamily: 'Manrope-Bold', fontSize: 9 },

  summary: { marginTop: 32, padding: 20, backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 20, borderTopWidth: 1, borderTopColor: PerlaColors.outlineVariant },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  summaryLab: { fontFamily: 'Manrope', fontSize: 14, color: PerlaColors.onSurfaceVariant },
  summaryVal: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.tertiary },
  confirmBtn: { backgroundColor: PerlaColors.tertiary, padding: 18, borderRadius: 14, alignItems: 'center' },
  confirmBtnText: { color: PerlaColors.onTertiary, fontWeight: 'bold', fontSize: 16 },

  /* Payment Methods */
  paymentMethods: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  paymentBtn: { 
    flex: 1, 
    minWidth: '30%', 
    paddingVertical: 14, 
    paddingHorizontal: 8, 
    borderRadius: 12, 
    backgroundColor: PerlaColors.surfaceContainerLow, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1, 
    borderColor: 'transparent' 
  },
  paymentBtnActive: { borderColor: PerlaColors.tertiary, backgroundColor: PerlaColors.tertiary + '08' },
  paymentBtnText: { fontFamily: 'Manrope-Bold', color: PerlaColors.onSurfaceVariant, fontSize: 13, textAlign: 'center' },
  paymentBtnTextActive: { color: PerlaColors.tertiary },

  /* Package Counter */
  packageCounter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniCounterBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: PerlaColors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' },
  miniCounterText: { fontSize: 16, color: PerlaColors.onSurface, fontWeight: 'bold' },
  packageQty: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.tertiary, minWidth: 20, textAlign: 'center' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: PerlaColors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Newsreader-Bold', fontSize: 22, color: PerlaColors.onSurface },
  modalClose: { fontSize: 24, color: PerlaColors.onSurfaceVariant },
  modalSearch: { backgroundColor: PerlaColors.surfaceContainerLow, padding: 14, borderRadius: 12, marginBottom: 16, color: PerlaColors.onSurface },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: PerlaColors.outlineVariant + '20' },
  countryFlag: { fontSize: 24, marginRight: 12 },
  countryName: { flex: 1, fontFamily: 'Manrope-Medium', fontSize: 16, color: PerlaColors.onSurface },
  countryCode: { fontFamily: 'Manrope-Bold', fontSize: 16, color: PerlaColors.tertiary },
  textInputText: { color: PerlaColors.onSurface, fontSize: 14, fontFamily: 'Manrope-Bold' },
  isoCode: { fontFamily: 'Manrope-Bold', fontSize: 13, color: PerlaColors.tertiary, marginRight: 2 },
  isoCodeItem: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.tertiary, width: 35, marginRight: 10 },

  /* Filters & Pagination */
  filterBar: { marginBottom: 12 },
  searchBox: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 12, padding: 12, color: PerlaColors.onSurface, marginBottom: 8, fontFamily: 'Manrope' },
  boatChips: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: PerlaColors.surfaceContainerLow, marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: PerlaColors.tertiary + '15', borderColor: PerlaColors.tertiary },
  chipText: { fontFamily: 'Manrope-Medium', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  chipTextActive: { color: PerlaColors.tertiary, fontWeight: 'bold' },
  moreBtn: { padding: 12, alignItems: 'center', marginTop: 8 },
  moreBtnText: { color: PerlaColors.tertiary, fontFamily: 'Manrope-Bold', fontSize: 14 },
  lessBtn: { padding: 12, alignItems: 'center', marginTop: 4 },
  lessBtnText: { color: PerlaColors.onSurfaceVariant, fontFamily: 'Manrope', fontSize: 13 },
  emptyText: { textAlign: 'center', color: PerlaColors.onSurfaceVariant, marginTop: 20, fontFamily: 'Manrope' },
});
