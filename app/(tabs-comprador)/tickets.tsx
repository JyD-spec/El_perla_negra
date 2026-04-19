import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { obtenerMisReservaciones } from '@/src/services/reservaciones.service';
import type { ReservacionConDetalles, EstadoPase } from '@/src/lib/database.types';

/* ────────────────────────────────────────────────────────────
   Tickets Screen – Mis Boletos
   Shows all reservations with PIN, QR status, and pass state
   ──────────────────────────────────────────────────────────── */

/* ── Status Badge Colors ────────────────────────────────── */
const ESTADO_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  Pendiente_Caseta: {
    bg: '#FFA726' + '22',
    text: '#FFA726',
    label: 'Pendiente de Pago',
    icon: '⏳',
  },
  Aprobado: {
    bg: '#66BB6A' + '22',
    text: '#66BB6A',
    label: 'Aprobado — Listo para Abordar',
    icon: '✅',
  },
  Abordado: {
    bg: PerlaColors.tertiary + '22',
    text: PerlaColors.tertiary,
    label: '¡A Bordo!',
    icon: '🏴‍☠️',
  },
  Rechazado: {
    bg: '#EF5350' + '22',
    text: '#EF5350',
    label: 'Rechazado',
    icon: '❌',
  },
  Vencido: {
    bg: '#78909C' + '22',
    text: '#78909C',
    label: 'Vencido — Contacta Caseta',
    icon: '⚠️',
  },
};

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = require('expo-router').useRouter();

  const [reservaciones, setReservaciones] = useState<ReservacionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await obtenerMisReservaciones();
      setReservaciones(data);
    } catch (err: any) {
      setError(err.message ?? 'Error cargando boletos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  /* ── Loading State ──────────────────────────────── */
  if (loading) {
    return (
      <View style={[styles.root, styles.centeredContainer]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
        <Text style={styles.loadingText}>Cargando tus boletos...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={PerlaColors.tertiary}
        />
      }
    >
      {/* ── Header ───────────────────────────────────── */}
      <Text style={styles.title}>Mis Boletos</Text>
      <Text style={styles.subtitle}>
        Tus reservaciones y pases de abordar
      </Text>

      {/* ── Error ────────────────────────────────────── */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️  {error}</Text>
        </View>
      )}

      {/* ── Empty State ──────────────────────────────── */}
      {reservaciones.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎫</Text>
          <Text style={styles.emptyTitle}>Sin Boletos</Text>
          <Text style={styles.emptyText}>
            Aún no tienes reservaciones activas.
          </Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs-comprador)/reserve')}
          >
            <Text style={styles.emptyButtonText}>Reservar Aventura →</Text>
          </Pressable>
        </View>
      )}

      {/* ── Ticket Cards ────────────────────────────── */}
      {reservaciones.map((r) => (
        <TicketCard key={r.id_reservacion} reservacion={r} />
      ))}
    </ScrollView>
  );
}

/* ── Ticket Card Component ──────────────────────────────── */

