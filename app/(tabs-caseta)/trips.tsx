import { PerlaColors } from "@/constants/theme";
import { useToast } from "@/src/contexts/ToastContext";
import type { Embarcacion, Viaje } from "@/src/lib/database.types";
import { globalEvents } from "@/src/lib/events";
import { supabase } from "@/src/lib/supabase";
import {
  obtenerCupoViaje,
  obtenerViajesDelDia,
  programarViaje,
  actualizarEstadoViaje,
  enviarAlertaPasajeros,
  actualizarRegresoEstimado,
  notificarRezagados,
} from "@/src/services/viajes.service";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ────────────────────────────────────────────────────────────
   Caseta – Gestión de Viajes
   Programar, ver estado, asignar barco/encargado
   ──────────────────────────────────────────────────────────── */

type ViajeConEmb = Viaje & {
  embarcacion: {
    nombre: string;
    capacidad_maxima: number;
    estado_operativo: string;
    duracion_estandar_viaje: number | null;
  };
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  Programado: { bg: "#42A5F5" + "22", text: "#42A5F5" },
  Retrasado: { bg: "#FFA726" + "22", text: "#FFA726" },
  Abordando: { bg: "#AB47BC" + "22", text: "#AB47BC" },
  En_Navegacion: { bg: "#26A69A" + "22", text: "#26A69A" }, // Frontend calls this 'EN MARCHA'
  Finalizado: { bg: "#66BB6A" + "22", text: "#66BB6A" },
  Cancelado: { bg: "#EF5350" + "22", text: "#EF5350" },
};

