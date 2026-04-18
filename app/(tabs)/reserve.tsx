import { useState, useMemo, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { PerlaColors } from '@/constants/theme';

/* ────────────────────────────────────────────────────────────
   Types & Constants
   ──────────────────────────────────────────────────────────── */

type PackageId = 'comida' | 'bebidas' | 'paseo';
type PaymentMethod = 'efectivo' | 'tarjeta';
type AccountType = 'debito' | 'credito';

interface Package {
  id: PackageId;
  name: string;
  description: string;
  price: number;
  icon: string;
}

const PACKAGES: Package[] = [
  { id: 'comida', name: 'Paquete Completo', description: 'Paseo + Comida Incluida', price: 450, icon: '🍽️' },
  { id: 'bebidas', name: 'Paquete Fiesta', description: 'Paseo + Solo Bebidas', price: 350, icon: '🍹' },
  { id: 'paseo', name: 'Paseo Básico', description: 'Solo Paseo por la bahía', price: 250, icon: '🧭' },
];

const DISCOUNT_THRESHOLD = 5;
const DISCOUNT_RATE = 0.10;

/* ────────────────────────────────────────────────────────────
   Reservation Screen
   ──────────────────────────────────────────────────────────── */

export default function ReservarScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ paquete?: string; bebida?: string }>();

  /* ─── Form state ───────────────────────────────────────── */
  const initialPkg: PackageId =
    params.paquete === 'comida' || params.paquete === 'bebidas' || params.paquete === 'paseo'
      ? params.paquete
      : 'comida';
  const [selectedPackage, setSelectedPackage] = useState<PackageId>(initialPkg);
  const [personas, setPersonas] = useState<string>('1');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  /* ─── Date state ───────────────────────────────────────── */
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // tomorrow
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  /* ─── Payment state ────────────────────────────────────── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('debito');

  /* ─── Derived values ───────────────────────────────────── */
  const personasNum = useMemo(() => {
    const n = parseInt(personas, 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }, [personas]);

  const selectedPkg = useMemo(
    () => PACKAGES.find((p) => p.id === selectedPackage)!,
    [selectedPackage]
  );

  const hasDiscount = personasNum >= DISCOUNT_THRESHOLD;

  const subtotal = selectedPkg.price * personasNum;
  const discount = hasDiscount ? subtotal * DISCOUNT_RATE : 0;
  const total = subtotal - discount;

  /* ─── Handlers ─────────────────────────────────────────── */
  const onDateChange = useCallback(
    (_event: DateTimePickerEvent, selected?: Date) => {
      setShowDatePicker(Platform.OS === 'ios'); // iOS keeps it open
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

  const handleReservar = useCallback(() => {
    if (!nombre.trim()) {
      Alert.alert('Dato requerido', 'Por favor ingresa tu nombre.');
      return;
    }
    if (!telefono.trim() || telefono.length < 10) {
      Alert.alert('Dato requerido', 'Por favor ingresa un teléfono válido (10 dígitos).');
      return;
    }
    if (paymentMethod === 'tarjeta' && accountNumber.length < 10) {
      Alert.alert('Dato requerido', 'Por favor ingresa un número de cuenta válido.');
      return;
    }

    const bebidaLabel = params.bebida
      ? { mojito: 'Mojito', pinacolada: 'Piña Colada', margarita: 'Margarita', cerveza: 'Cerveza', ron: 'Ron Añejo' }[params.bebida] || ''
      : '';

    Alert.alert(
      '¡Reservación Exitosa! 🏴‍☠️',
      `Paquete: ${selectedPkg.name}${bebidaLabel ? `\nBebida reservada: ${bebidaLabel}` : ''}\nPersonas: ${personasNum}\nFecha: ${formatDate(date)}\nTotal: $${total.toFixed(0)} MXN\nPago: ${paymentMethod === 'efectivo' ? 'Efectivo' : 'Tarjeta'}\n\n¡Bienvenido a bordo, ${nombre.trim()}!`,
      [{ text: 'Aceptar' }]
    );
  }, [nombre, telefono, paymentMethod, accountNumber, selectedPkg, personasNum, date, total, formatDate]);

  /* ─── Increment / Decrement helpers ────────────────────── */
  const incrementPersonas = () => setPersonas(String(Math.min(personasNum + 1, 50)));
  const decrementPersonas = () => setPersonas(String(Math.max(personasNum - 1, 1)));

  /* ── Render ────────────────────────────────────────────── */
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

        {PACKAGES.map((pkg) => {
          const isSelected = selectedPackage === pkg.id;
          return (
            <Pressable
              key={pkg.id}
              style={[
                styles.packageOption,
                isSelected && styles.packageOptionSelected,
              ]}
              onPress={() => setSelectedPackage(pkg.id)}
            >
              <View style={styles.packageLeft}>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.packageName}>
                    {pkg.icon}  {pkg.name}
                  </Text>
                  <Text style={styles.packageDesc}>{pkg.description}</Text>
                </View>
              </View>
              <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                ${pkg.price}
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
        {Platform.OS === 'web' ? (
          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Fecha de Reservación</Text>
            <TextInput
              style={styles.textInput}
              value={date.toISOString().split('T')[0]}
              onChangeText={(text) => {
                const d = new Date(text + 'T12:00:00');
                if (!isNaN(d.getTime())) setDate(d);
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={PerlaColors.onSurfaceVariant + '80'}
            />
          </View>
        ) : (
          <>
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

            {/* Android date picker (modal) */}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}

            {/* iOS date picker (inline) */}
            {showDatePicker && Platform.OS === 'ios' && (
              <Modal transparent animationType="slide">
                <View style={styles.iosPickerOverlay}>
                  <View style={styles.iosPickerContainer}>
                    <View style={styles.iosPickerHeader}>
                      <Text style={styles.iosPickerTitle}>Seleccionar Fecha</Text>
                      <Pressable onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.iosPickerDone}>Listo</Text>
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date()}
                      onChange={onDateChange}
                      themeVariant="dark"
                    />
                  </View>
                </View>
              </Modal>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════
            SECTION 3: Datos del Cliente
            ════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionNumber}>3</Text>
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
            SECTION 4: Método de Pago
            ════════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionNumber}>4</Text>
          <Text style={styles.sectionLabel}>Método de Pago</Text>
        </View>

        <View style={styles.paymentToggleRow}>
          <Pressable
            style={[
              styles.paymentToggle,
              paymentMethod === 'efectivo' && styles.paymentToggleActive,
            ]}
            onPress={() => setPaymentMethod('efectivo')}
          >
            <Text style={styles.paymentToggleIcon}>💵</Text>
            <Text
              style={[
                styles.paymentToggleText,
                paymentMethod === 'efectivo' && styles.paymentToggleTextActive,
              ]}
            >
              Efectivo
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.paymentToggle,
              paymentMethod === 'tarjeta' && styles.paymentToggleActive,
            ]}
            onPress={() => setPaymentMethod('tarjeta')}
          >
            <Text style={styles.paymentToggleIcon}>💳</Text>
            <Text
              style={[
                styles.paymentToggleText,
                paymentMethod === 'tarjeta' && styles.paymentToggleTextActive,
              ]}
            >
              Tarjeta
            </Text>
          </Pressable>
        </View>

        {paymentMethod === 'efectivo' && (
          <View style={styles.paymentNote}>
            <Text style={styles.paymentNoteIcon}>ℹ️</Text>
            <Text style={styles.paymentNoteText}>
              El pago en efectivo se realizará al momento de abordar el barco.
            </Text>
          </View>
        )}

        {paymentMethod === 'tarjeta' && (
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

            <Text style={[styles.fieldLabel, { marginBottom: 8, marginTop: 4 }]}>
              Tipo de Cuenta
            </Text>
            <View style={styles.accountTypeRow}>
              <Pressable
                style={[
                  styles.accountTypeBtn,
                  accountType === 'debito' && styles.accountTypeBtnActive,
                ]}
                onPress={() => setAccountType('debito')}
              >
                <Text
                  style={[
                    styles.accountTypeBtnText,
                    accountType === 'debito' && styles.accountTypeBtnTextActive,
                  ]}
                >
                  Débito
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.accountTypeBtn,
                  accountType === 'credito' && styles.accountTypeBtnActive,
                ]}
                onPress={() => setAccountType('credito')}
              >
                <Text
                  style={[
                    styles.accountTypeBtnText,
                    accountType === 'credito' && styles.accountTypeBtnTextActive,
                  ]}
                >
                  Crédito
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════
            RESUMEN & CTA
            ════════════════════════════════════════════════ */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen de Reservación</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{selectedPkg.icon}  {selectedPkg.name}</Text>
            <Text style={styles.summaryValue}>${selectedPkg.price} × {personasNum}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toLocaleString()} MXN</Text>
          </View>

          {params.bebida && selectedPackage === 'bebidas' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>🍸  Bebida reservada</Text>
              <Text style={[styles.summaryValue, { color: PerlaColors.tertiary }]}>
                {{ mojito: 'Mojito', pinacolada: 'Piña Colada', margarita: 'Margarita', cerveza: 'Cerveza', ron: 'Ron Añejo' }[params.bebida] || params.bebida}
              </Text>
            </View>
          )}

          {hasDiscount && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#4ade80' }]}>Descuento 10%</Text>
              <Text style={[styles.summaryValue, { color: '#4ade80' }]}>
                -${discount.toLocaleString()} MXN
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toLocaleString()} MXN</Text>
          </View>
        </View>

        {/* Main CTA */}
        <Pressable style={styles.reserveButton} onPress={handleReservar}>
          <Text style={styles.reserveButtonText}>
            ⚓  Confirmar Reservación
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PerlaColors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  /* ── Screen Header ─────────────────────────────────────── */
  screenTitle: {
    fontFamily: 'Newsreader',
    fontSize: 34,
    color: PerlaColors.onSurface,
    marginBottom: 6,
  },
  screenSubtitle: {
    fontFamily: 'Manrope',
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 28,
  },

  /* ── Section headers ───────────────────────────────────── */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    marginBottom: 16,
  },
  sectionNumber: {
    fontFamily: 'Newsreader',
    fontSize: 18,
    color: PerlaColors.onTertiary,
    backgroundColor: PerlaColors.tertiary,
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    lineHeight: 32,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 18,
    color: PerlaColors.onSurface,
    letterSpacing: 0.3,
  },

  /* ── Package Options ───────────────────────────────────── */
  packageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  packageOptionSelected: {
    borderColor: PerlaColors.tertiary + '80',
    backgroundColor: PerlaColors.surfaceContainer,
  },
  packageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: PerlaColors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: PerlaColors.tertiary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PerlaColors.tertiary,
  },
  packageName: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: PerlaColors.onSurface,
    marginBottom: 2,
  },
  packageDesc: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  packagePrice: {
    fontFamily: 'Newsreader',
    fontSize: 22,
    color: PerlaColors.onSurfaceVariant,
    marginLeft: 8,
  },
  packagePriceSelected: {
    color: PerlaColors.tertiary,
  },

  /* ── Field Cards ───────────────────────────────────────── */
  fieldCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  /* ── Counter ───────────────────────────────────────────── */
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  counterBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: PerlaColors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 24,
    color: PerlaColors.onSurface,
  },
  counterInput: {
    fontFamily: 'Newsreader',
    fontSize: 36,
    color: PerlaColors.tertiary,
    minWidth: 60,
    textAlign: 'center',
  },

  /* ── Discount badge ────────────────────────────────────── */
  discountBadge: {
    marginTop: 14,
    backgroundColor: '#4ade80' + '1A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  discountBadgeText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: '#4ade80',
    textAlign: 'center',
  },

  /* ── Date picker ───────────────────────────────────────── */
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PerlaColors.surfaceContainerHighest,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateIcon: {
    fontSize: 20,
  },
  dateText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 15,
    color: PerlaColors.onSurface,
    textTransform: 'capitalize',
    flex: 1,
  },

  /* iOS picker modal */
  iosPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iosPickerContainer: {
    backgroundColor: PerlaColors.surfaceContainer,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: PerlaColors.outlineVariant + '26',
  },
  iosPickerTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 17,
    color: PerlaColors.onSurface,
  },
  iosPickerDone: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: PerlaColors.tertiary,
  },

  /* ── Text Input ────────────────────────────────────────── */
  textInput: {
    fontFamily: 'Manrope',
    fontSize: 16,
    color: PerlaColors.onSurface,
    backgroundColor: PerlaColors.surfaceContainerHighest,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '26',
  },

  /* ── Payment Toggle ────────────────────────────────────── */
  paymentToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  paymentToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 16,
    paddingVertical: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  paymentToggleActive: {
    borderColor: PerlaColors.tertiary + '80',
    backgroundColor: PerlaColors.surfaceContainer,
  },
  paymentToggleIcon: {
    fontSize: 24,
  },
  paymentToggleText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: PerlaColors.onSurfaceVariant,
  },
  paymentToggleTextActive: {
    color: PerlaColors.onSurface,
  },

  /* ── Payment note ──────────────────────────────────────── */
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: PerlaColors.primaryContainer + '40',
    borderRadius: 12,
    padding: 16,
  },
  paymentNoteIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  paymentNoteText: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: PerlaColors.primary,
    flex: 1,
    lineHeight: 20,
  },

  /* ── Card fields ───────────────────────────────────────── */
  cardFields: {
    marginBottom: 4,
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  accountTypeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  accountTypeBtnActive: {
    borderColor: PerlaColors.tertiary + '80',
    backgroundColor: PerlaColors.surfaceContainer,
  },
  accountTypeBtnText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
  },
  accountTypeBtnTextActive: {
    color: PerlaColors.onSurface,
  },

  /* ── Summary Card ──────────────────────────────────────── */
  summaryCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    padding: 24,
    marginTop: 32,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '26',
  },
  summaryTitle: {
    fontFamily: 'Newsreader',
    fontSize: 22,
    color: PerlaColors.onSurface,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },
  summaryValue: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    color: PerlaColors.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: PerlaColors.outlineVariant + '33',
    marginVertical: 14,
  },
  totalLabel: {
    fontFamily: 'Manrope-Bold',
    fontSize: 18,
    color: PerlaColors.onSurface,
  },
  totalValue: {
    fontFamily: 'Newsreader',
    fontSize: 28,
    color: PerlaColors.tertiary,
  },

  /* ── CTA Button ────────────────────────────────────────── */
  reserveButton: {
    backgroundColor: PerlaColors.tertiary,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: PerlaColors.tertiary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  reserveButtonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 18,
    color: PerlaColors.onTertiary,
    letterSpacing: 0.5,
  },
});