function TicketCard({ reservacion: r }: { reservacion: ReservacionConDetalles }) {
  const estado = ESTADO_CONFIG[r.estado_pase ?? 'Pendiente_Caseta'];

  const fechaViaje = r.viaje?.fecha_programada
    ? new Date(r.viaje.fecha_programada + 'T00:00:00').toLocaleDateString('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '—';

  const horaViaje = r.viaje?.hora_salida_programada
    ? r.viaje.hora_salida_programada.slice(0, 5)
    : '—';

  const barcoNombre = (r.viaje as any)?.embarcacion?.nombre ?? 'Embarcación';

  return (
    <View style={styles.ticketCard}>
      {/* ── Ticket Header ──────────────────────────── */}
      <View style={styles.ticketHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ticketPaquete}>
            {r.paquete?.descripcion ?? 'Paquete'}
          </Text>
          <Text style={styles.ticketBarco}>
            🚢  {barcoNombre}
          </Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estado.bg }]}>
          <Text style={[styles.estadoText, { color: estado.text }]}>
            {estado.icon} {estado.label}
          </Text>
        </View>
      </View>

      {/* ── Ticket Info Row ────────────────────────── */}
      <View style={styles.ticketInfoRow}>
        <InfoItem label="Fecha" value={fechaViaje} />
        <InfoItem label="Hora" value={horaViaje} />
        <InfoItem label="Personas" value={String(r.cantidad_personas)} />
        <InfoItem label="Total" value={`$${r.total_pagar.toFixed(0)}`} highlight />
      </View>

      {/* ── Divider ────────────────────────────────── */}
      <View style={styles.ticketDivider}>
        <View style={styles.ticketDividerDotLeft} />
        <View style={styles.ticketDividerLine} />
        <View style={styles.ticketDividerDotRight} />
      </View>

      {/* ── PIN Section (visible when Aprobado) ──── */}
      {(r.estado_pase === 'Aprobado' || r.estado_pase === 'Abordado') && r.pin_verificacion && (
        <View style={styles.pinSection}>
          <Text style={styles.pinLabel}>PIN DE ABORDAJE</Text>
          <View style={styles.pinContainer}>
            {r.pin_verificacion.split('').map((char, i) => (
              <View key={i} style={styles.pinDigitBox}>
                <Text style={styles.pinDigit}>{char}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.pinHint}>
            Muestra este PIN al encargado del barco para abordar
          </Text>
        </View>
      )}

      {/* ── Pending Payment Message ─────────────── */}
      {r.estado_pase === 'Pendiente_Caseta' && (
        <View style={styles.pendingSection}>
          <Text style={styles.pendingIcon}>💰</Text>
          <Text style={styles.pendingText}>
            Completa tu pago para recibir tu PIN de abordaje
          </Text>
        </View>
      )}

      {/* ── Vencido Message ─────────────────────── */}
      {r.estado_pase === 'Vencido' && (
        <View style={styles.vencidoSection}>
          <Text style={styles.vencidoText}>
            No abordaste a tiempo. Contacta en caseta para{'\n'}
            una posible reubicación en otro viaje.
          </Text>
        </View>
      )}

      {/* ── Ticket Footer ──────────────────────────── */}
      <View style={styles.ticketFooter}>
        <Text style={styles.ticketId}>
          #{String(r.id_reservacion).padStart(5, '0')}
        </Text>
        {r.descuento_aplicado && r.descuento_aplicado > 0 ? (
          <Text style={styles.ticketDiscount}>
            Descuento: -${r.descuento_aplicado.toFixed(0)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ── Info Item ──────────────────────────────────────────── */

function InfoItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PerlaColors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  centeredContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 12,
  },

  /* Header */
  title: {
    fontFamily: 'Newsreader',
    fontSize: 34,
    color: PerlaColors.onSurface,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Manrope',
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 24,
  },

  /* Error */
  errorBanner: {
    backgroundColor: PerlaColors.errorContainer + '40',
    borderWidth: 1,
    borderColor: PerlaColors.error + '40',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.error,
  },

  /* Empty */
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: {
    fontFamily: 'Newsreader',
    fontSize: 24,
    color: PerlaColors.onSurface,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: PerlaColors.tertiary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 20,
  },
  emptyButtonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: PerlaColors.onTertiary,
  },

  /* Ticket Card */
  ticketCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '20',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  ticketPaquete: {
    fontFamily: 'Newsreader',
    fontSize: 20,
    color: PerlaColors.onSurface,
    marginBottom: 4,
  },
  ticketBarco: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  estadoBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 1,
  },
  estadoText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    letterSpacing: 0.3,
  },

  /* Info Row */
  ticketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: 'Manrope',
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
    color: PerlaColors.onSurface,
  },
  infoValueHighlight: {
    color: PerlaColors.tertiary,
    fontFamily: 'Newsreader',
    fontSize: 18,
  },

  /* Divider (ticket tear effect) */
  ticketDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  ticketDividerDotLeft: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PerlaColors.background,
    marginLeft: -27,
  },
  ticketDividerLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '40',
    marginHorizontal: 8,
  },
  ticketDividerDotRight: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PerlaColors.background,
    marginRight: -27,
  },

  /* PIN Section */
  pinSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pinLabel: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 2,
    marginBottom: 12,
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pinDigitBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: PerlaColors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: PerlaColors.tertiary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigit: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 24,
    color: PerlaColors.tertiary,
  },
  pinHint: {
    fontFamily: 'Manrope',
    fontSize: 11,
    color: PerlaColors.onSurfaceVariant + '80',
    textAlign: 'center',
  },

  /* Pending */
  pendingSection: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  pendingIcon: { fontSize: 32 },
  pendingText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: '#FFA726',
    textAlign: 'center',
  },

  /* Vencido */
  vencidoSection: {
    paddingVertical: 12,
  },
  vencidoText: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: '#78909C',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Footer */
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ticketId: {
    fontFamily: 'Manrope',
    fontSize: 11,
    color: PerlaColors.onSurfaceVariant + '60',
  },
  ticketDiscount: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    color: '#66BB6A',
  },
});