const getLocalDateString = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDBTime = (timeStr: string) => {
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function CasetaTripsScreen() {
  const insets = useSafeAreaInsets();

  const [viajes, setViajes] = useState<ViajeConEmb[]>([]);
  const [cupos, setCupos] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingViaje, setEditingViaje] = useState<ViajeConEmb | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showHeaderDatePicker, setShowHeaderDatePicker] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterBarco, setFilterBarco] = useState<number | null>(null);
  const [filterEstado, setFilterEstado] = useState<string | null>(null);
  const [embarcaciones, setEmbarcaciones] = useState<Embarcacion[]>([]);
  const [encargados, setEncargados] = useState<any[]>([]);

  // Trip lifecycle action state
  const [tripActionLoading, setTripActionLoading] = useState<number | null>(null);
  const [tripAlertLoading, setTripAlertLoading] = useState<number | null>(null);

  /* ── Trip Lifecycle Handlers ──────────────────── */
  const handleIniciarAbordaje = async (idViaje: number) => {
    setTripActionLoading(idViaje);
    try {
      await actualizarEstadoViaje(idViaje, 'hora_inicio_abordaje');
      try {
        await enviarAlertaPasajeros(idViaje, '🚶 ¡El abordaje ha comenzado! Por favor dirígete a la embarcación.');
      } catch (e) { console.error('Error enviando alerta de abordaje:', e); }
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al iniciar abordaje');
    } finally {
      setTripActionLoading(null);
    }
  };

  const handleAviso5Min = async (idViaje: number) => {
    setTripAlertLoading(idViaje);
    try {
      await enviarAlertaPasajeros(idViaje, '⚠️ El barco zarpará en 5 minutos. Por favor aborda de inmediato.');
      Alert.alert('Aviso Enviado', 'Se ha notificado a todos los pasajeros.');
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo enviar el aviso: ' + err.message);
    } finally {
      setTripAlertLoading(null);
    }
  };

  const handleZarparCaseta = async (idViaje: number) => {
    setTripActionLoading(idViaje);
    try {
      await actualizarRegresoEstimado(idViaje, 1.5);

      try {
        await enviarAlertaPasajeros(idViaje, '⛵ ¡El barco ha zarpado!');
      } catch (e) { console.error('Error enviando alerta de zarpe:', e); }

      // Esperar al trigger DB para marcar rezagados, luego notificar
      setTimeout(async () => {
        try {
          await notificarRezagados(idViaje);
        } catch (e) { console.error('Error notificando rezagados:', e); }
      }, 1500);

      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al confirmar zarpe');
    } finally {
      setTripActionLoading(null);
    }
  };

  const handleConfirmarLlegada = async (idViaje: number) => {
    setTripActionLoading(idViaje);
    try {
      await actualizarEstadoViaje(idViaje, 'hora_llegada_real');
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al confirmar llegada');
    } finally {
      setTripActionLoading(null);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerViajesDelDia(getLocalDateString(selectedDate));
      setViajes(data as ViajeConEmb[]);

      // Fetch cupos in parallel
      const cupoResults = await Promise.all(
        data.map((v) =>
          obtenerCupoViaje(v.id_viaje).then((c) => ({
            id: v.id_viaje,
            cupo: c,
          })),
        ),
      );
      const cupoMap: Record<number, number> = {};
      cupoResults.forEach((r) => {
        cupoMap[r.id] = r.cupo;
      });
      setCupos(cupoMap);
    } catch (err) {
      console.error("Trips error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();

    // FAB event listener
    const unsubscribe = globalEvents.on("fab-press-trips", () => {
      setEditingViaje(null);
      setShowModal(true);
    });

    // Fetch boats and crew for filters/modal
    supabase
      .from("embarcacion")
      .select("*")
      .eq("estado_operativo", "Activo")
      .then(({ data }) => {
        if (data) setEmbarcaciones(data as Embarcacion[]);
      });

    supabase
      .from("usuario")
      .select("id_usuario, nombre")
      .eq("rango", "Barco")
      .then(({ data }) => {
        if (data) setEncargados(data);
      });

    return () => unsubscribe();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const activeTripIds = useMemo(() => {
    if (getLocalDateString(selectedDate) !== getLocalDateString(new Date()))
      return new Set<number>();
    if (viajes.length === 0) return new Set<number>();

    const now = new Date();
    const nowTime = now.getHours() * 60 + now.getMinutes();

    const boatClosest: Record<number, { id: number; diff: number }> = {};

    viajes.forEach((v) => {
      if (v.estado_viaje === "Finalizado" || v.estado_viaje === "Cancelado")
        return;
      const [h, m] = v.hora_salida_programada.split(":").map(Number);
      const tripTime = h * 60 + m;
      const diff = Math.abs(tripTime - nowTime);

      const currentClosest = boatClosest[v.id_embarcacion];
      if (!currentClosest || diff < currentClosest.diff) {
        boatClosest[v.id_embarcacion] = { id: v.id_viaje, diff };
      }
    });

    return new Set(Object.values(boatClosest).map((bc) => bc.id));
  }, [viajes, selectedDate]);

  const filteredViajes = useMemo(() => {
    return viajes.filter((v) => {
      const lowerSearch = searchText.toLowerCase();
      const matchText = !searchText || 
        v.embarcacion.nombre.toLowerCase().includes(lowerSearch) ||
        formatDBTime(v.hora_salida_programada).toLowerCase().includes(lowerSearch) ||
        (v.tripulacion_asignada || []).some((id: string) => 
          encargados.find(e => e.id_usuario === id)?.nombre.toLowerCase().includes(lowerSearch)
        );

      const matchBarco = !filterBarco || v.id_embarcacion === filterBarco;
      const matchEstado = !filterEstado || v.estado_viaje === filterEstado;

      return matchText && matchBarco && matchEstado;
    });
  }, [viajes, searchText, encargados, filterBarco, filterEstado]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
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
        <View style={styles.carouselHeader}>
          <Pressable
            style={({ pressed }) => [
              styles.carouselBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={async () => {
              const current = getLocalDateString(selectedDate);
              const today = getLocalDateString(new Date());
              
              // Buscar fecha previa con viajes
              const { data } = await supabase
                .from('viaje')
                .select('fecha_programada')
                .lt('fecha_programada', current)
                .order('fecha_programada', { ascending: false })
                .limit(1);

              let target = data && data[0] ? data[0].fecha_programada : null;

              // Si hoy está entre la fecha encontrada y la actual, ir a hoy
              if (today < current && (!target || today > target)) {
                target = today;
              }

              if (target) {
                const [y, m, d] = target.split('-').map(Number);
                const newD = new Date(selectedDate);
                newD.setFullYear(y, m - 1, d);
                setSelectedDate(newD);
              } else {
                // Fallback: un día atrás si no hay nada más
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d);
              }
            }}
          >
            <Text style={styles.carouselBtnText}>‹</Text>
          </Pressable>

          <View style={styles.carouselCenter}>
            <Text style={styles.title}>Viajes del Día</Text>

            {Platform.OS === "web" ? (
              <View
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                {createElement("input", {
                  type: "date",
                  value: getLocalDateString(selectedDate),
                  onChange: (e: any) => {
                    const val = e.target.value;
                    if (val) {
                      const [y, m, d] = val.split("-").map(Number);
                      const newDate = new Date(selectedDate);
                      newDate.setFullYear(y, m - 1, d);
                      setSelectedDate(newDate);
                    }
                  },
                  onClick: (e: any) => {
                    try {
                      if (e.target.showPicker) e.target.showPicker();
                    } catch (err) {}
                  },
                  style: { width: "100%", height: "100%", cursor: "pointer" },
                })}
              </View>
            ) : (
              <Pressable
                onPress={() => setShowHeaderDatePicker(true)}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  zIndex: 10,
                }}
              />
            )}

            <Text style={styles.subtitle}>
              {selectedDate.toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              <Text
                style={{ fontSize: 10, color: PerlaColors.onSurfaceVariant }}
              >
                {" "}
                ▼
              </Text>
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.carouselBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={async () => {
              const current = getLocalDateString(selectedDate);
              const today = getLocalDateString(new Date());
              
              // Buscar próxima fecha con viajes
              const { data } = await supabase
                .from('viaje')
                .select('fecha_programada')
                .gt('fecha_programada', current)
                .order('fecha_programada', { ascending: true })
                .limit(1);

              let target = data && data[0] ? data[0].fecha_programada : null;

              // Si hoy está entre la actual y la fecha encontrada, ir a hoy
              if (today > current && (!target || today < target)) {
                target = today;
              }

              if (target) {
                const [y, m, d] = target.split('-').map(Number);
                const newD = new Date(selectedDate);
                newD.setFullYear(y, m - 1, d);
                setSelectedDate(newD);
              } else {
                // Fallback: un día adelante
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d);
              }
            }}
          >
            <Text style={styles.carouselBtnText}>›</Text>
          </Pressable>
        </View>

        {Platform.OS !== "web" && showHeaderDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={(e, d) => {
              setShowHeaderDatePicker(false);
              if (d) setSelectedDate(d);
            }}
          />
        )}

        {viajes.length > 0 && (
          <View style={styles.searchContainer}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar barco, hora o tripulante..."
                placeholderTextColor={PerlaColors.onSurfaceVariant + "80"}
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchText !== "" && (
                <Pressable 
                  onPress={() => setSearchText("")} 
                  style={styles.clearSearch}
                >
                  <Text style={{ color: PerlaColors.onSurfaceVariant, fontSize: 18 }}>✕</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.searchDivider} />
            <Pressable 
              onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={[styles.filterBtn, showAdvancedFilters && styles.filterBtnActive]}
            >
              <Text style={[styles.filterBtnText, showAdvancedFilters && styles.filterBtnTextActive]}>
                {showAdvancedFilters ? "Filtros ▲" : "Filtros ▼"}
              </Text>
            </Pressable>
          </View>
        )}

        {showAdvancedFilters && (
          <View style={styles.advancedFilters}>
            <Text style={styles.filterLabel}>EMBARCACIÓN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
              <Pressable 
                onPress={() => setFilterBarco(null)}
                style={[styles.chip, !filterBarco && styles.chipActive]}
              >
                <Text style={[styles.chipText, !filterBarco && styles.chipTextActive]}>Todas</Text>
              </Pressable>
              {embarcaciones.map(b => (
                <Pressable 
                  key={b.id_embarcacion}
                  onPress={() => setFilterBarco(b.id_embarcacion)}
                  style={[styles.chip, filterBarco === b.id_embarcacion && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filterBarco === b.id_embarcacion && styles.chipTextActive]}>{b.nombre}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>ESTADO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable 
                onPress={() => setFilterEstado(null)}
                style={[styles.chip, !filterEstado && styles.chipActive]}
              >
                <Text style={[styles.chipText, !filterEstado && styles.chipTextActive]}>Todos</Text>
              </Pressable>
              {Object.keys(ESTADO_COLORS).map(st => (
                <Pressable 
                  key={st}
                  onPress={() => setFilterEstado(st)}
                  style={[styles.chip, filterEstado === st && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filterEstado === st && styles.chipTextActive]}>{st.replace('_', ' ')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {viajes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚢</Text>
            <Text style={styles.emptyTitle}>Sin viajes programados</Text>
            <Text style={styles.emptyText}>
              Presiona el botón ➕ para programar un viaje
            </Text>
          </View>
        )}

        {filteredViajes.map((v) => {
          const ocupados = cupos[v.id_viaje] ?? 0;
          const capacidad = v.embarcacion.capacidad_maxima;
          const disponible = capacidad - ocupados;
          const pct = capacidad > 0 ? ocupados / capacidad : 0;
          let dynStatus = v.estado_viaje ?? "Programado";
          const isActiveTrip = activeTripIds.has(v.id_viaje);
          const isPastDay = v.fecha_programada < getLocalDateString(new Date());

          let displayStatus =
            dynStatus === "En_Navegacion"
              ? "EN MARCHA"
              : dynStatus.replace("_", " ");
          let estadoStyle =
            ESTADO_COLORS[dynStatus] ?? ESTADO_COLORS.Programado;

          if (
            isActiveTrip &&
            (dynStatus === "Programado" || dynStatus === "Retrasado")
          ) {
            displayStatus = "ACTIVO";
            estadoStyle = {
              bg: PerlaColors.tertiary + "30",
              text: PerlaColors.tertiary,
            };
          } else if (
            isPastDay &&
            ["Programado", "Retrasado", "Abordando"].includes(dynStatus)
          ) {
            displayStatus = "FINALIZADO";
            estadoStyle = ESTADO_COLORS.Finalizado;
          }

          return (
            <Pressable
              key={v.id_viaje}
              style={({ pressed }) => [
                styles.viajeCard,
                isActiveTrip && {
                  borderColor: PerlaColors.tertiary,
                  borderWidth: 1,
                },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => {
                setEditingViaje(v);
                setShowModal(true);
              }}
            >
              {/* Header */}
              <View style={styles.viajeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viajeHora}>
                    🕐 {formatDBTime(v.hora_salida_programada)}
                  </Text>
                  <Text style={styles.viajeBarco}>{v.embarcacion.nombre}</Text>
                </View>
                <View
                  style={[
                    styles.estadoBadge,
                    { backgroundColor: estadoStyle.bg },
                  ]}
                >
                  <Text
                    style={[styles.estadoText, { color: estadoStyle.text }]}
                  >
                    {displayStatus}
                  </Text>
                </View>
              </View>

              {/* Capacity Bar */}
              <View style={styles.capacitySection}>
                <View style={styles.capacityHeader}>
                  <Text style={styles.capacityLabel}>
                    Cupo: {ocupados}/{capacidad}
                  </Text>
                  <Text
                    style={[
                      styles.capacityAvail,
                      disponible <= 0 && { color: "#EF5350" },
                    ]}
                  >
                    {disponible > 0 ? `${disponible} disponibles` : "LLENO"}
                  </Text>
                </View>
                <View style={styles.capacityBarBg}>
                  <View
                    style={[
                      styles.capacityBarFill,
                      {
                        width: `${Math.min(pct * 100, 100)}%`,
                        backgroundColor:
                          pct >= 1
                            ? "#EF5350"
                            : pct >= 0.8
                              ? "#FFA726"
                              : "#66BB6A",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Retraso / Clima */}
              {(v.retraso_minutos ?? 0) > 0 && (
                <Text style={styles.retrasoText}>
                  ⚠️ Retraso: {v.retraso_minutos} min
                  {v.motivo_alteracion ? ` — ${v.motivo_alteracion}` : ""}
                </Text>
              )}

              {/* ── Trip Lifecycle Actions ──────────── */}
              {(dynStatus === 'Programado' || dynStatus === 'Retrasado') && (
                <View style={styles.tripActionsRow}>
                  <Pressable
                    style={[styles.tripActionBtn, { backgroundColor: '#AB47BC' }, tripActionLoading === v.id_viaje && { opacity: 0.6 }]}
                    onPress={() => handleIniciarAbordaje(v.id_viaje)}
                    disabled={tripActionLoading === v.id_viaje}
                  >
                    {tripActionLoading === v.id_viaje ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={styles.tripActionBtnText}>🚶 Abordaje</Text>
                    )}
                  </Pressable>
                </View>
              )}

              {dynStatus === 'Abordando' && (
                <View style={styles.tripActionsRow}>
                  <Pressable
                    style={[styles.tripActionBtn, { backgroundColor: PerlaColors.surfaceContainerHigh, borderWidth: 1, borderColor: PerlaColors.tertiary + '50' }, tripAlertLoading === v.id_viaje && { opacity: 0.6 }]}
                    onPress={() => handleAviso5Min(v.id_viaje)}
                    disabled={tripAlertLoading === v.id_viaje}
                  >
                    {tripAlertLoading === v.id_viaje ? <ActivityIndicator size="small" color={PerlaColors.onSurface} /> : (
                      <Text style={[styles.tripActionBtnText, { color: PerlaColors.onSurface }]}>📢 5 Min</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.tripActionBtn, { backgroundColor: '#26A69A', flex: 1 }, tripActionLoading === v.id_viaje && { opacity: 0.6 }]}
                    onPress={() => handleZarparCaseta(v.id_viaje)}
                    disabled={tripActionLoading === v.id_viaje}
                  >
                    {tripActionLoading === v.id_viaje ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={styles.tripActionBtnText}>⛵ Zarpar</Text>
                    )}
                  </Pressable>
                </View>
              )}

              {dynStatus === 'En_Navegacion' && (
                <View style={styles.tripActionsRow}>
                  <Pressable
                    style={[styles.tripActionBtn, { backgroundColor: '#66BB6A', flex: 1 }, tripActionLoading === v.id_viaje && { opacity: 0.6 }]}
                    onPress={() => handleConfirmarLlegada(v.id_viaje)}
                    disabled={tripActionLoading === v.id_viaje}
                  >
                    {tripActionLoading === v.id_viaje ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={styles.tripActionBtnText}>🏁 Confirmar Llegada</Text>
                    )}
                  </Pressable>
                </View>
              )}

            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Trip Modal (Create/Edit) ────────────────────────── */}
      <TripModal
        visible={showModal}
        viaje={editingViaje}
        embarcaciones={embarcaciones}
        encargados={encargados}
        onClose={() => setShowModal(false)}
        onSaved={() => {
          setShowModal(false);
          fetchData();
        }}
      />
    </View>
  );
}

/* ── Trip Modal (Create/Edit) ────────────────────────────────── */

function TripModal({
  visible,
  viaje,
  embarcaciones,
  encargados,
  onClose,
  onSaved,
}: {
  visible: boolean;
  viaje: ViajeConEmb | null;
  embarcaciones: Embarcacion[];
  encargados: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(new Date());
  const [estado, setEstado] = useState<string>("Programado");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedBarco, setSelectedBarco] = useState<number | null>(null);
  const [selectedEncargados, setSelectedEncargados] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (visible) {
      if (viaje) {
        // Modo Edición
        const vDate = new Date(
          `${viaje.fecha_programada}T${viaje.hora_salida_programada}`,
        );
        setDate(vDate);
        setEstado(viaje.estado_viaje || "Programado");
        setSelectedBarco(viaje.id_embarcacion);

        if (viaje.tripulacion_asignada) {
          setSelectedEncargados(viaje.tripulacion_asignada);
        } else if (viaje.id_encargado_abordaje) {
          setSelectedEncargados([viaje.id_encargado_abordaje]);
        } else {
          setSelectedEncargados([]);
        }
      } else {
        // Modo Creación: ajustar a la hora actual redondeada
        const now = new Date();
        now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
        now.setSeconds(0);
        setDate(now);
        setEstado("Programado");
        
        // Si no hay barco seleccionado aún (al abrir), poner el primero
        if (selectedBarco === null && embarcaciones.length > 0) {
          setSelectedBarco(embarcaciones[0].id_embarcacion);
        }
      }
    }
  }, [visible, viaje]); // Quitamos selectedBarco y embarcaciones para evitar bucles

  // Solo cargar tripulación default al CAMBIAR de barco en modo creación
  useEffect(() => {
    if (!viaje && selectedBarco && visible) {
      const barcoInfo = embarcaciones.find(
        (b) => b.id_embarcacion === selectedBarco,
      );
      if (barcoInfo && barcoInfo.tripulacion_default) {
        setSelectedEncargados(barcoInfo.tripulacion_default);
      } else {
        setSelectedEncargados([]);
      }
    }
  }, [selectedBarco]); // Solo depender del barco seleccionado

  const toggleEncargado = (id: string) => {
    setSelectedEncargados((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
      setDate(newDate);
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDate(newDate);
    }
  };

  const handleSave = async () => {
    if (!selectedBarco) {
      return toast.warning("Por favor selecciona una embarcación.");
    }

    // Validar pasado solo en creación
    if (!viaje && date.getTime() < new Date().getTime() - 60000) {
      return toast.error("No puedes programar viajes en el pasado.");
    }

    setSaving(true);
    try {
      const dbFecha = getLocalDateString(date);
      const dbHora = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;

      if (viaje) {
        // Update
        const { error } = await supabase
          .from("viaje")
          .update({
            fecha_programada: dbFecha,
            hora_salida_programada: dbHora,
            id_embarcacion: selectedBarco,
            tripulacion_asignada: selectedEncargados,
            id_encargado_abordaje:
              selectedEncargados.length > 0 ? selectedEncargados[0] : null,
            estado_viaje: estado as any,
          })
          .eq("id_viaje", viaje.id_viaje);
        if (error) throw error;
      } else {
        // Create
        await programarViaje({
          fecha_programada: dbFecha,
          hora_salida_programada: dbHora,
          id_embarcacion: selectedBarco,
          tripulacion_asignada: selectedEncargados,
          id_encargado_abordaje:
            selectedEncargados.length > 0 ? selectedEncargados[0] : null,
        });
      }
      toast.success(
        viaje
          ? "Viaje actualizado correctamente"
          : "Viaje programado correctamente",
      );
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el viaje");
    } finally {
      setSaving(false);
    }
  };

  const formatDisplayTime = (d: Date) => {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDisplayDate = (d: Date) => {
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Caseta sólo puede alterar estos dos, los demás le corresponden a Barco en su flujo nativo
  const ESTADOS_DISPONIBLES = ["Programado", "Cancelado"];

  const webInputStyles = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid " + PerlaColors.outlineVariant + "30",
    backgroundColor: PerlaColors.surfaceContainer,
    color: PerlaColors.onSurface,
    fontFamily: "Manrope-SemiBold",
    fontSize: "16px",
    colorScheme: "dark",
    outline: "none",
    boxSizing: "border-box" as any,
    cursor: "pointer",
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>
            {viaje ? "Gestionar Viaje" : "Programar Viaje"}
          </Text>

          <Text style={modalStyles.label}>FECHA DEL VIAJE</Text>
          {Platform.OS === "web" ? (
            <View style={{ marginBottom: 4 }}>
              {createElement("input", {
                type: "date",
                value: getLocalDateString(date),
                min: getLocalDateString(new Date()),
                onChange: (e: any) => {
                  const val = e.target.value;
                  if (val) {
                    const [y, m, d] = val.split("-").map(Number);
                    const newDate = new Date(date);
                    newDate.setFullYear(y, m - 1, d);
                    setDate(newDate);
                  }
                },
                onClick: (e: any) => {
                  try {
                    if (e.target.showPicker) e.target.showPicker();
                  } catch (err) {}
                },
                style: webInputStyles,
              })}
            </View>
          ) : (
            <Pressable
              style={modalStyles.pickerBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={modalStyles.pickerBtnText}>
                📅 {formatDisplayDate(date)}
              </Text>
            </Pressable>
          )}

          <Text style={modalStyles.label}>HORA DE SALIDA</Text>
          {Platform.OS === "web" ? (
            <View style={{ marginBottom: 4 }}>
              {createElement("input", {
                type: "time",
                value: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
                onChange: (e: any) => {
                  const val = e.target.value;
                  if (val) {
                    const [h, m] = val.split(":").map(Number);
                    const newDate = new Date(date);
                    newDate.setHours(h, m, 0);
                    setDate(newDate);
                  }
                },
                onClick: (e: any) => {
                  try {
                    if (e.target.showPicker) e.target.showPicker();
                  } catch (err) {}
                },
                style: webInputStyles,
              })}
            </View>
          ) : (
            <Pressable
              style={modalStyles.pickerBtn}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={modalStyles.pickerBtnText}>
                🕐 {formatDisplayTime(date)}
              </Text>
            </Pressable>
          )}

          {viaje && (
            <>
              <Text style={modalStyles.label}>ESTADO DEL VIAJE</Text>
              <View style={modalStyles.statusGrid}>
                {ESTADOS_DISPONIBLES.map((st) => {
                  const stStyle = ESTADO_COLORS[st];
                  const isSelected = estado === st;
                  return (
                    <Pressable
                      key={st}
                      style={[
                        modalStyles.statusBadge,
                        { borderColor: stStyle.text + "40" },
                        isSelected && {
                          backgroundColor: stStyle.text,
                          borderColor: stStyle.text,
                        },
                      ]}
                      onPress={() => setEstado(st)}
                    >
                      <Text
                        style={[
                          modalStyles.statusBadgeText,
                          { color: isSelected ? "#fff" : stStyle.text },
                        ]}
                      >
                        {st === "En_Navegacion"
                          ? "EN MARCHA"
                          : st.replace("_", " ")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[modalStyles.label, { marginTop: 16 }]}>
            EMBARCACIÓN
          </Text>
          <View style={modalStyles.barcoList}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {embarcaciones.map((e) => (
                <Pressable
                  key={e.id_embarcacion}
                  style={[
                    modalStyles.barcoBtn,
                    selectedBarco === e.id_embarcacion &&
                      modalStyles.barcoBtnActive,
                  ]}
                  onPress={() => setSelectedBarco(e.id_embarcacion)}
                >
                  <Text
                    style={[
                      modalStyles.barcoBtnText,
                      selectedBarco === e.id_embarcacion &&
                        modalStyles.barcoBtnTextActive,
                    ]}
                  >
                    {e.nombre} ({e.capacidad_maxima})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Text style={[modalStyles.label, { marginTop: 16 }]}>
            TRIPULACIÓN (BARCO)
          </Text>
          <View style={modalStyles.barcoList}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Pressable
                style={[
                  modalStyles.barcoBtn,
                  selectedEncargados.length === 0 && modalStyles.barcoBtnActive,
                ]}
                onPress={() => setSelectedEncargados([])}
              >
                <Text
                  style={[
                    modalStyles.barcoBtnText,
                    selectedEncargados.length === 0 &&
                      modalStyles.barcoBtnTextActive,
                  ]}
                >
                  Sin asignar
                </Text>
              </Pressable>
              {encargados.map((enc) => {
                const isSelected = selectedEncargados.includes(enc.id_usuario);
                return (
                  <Pressable
                    key={enc.id_usuario}
                    style={[
                      modalStyles.barcoBtn,
                      isSelected && modalStyles.barcoBtnActive,
                    ]}
                    onPress={() => toggleEncargado(enc.id_usuario)}
                  >
                    <Text
                      style={[
                        modalStyles.barcoBtnText,
                        isSelected && modalStyles.barcoBtnTextActive,
                      ]}
                    >
                      {enc.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {Platform.OS !== "web" && showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={onDateChange}
            />
          )}

          {Platform.OS !== "web" && showTimePicker && (
            <DateTimePicker
              value={date}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onTimeChange}
            />
          )}

          <View style={modalStyles.actions}>
            <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator
                  color={PerlaColors.onTertiary}
                  size="small"
                />
              ) : (
                <Text style={modalStyles.saveText}>
                  {viaje ? "Guardar Cambios" : "Crear Viaje"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  centered: { alignItems: "center", justifyContent: "center" },

  /* Header Carousel */
  carouselHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  carouselCenter: {
    alignItems: "center",
    position: "relative",
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  carouselBtn: {
    padding: 10,
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselBtnText: {
    fontSize: 24,
    fontFamily: "Manrope-Medium",
    color: PerlaColors.onSurfaceVariant,
    lineHeight: 26,
  },

  title: {
    fontFamily: "Newsreader",
    fontSize: 34,
    color: PerlaColors.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Manrope",
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 24,
    textTransform: "capitalize",
  },

  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: {
    fontFamily: "Newsreader",
    fontSize: 24,
    color: PerlaColors.onSurface,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: "Manrope",
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    textAlign: "center",
  },

  /* Viaje Card */
  viajeCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "15",
  },
  viajeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  viajeHora: {
    fontFamily: "Newsreader-Bold",
    fontSize: 22,
    color: PerlaColors.onSurface,
    marginBottom: 2,
  },
  viajeBarco: {
    fontFamily: "Manrope",
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },
  estadoBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  estadoText: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  /* Capacity */
  capacitySection: { marginBottom: 8 },
  capacityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  capacityLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  capacityAvail: {
    fontFamily: "Manrope-Bold",
    fontSize: 12,
    color: "#66BB6A",
  },
  capacityBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: PerlaColors.surfaceContainer,
    overflow: "hidden",
  },
  capacityBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  retrasoText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#FFA726",
    marginTop: 8,
  },

  tripActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: PerlaColors.outlineVariant + "15",
  },
  tripActionBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  tripActionBtnText: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    color: "#fff",
  },

  climaText: {
    fontFamily: "Manrope",
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "20",
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: PerlaColors.onSurface,
  },
  clearSearch: {
    padding: 8,
  },
  searchDivider: {
    width: 1,
    height: 24,
    backgroundColor: PerlaColors.outlineVariant + "20",
    marginHorizontal: 8,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filterBtnActive: {
    backgroundColor: PerlaColors.tertiary + "10",
    borderRadius: 8,
  },
  filterBtnText: {
    fontFamily: "Manrope-Bold",
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  filterBtnTextActive: {
    color: PerlaColors.tertiary,
  },
  advancedFilters: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "15",
  },
  filterLabel: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PerlaColors.surfaceContainer,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: {
    borderColor: PerlaColors.tertiary + "60",
    backgroundColor: PerlaColors.tertiary + "15",
  },
  chipText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  chipTextActive: {
    color: PerlaColors.tertiary,
    fontFamily: "Manrope-Bold",
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontFamily: "Newsreader",
    fontSize: 24,
    color: PerlaColors.onSurface,
    marginBottom: 20,
  },
  label: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: PerlaColors.surfaceContainer,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Manrope",
    fontSize: 16,
    color: PerlaColors.onSurface,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "30",
  },
  pickerBtn: {
    backgroundColor: PerlaColors.surfaceContainer,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "30",
    marginBottom: 4,
  },
  pickerBtnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: PerlaColors.onSurface,
  },
  barcoList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  barcoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: PerlaColors.surfaceContainer,
    borderWidth: 1,
    borderColor: "transparent",
  },
  barcoBtnActive: {
    borderColor: PerlaColors.tertiary + "60",
    backgroundColor: PerlaColors.tertiary + "15",
  },
  barcoBtnText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  barcoBtnTextActive: {
    color: PerlaColors.tertiary,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "40",
  },
  cancelText: {
    fontFamily: "Manrope-Bold",
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: PerlaColors.tertiary,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    textTransform: "uppercase",
  },
  saveText: {
    fontFamily: "Manrope-Bold",
    fontSize: 15,
    color: PerlaColors.onTertiary,
  },
});
