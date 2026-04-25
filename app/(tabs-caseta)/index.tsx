import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useState, createElement } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Path,
  Rect,
  Stop,
  Text as SvgText,
  G,
  LinearGradient as SvgGradient,
} from "react-native-svg";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { PerlaColors } from "@/constants/theme";
import {
  actualizarRegresoEstimado,
  obtenerEstadisticasRango,
  obtenerMetodosPagoRango,
  obtenerTendenciasRango,
  obtenerVistaOperativa,
} from "@/src/services/viajes.service";
import {
  obtenerEstadisticasHistoricasVendedores,
  obtenerEstadisticasHistoricasBarcos,
} from "@/src/services/estadisticas.service";
import { supabase } from "@/src/lib/supabase";
import { getLocalDateString } from "@/src/lib/time";

import { globalEvents } from "@/src/lib/events";
import { exportarExcel, exportarPDF } from "@/src/services/export.service";

/* ── Components ───────────────────────────────────── */

function LegendItem({ color, label, val }: any) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLab}>{label}: </Text>
      <Text style={styles.legendVal}>{val}</Text>
    </View>
  );
}

function AttendancePie({ boarded, noShow, boardedB, noShowB, isComparing }: any) {
  const size = 120;
  const stroke = 12; // Thinner for double ring
  const rA = (size - stroke) / 2;
  const rB = rA - stroke - 4;
  
  const cA = 2 * Math.PI * rA;
  const cB = 2 * Math.PI * rB;
  
  const offsetA = cA - (boarded / 100) * cA;
  const offsetB = cB - (boardedB / 100) * cB;

  return (
    <View style={styles.pieWrapper}>
      <Svg width={size} height={size}>
        {/* Ring A */}
        <Circle cx={size/2} cy={size/2} r={rA} stroke={PerlaColors.surfaceContainerHighest} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={rA} stroke={PerlaColors.tertiary} strokeWidth={stroke} fill="none"
          strokeDasharray={cA} strokeDashoffset={offsetA} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        
        {isComparing && (
          <>
            {/* Ring B */}
            <Circle cx={size/2} cy={size/2} r={rB} stroke={PerlaColors.surfaceContainerHighest + '40'} strokeWidth={stroke} fill="none" />
            <Circle
              cx={size/2} cy={size/2} r={rB} stroke={PerlaColors.secondary} strokeWidth={stroke} fill="none"
              strokeDasharray={cB} strokeDashoffset={offsetB} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}
            />
          </>
        )}
      </Svg>
      <View style={styles.pieCenter}>
        <Text style={[styles.pieCenterVal, isComparing && { fontSize: 16 }]}>
          {boarded}%
          {isComparing && <Text style={{ color: PerlaColors.secondary }}>\n{boardedB}%</Text>}
        </Text>
      </View>
    </View>
  );
}

function PaymentBarChart({ dataA, dataB = [], isComparing }: { dataA: any[], dataB?: any[], isComparing?: boolean }) {
  const barAreaHeight = 90;
  const methods = ["Efectivo", "Transferencia", "Stripe"];

  const allVals = [...dataA, ...dataB].map(d => Number(d.total_ingresos || 0));
  const maxVal = allVals.length > 0 ? Math.max(...allVals, 1000) : 1000;
  const barW = isComparing ? 20 : 32;

  return (
    <View style={{ marginTop: 24 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "flex-end",
          height: barAreaHeight + 40,
        }}
      >
        {methods.map((method) => {
          const dA = dataA.find((x) => x.metodo_pago === method) || { total_ingresos: 0 };
          const dB = dataB.find((x) => x.metodo_pago === method) || { total_ingresos: 0 };
          const barHA = (Number(dA.total_ingresos) / maxVal) * barAreaHeight;
          const barHB = (Number(dB.total_ingresos) / maxVal) * barAreaHeight;
          const label = method === "Stripe" ? "Tarjeta" : method;

          return (
            <View key={method} style={{ alignItems: "center" }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(barHA, 6),
                      width: barW,
                      borderRadius: 6,
                      backgroundColor: PerlaColors.tertiary,
                    },
                  ]}
                />
                {isComparing && (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(barHB, 6),
                        width: barW,
                        borderRadius: 6,
                        backgroundColor: PerlaColors.secondary,
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={[styles.barLab, { marginTop: 8 }]}>{label}</Text>
              {isComparing ? (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={[styles.barVal, { fontSize: 9 }]}>${Number(dA.total_ingresos).toLocaleString()}</Text>
                  <Text style={[styles.barVal, { fontSize: 9, color: PerlaColors.secondary }]}>${Number(dB.total_ingresos).toLocaleString()}</Text>
                </View>
              ) : (
                <Text style={styles.barVal}>
                  ${Number(dA.total_ingresos).toLocaleString()}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LineChart({
  dataA,
  dataB = [],
  isComparing = false,
  color,
  area,
  showLabels,
  isCurrency = false,
  highlightIdx = -1,
}: {
  dataA: number[];
  dataB?: number[];
  isComparing?: boolean;
  color: string;
  area?: boolean;
  showLabels?: boolean;
  isCurrency?: boolean;
  highlightIdx?: number;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const h = 80;
  const w = FULL_WIDTH - 40;

  const allVals = [...dataA, ...dataB];
  const maxVal = allVals.length > 0 ? Math.max(...allVals, 10) : 10;
  const stepX = w / 6;
  const getY = (v: number) => h - (v / maxVal) * h;

  const getPath = (points: number[]) =>
    points
      .map((v, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${getY(v)}`)
      .join(" ");
  const days = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <View style={{ height: h + (showLabels ? 30 : 0), marginTop: 32 }}>
      <Svg height={h + 20} width={w} style={{ overflow: 'visible' }}>
        <Defs>
          <SvgGradient id={"grad" + color.replace("#", "")} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGradient>
          <SvgGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={PerlaColors.secondary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={PerlaColors.secondary} stopOpacity="0" />
          </SvgGradient>
        </Defs>

        {/* Series A */}
        {area && (
          <Path
            d={`${getPath(dataA)} L ${(dataA.length - 1) * stepX} ${h} L 0 ${h} Z`}
            fill={`url(#grad${color.replace("#", "")})`}
          />
        )}
        <Path d={getPath(dataA)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />

        {/* Series B */}
        {isComparing && dataB.length > 0 && (
          <>
            {area && (
              <Path
                d={`${getPath(dataB)} L ${(dataB.length - 1) * stepX} ${h} L 0 ${h} Z`}
                fill="url(#gradB)"
                opacity={0.3}
              />
            )}
            <Path d={getPath(dataB)} fill="none" stroke={PerlaColors.secondary} strokeWidth="3" strokeLinecap="round" strokeDasharray="5,3" />
          </>
        )}

        {dataA.map((v, i) => (
          <React.Fragment key={i}>
            <Circle cx={i * stepX} cy={getY(v)} r={4} fill={color} stroke={PerlaColors.surface} strokeWidth={2} />
            {isComparing && dataB[i] !== undefined && (
              <Circle cx={i * stepX} cy={getY(dataB[i])} r={4} fill={PerlaColors.secondary} stroke={PerlaColors.surface} strokeWidth={2} />
            )}
          </React.Fragment>
        ))}
      </Svg>

      {showLabels && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          {days.map((d, i) => (
            <Text
              key={i}
              style={[
                styles.chartLab,
                highlightIdx === i && { color: color, fontFamily: 'Manrope-Bold', opacity: 1 }
              ]}
            >
              {d}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const { width } = Dimensions.get("window");
const CONTAINER_PADDING = 20;
const FULL_WIDTH = width - CONTAINER_PADDING * 2;

type TimeRange = "hoy" | "7d" | "30d" | "personalizado";
type StatsTab = "General" | "Vendedor" | "Barco";

export default function CasetaMasterDashboard() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getExportDates = () => {
    let startD = new Date();
    let endD = new Date();
    if (timeRange === '7d') startD.setDate(startD.getDate() - 6);
    else if (timeRange === '30d') startD.setDate(startD.getDate() - 29);
    else if (timeRange === 'personalizado') {
      startD = dateRange.start;
      endD = dateRange.end;
    }
    return { rangeS: getLocalDateString(startD), rangeE: getLocalDateString(endD) };
  };
  const [timeRange, setTimeRange] = useState<TimeRange>("hoy");
  const [activeTab, setActiveTab] = useState<StatsTab>("General");
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(),
  });
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);

  const [liveTrips, setLiveTrips] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<any[]>([]);
  const [selectedTripAction, setSelectedTripAction] = useState<any | null>(
    null,
  );
  const [attendance, setAttendance] = useState({ boarded: 0, noShow: 0, total: 0 });
  const [attendanceB, setAttendanceB] = useState({ boarded: 0, noShow: 0, total: 0 });
  const [isComparing, setIsComparing] = useState(false);
  const [statsData, setStatsData] = useState<any>({
    sales: [0, 0, 0, 0, 0, 0, 0],
    pax: [0, 0, 0, 0, 0, 0, 0],
    topPackage: "—",
    topVendor: "—",
    scheduledToday: 0,
    totalIngresos: 0,
    totalPax: 0,
  });
  const [statsDataB, setStatsDataB] = useState<any>(null);
  const [paymentStatsB, setPaymentStatsB] = useState<any[]>([]);

  const [historicalVendors, setHistoricalVendors] = useState<any[]>([]);
  const [historicalBoats, setHistoricalBoats] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedBoatId, setSelectedBoatId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    // 0. Evitar que se quede cargando para siempre con un timeout de seguridad
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setIsFetching(false);
      }
    }, 10000); // 10 segundos de gracia

    try {
      setIsFetching(true);

      // ── 1. Determine query dates based on active mode ──
      const today = getLocalDateString(new Date());
      const comparing = isComparing && timeRange === 'personalizado';

      let rangeStart: string;
      let rangeEnd: string;
      let compDayA: string | null = null;
      let compDayB: string | null = null;

      if (timeRange === 'hoy') {
        rangeStart = today;
        rangeEnd = today;
      } else if (timeRange === '7d') {
        const d = new Date(); d.setDate(d.getDate() - 6);
        rangeStart = getLocalDateString(d);
        rangeEnd = today;
      } else if (timeRange === '30d') {
        const d = new Date(); d.setDate(d.getDate() - 29);
        rangeStart = getLocalDateString(d);
        rangeEnd = today;
      } else {
        // personalizado
        if (comparing) {
          compDayA = getLocalDateString(dateRange.start);
          compDayB = getLocalDateString(dateRange.end);
          rangeStart = compDayA;
          rangeEnd = compDayA; // A only for the primary query
        } else {
          rangeStart = getLocalDateString(dateRange.start);
          rangeEnd = getLocalDateString(dateRange.end);
        }
      }

      // ── 2. Week info for trend charts ──
      const getWeekInfo = (date: Date) => {
        const d = new Date(date);
        const dow = d.getDay();
        const diff = d.getDate() - dow + (dow === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        const dates = Array.from({ length: 7 }, (_, i) => {
          const wd = new Date(monday);
          wd.setDate(monday.getDate() + i);
          return getLocalDateString(wd);
        });
        return { dates, start: dates[0], end: dates[6] };
      };

      const weekA = getWeekInfo(
        timeRange === 'personalizado' ? dateRange.start : new Date()
      );
      const weekB = comparing ? getWeekInfo(dateRange.end) : null;

      // ── 3. Parallel data fetches ──
      const [
        trips,
        resA,
        resB,
        trendsA,
        trendsB,
        paymentsA,
        paymentsB,
        histVendors,
        histBoats,
      ] = await Promise.all([
        obtenerVistaOperativa(),
        // Primary reservations
        supabase.from('reservacion')
          .select('total_pagar, cantidad_personas, paquete:paquete(descripcion), vendedor:usuario(nombre), estado_pase, created_at, viaje(embarcacion(nombre))')
          .gte('created_at', rangeStart + 'T00:00:00')
          .lte('created_at', rangeEnd + 'T23:59:59')
          .eq('estado_pago', 'Pagado'),
        // Comparison reservations (only in compare mode)
        comparing && compDayB
          ? supabase.from('reservacion')
              .select('total_pagar, cantidad_personas, paquete:paquete(descripcion), vendedor:usuario(nombre), estado_pase, created_at, viaje(embarcacion(nombre))')
              .gte('created_at', compDayB + 'T00:00:00')
              .lte('created_at', compDayB + 'T23:59:59')
              .eq('estado_pago', 'Pagado')
          : Promise.resolve({ data: null }),
        obtenerTendenciasRango(weekA.start, weekA.end),
        weekB ? obtenerTendenciasRango(weekB.start, weekB.end) : Promise.resolve([]),
        obtenerMetodosPagoRango(rangeStart, rangeEnd),
        comparing && compDayB
          ? obtenerMetodosPagoRango(compDayB, compDayB)
          : Promise.resolve([]),
        obtenerEstadisticasHistoricasVendedores(),
        obtenerEstadisticasHistoricasBarcos(),
      ]);

      // ── 4. Process stats helper ──
      const processStats = (data: any[]) => {
        const totalIngresos = data.reduce((s, r) => s + Number(r.total_pagar), 0);
        const totalPax = data.reduce((s, r) => s + Number(r.cantidad_personas), 0);
        const pkgCounts: Record<string, number> = {};
        const vendSales: Record<string, { ingresos: number, pax: number, tickets: number, hours: Record<number, number> }> = {};
        const boatSales: Record<string, { ingresos: number, pax: number, tickets: number }> = {};
        
        data.forEach(r => {
          const pkg = r.paquete?.descripcion || "—";
          const vend = r.vendedor?.nombre || "Online/Caseta";
          const boat = r.viaje?.embarcacion?.nombre || "Desconocido";
          const hr = new Date(r.created_at).getHours();
          
          pkgCounts[pkg] = (pkgCounts[pkg] || 0) + 1;
          
          if (!vendSales[vend]) vendSales[vend] = { ingresos: 0, pax: 0, tickets: 0, hours: {} };
          vendSales[vend].ingresos += Number(r.total_pagar);
          vendSales[vend].pax += Number(r.cantidad_personas);
          vendSales[vend].tickets += 1;
          vendSales[vend].hours[hr] = (vendSales[vend].hours[hr] || 0) + 1;
          
          if (!boatSales[boat]) boatSales[boat] = { ingresos: 0, pax: 0, tickets: 0 };
          boatSales[boat].ingresos += Number(r.total_pagar);
          boatSales[boat].pax += Number(r.cantidad_personas);
          boatSales[boat].tickets += 1;
        });

        const vendorStatsArr = Object.entries(vendSales).map(([name, stats]) => {
          let peakHour = 0;
          let maxTix = 0;
          for (const [h, count] of Object.entries(stats.hours)) {
            if (count > maxTix) {
              maxTix = count;
              peakHour = Number(h);
            }
          }
          return { name, ...stats, peakHour };
        }).sort((a, b) => b.ingresos - a.ingresos);

        const boatStatsArr = Object.entries(boatSales).map(([name, stats]) => ({
          name, ...stats
        })).sort((a, b) => b.ingresos - a.ingresos);

        return {
          totalIngresos,
          totalPax,
          topPackage: Object.entries(pkgCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
          topVendor: vendorStatsArr[0]?.name || "—",
          boarded: data.filter(r => r.estado_pase === 'Abordado').reduce((s, r) => s + Number(r.cantidad_personas), 0),
          vendorStatsArr,
          boatStatsArr,
        };
      };

      const statsA = processStats(resA.data || []);
      const statsB = comparing ? processStats(resB.data || []) : null;

      // ── 5. Trends ──
      const mapTrend = (trends: any[], week: { dates: string[] }) => ({
        sales: week.dates.map(d => {
          const t = (trends || []).find((tr: any) => tr.fecha === d);
          return t ? Number(t.total_ingresos) : 0;
        }),
        pax: week.dates.map(d => {
          const t = (trends || []).find((tr: any) => tr.fecha === d);
          return t ? Number(t.total_pax) : 0;
        }),
      });
      const trendA = mapTrend(trendsA || [], weekA);
      const trendB = weekB ? mapTrend(trendsB || [], weekB) : null;

      // ── 6. Scheduled trips count ──
      const scheduledA = (trips || []).filter(
        (t: any) => t.fecha_programada === (comparing ? compDayA : rangeStart)
      ).length;
      const scheduledB = comparing && compDayB
        ? (trips || []).filter((t: any) => t.fecha_programada === compDayB).length
        : 0;

      // ── 7. Set all states ──
      setLiveTrips((trips || []).filter((t: any) => t.estado_viaje === "En_Navegacion"));
      setPaymentStats(paymentsA || []);
      setHistoricalVendors(histVendors || []);
      setHistoricalBoats(histBoats || []);

      setSelectedVendorId(prev => prev || (histVendors?.[0]?.id_vendedor ?? null));
      setSelectedBoatId(prev => prev || (histBoats?.[0]?.id_embarcacion ?? null));

      setStatsData({
        ...statsA,
        sales: trendA.sales,
        pax: trendA.pax,
        scheduledToday: scheduledA,
      });

      if (comparing && statsB) {
        setStatsDataB({
          ...statsB,
          salesTrend: trendB?.sales || [0,0,0,0,0,0,0],
          paxTrend: trendB?.pax || [0,0,0,0,0,0,0],
          totalViajes: scheduledB,
        });
        setPaymentStatsB(paymentsB || []);
        setAttendanceB({ boarded: statsB.boarded, noShow: 0, total: statsB.totalPax });
      } else {
        setStatsDataB(null);
        setPaymentStatsB([]);
        setAttendanceB({ boarded: 0, noShow: 0, total: 0 });
      }

      setAttendance({ boarded: statsA.boarded, noShow: 0, total: statsA.totalPax });

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setIsFetching(false);
      setRefreshing(false);
    }
  }, [timeRange, dateRange, isComparing]);

  useEffect(() => {
    fetchData();

    // ── REALTIME CONNECTION ──
    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'viaje' },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservacion' },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = globalEvents.on("fab-press-index", () =>
      setShowExportModal(true),
    );
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
        <Text style={styles.loadingText}>Sincronizando Bitácora...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={PerlaColors.tertiary}
          />
        }
      >
        <View style={styles.glowTop} />

        {/* ── HEADER ── */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={styles.dashTitle}>Estadísticas</Text>
            {isFetching && !loading && !refreshing && <ActivityIndicator size="small" color={PerlaColors.tertiary} style={{ marginBottom: 8 }} />}
          </View>
          <View style={styles.statsTabs}>
            {(["General", "Vendedor", "Barco"] as StatsTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.statsTabBtn,
                  activeTab === tab && styles.statsTabBtnActive,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.statsTabText,
                    activeTab === tab && styles.statsTabTextActive,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {activeTab === "General" && (
          <>
        {/* ── 1. MONITOREO (LIVE) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.pulseDot} />
          <Text style={styles.sectionLabel}>EN NAVEGACIÓN</Text>
        </View>

        <View style={styles.tripCard}>
          {liveTrips.length === 0 ? (
            <Text style={styles.emptyText}>Sin barcos en el agua.</Text>
          ) : (
            liveTrips.map((trip: any) => (
              <TouchableOpacity
                key={trip.id_viaje}
                style={styles.tripRow}
                onPress={() => setSelectedTripAction(trip)}
              >
                <View style={styles.boatCol}>
                  <View style={styles.boatBubble}>
                    <IconSymbol
                      name="ferry"
                      size={12}
                      color={PerlaColors.tertiary}
                    />
                  </View>
                  <Text style={styles.boatName}>{trip.nombre_barco}</Text>
                </View>

                <View style={styles.paxMoneyCol}>
                  <View style={styles.miniStat}>
                    <Text style={styles.dataVal}>
                      {trip.hora_salida_real || "—"}
                    </Text>
                    <Text style={styles.dataLab}>ZARPÓ</Text>
                  </View>
                  <View style={styles.miniStat}>
                    <Text style={styles.dataVal}>
                      {trip.tiempo_estimado_regreso
                        ? new Date(
                            trip.tiempo_estimado_regreso,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </Text>
                    <Text style={styles.dataLab}>REGRESO</Text>
                  </View>
                  <View style={styles.miniStat}>
                    <Text style={styles.dataVal}>{trip.ocupados || 0}</Text>
                    <Text style={styles.dataLab}>PAX</Text>
                  </View>
                  <View style={styles.miniStat}>
                    <Text
                      style={[styles.dataVal, { color: PerlaColors.tertiary }]}
                    >
                      ${(trip.monto_total || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.dataLab}>MONTO</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── 2. FILTERS ── */}
        <View style={styles.filterSection}>
          <View style={styles.filterTabs}>
            {(["hoy", "7d", "30d", "personalizado"] as TimeRange[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.filterTab,
                  timeRange === r && styles.filterTabActive,
                ]}
                onPress={() => {
                  setTimeRange(r);
                  if (r !== 'personalizado') setIsComparing(false);
                }}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    timeRange === r && styles.filterTabTextActive,
                  ]}
                >
                  {r === "personalizado" ? "Pers." : r.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {timeRange === "personalizado" && (
            <View style={styles.customFilterWrap}>
              <Text style={styles.filterSub}>Modo de consulta</Text>
              <View style={styles.dualSwitch}>
                <TouchableOpacity 
                  style={[styles.switchHalf, !isComparing && styles.switchHalfActive]} 
                  onPress={() => setIsComparing(false)}
                >
                  <Text style={[styles.switchLabel, !isComparing && styles.switchLabelActive]}>RANGO</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.switchHalf, isComparing && styles.switchHalfActive]} 
                  onPress={() => setIsComparing(true)}
                >
                  <Text style={[styles.switchLabel, isComparing && styles.switchLabelActive]}>COMPARATIVA</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.customRangeRow}>
                <TouchableOpacity
                  style={[
                    styles.dateSelector,
                    showDatePicker === "start" && { borderColor: PerlaColors.tertiary, borderWidth: 2 }
                  ]}
                  onPress={() => Platform.OS !== 'web' && setShowDatePicker("start")}
                >
                  {Platform.OS === 'web' && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 10 }}>
                      {createElement("input", {
                        type: "date",
                        value: getLocalDateString(dateRange.start),
                        onChange: (e: any) => {
                          const val = e.target.value;
                          if (val) {
                            const [y, m, d] = val.split("-").map(Number);
                            const newDate = new Date(dateRange.start);
                            newDate.setFullYear(y, m - 1, d);
                            setDateRange(prev => ({ ...prev, start: newDate }));
                          }
                        },
                        onClick: (e: any) => {
                          try { if (e.target.showPicker) e.target.showPicker(); } catch (err) {}
                        },
                        style: { width: "100%", height: "100%", cursor: "pointer" },
                      })}
                    </View>
                  )}
                  <IconSymbol name="calendar" size={14} color={PerlaColors.tertiary} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.dateSelectorLab}>
                      {isComparing ? "DÍA A" : "DESDE"}
                    </Text>
                    <Text style={styles.dateSelectorText}>
                      {dateRange.start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.dateSeparator} />

                <TouchableOpacity
                  style={[
                    styles.dateSelector,
                    showDatePicker === "end" && { borderColor: PerlaColors.tertiary, borderWidth: 2 }
                  ]}
                  onPress={() => Platform.OS !== 'web' && setShowDatePicker("end")}
                >
                  {Platform.OS === 'web' && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 10 }}>
                      {createElement("input", {
                        type: "date",
                        value: getLocalDateString(dateRange.end),
                        onChange: (e: any) => {
                          const val = e.target.value;
                          if (val) {
                            const [y, m, d] = val.split("-").map(Number);
                            const newDate = new Date(dateRange.end);
                            newDate.setFullYear(y, m - 1, d);
                            setDateRange(prev => ({ ...prev, end: newDate }));
                          }
                        },
                        onClick: (e: any) => {
                          try { if (e.target.showPicker) e.target.showPicker(); } catch (err) {}
                        },
                        style: { width: "100%", height: "100%", cursor: "pointer" },
                      })}
                    </View>
                  )}
                  <IconSymbol name="calendar" size={14} color={PerlaColors.tertiary} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.dateSelectorLab}>
                      {isComparing ? "DÍA B" : "HASTA"}
                    </Text>
                    <Text style={styles.dateSelectorText}>
                      {dateRange.end.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── 4. TENDENCIAS ── */}
        <View style={styles.chartTile}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.tileTitle}>TENDENCIA DE VENTAS (L-D)</Text>
            {isComparing && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: PerlaColors.tertiary }} />
                  <Text style={{ fontSize: 9, color: PerlaColors.onSurfaceVariant }}>Semana A</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: PerlaColors.secondary }} />
                  <Text style={{ fontSize: 9, color: PerlaColors.onSurfaceVariant }}>Semana B</Text>
                </View>
              </View>
            )}
          </View>
          <LineChart
            dataA={statsData.sales}
            dataB={isComparing ? statsDataB?.salesTrend : []}
            isComparing={isComparing}
            color={PerlaColors.tertiary}
            area
            showLabels
            isCurrency
            highlightIdx={timeRange === 'hoy' || timeRange === '7d' ? (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) : -1}
          />
        </View>

        <View style={styles.chartTile}>
          <Text style={styles.tileTitle}>FLUJO DE PASAJEROS (PAX)</Text>
          <LineChart
            dataA={statsData.pax}
            dataB={isComparing ? statsDataB?.paxTrend : []}
            isComparing={isComparing}
            color={PerlaColors.primary}
            area
            showLabels
            highlightIdx={timeRange === 'hoy' || timeRange === '7d' ? (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) : -1}
          />
        </View>

        {/* ── 4. ANALYTICS BENTO ── */}
        <View style={styles.bentoRow}>
          <View style={[styles.tile, { flex: 1.2, justifyContent: "center" }]}>
            <Text style={styles.tileTitle}>RESUMEN GENERAL</Text>
            <View style={{ marginTop: 8 }}>
              <View style={styles.miniRow}>
                <Text style={styles.miniRowLab}>Ingresos</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.miniRowVal}>
                    ${statsData.totalIngresos.toLocaleString()}
                  </Text>
                  {isComparing && statsDataB && (
                    <Text style={[styles.compMiniVal, { color: PerlaColors.secondary }]}>
                      vs ${statsDataB.totalIngresos.toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.miniRow}>
                <Text style={styles.miniRowLab}>Pasajeros</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.miniRowVal}>{statsData.totalPax}</Text>
                  {isComparing && statsDataB && (
                    <Text style={[styles.compMiniVal, { color: PerlaColors.secondary }]}>
                      vs {statsDataB.totalPax}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.tile, { flex: 0.8 }]}>
            <Text style={styles.tileTitle}>VENDEDOR TOP</Text>
            <View style={styles.centerBox}>
              <View style={styles.vendorAvatar}>
                <Text style={{ fontSize: 24 }}>🏴‍☠️</Text>
              </View>
              <Text style={styles.hugeVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
                {statsData.topVendor}
              </Text>
              {isComparing && statsDataB && (
                <View style={styles.compRow}>
                  <Text style={styles.compLabel}>B:</Text>
                  <Text style={styles.compVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
                    {statsDataB.topVendor}
                  </Text>
                </View>
              )}
              {!isComparing && <Text style={styles.subVal}>Líder del Período</Text>}
            </View>
          </View>
        </View>

        <View style={styles.bentoRow}>
          <View
            style={[
              styles.tile,
              { flex: 1, backgroundColor: PerlaColors.secondary + "05" },
            ]}
          >
            <Text style={styles.tileTitle}>PAQUETE REY</Text>
            <View style={{ marginTop: 4 }}>
              <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
                {statsData.topPackage}
              </Text>
              {isComparing && statsDataB && (
                <View style={styles.compRow}>
                  <Text style={styles.compLabel}>B:</Text>
                  <Text style={styles.compVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
                    {statsDataB.topPackage}
                  </Text>
                </View>
              )}
              {!isComparing && <Text style={styles.subVal}>El más vendido</Text>}
            </View>
          </View>
          <View style={[styles.tile, { width: 120 }]}>
            <Text style={styles.tileTitle}>PROG.</Text>
            <View style={{ marginTop: 4 }}>
              <Text style={styles.heroVal}>{statsData.scheduledToday}</Text>
              {isComparing && statsDataB && (
                <View style={styles.compRow}>
                  <Text style={styles.compLabel}>B:</Text>
                  <Text style={styles.compVal}>{statsDataB.totalViajes}</Text>
                </View>
              )}
              {!isComparing && <Text style={styles.subVal}>Viajes</Text>}
            </View>
          </View>
        </View>

        <View style={styles.chartTile}>
          <Text style={styles.tileTitle}>ASISTENCIA GLOBAL</Text>
          <View style={styles.pieContainer}>
            <AttendancePie 
              boarded={attendance.total > 0 ? Math.round((attendance.boarded / attendance.total) * 100) : 0} 
              noShow={attendance.total > 0 ? Math.round((attendance.noShow / attendance.total) * 100) : 0} 
              boardedB={attendanceB.total > 0 ? Math.round((attendanceB.boarded / attendanceB.total) * 100) : 0}
              isComparing={isComparing}
            />
            <View style={styles.pieLegend}>
              <LegendItem
                color={PerlaColors.tertiary}
                label="Subieron"
                val={`${attendance.boarded} pax`}
              />
              <LegendItem
                color={PerlaColors.surfaceContainerHighest}
                label="No-show"
                val={`${attendance.noShow} pax`}
              />
            </View>
          </View>
        </View>

        {/* ── 5. PAYMENT METHODS ── */}
        <View style={styles.chartTile}>
          <Text style={styles.tileTitle}>MÉTODOS DE PAGO</Text>
          <PaymentBarChart 
            dataA={paymentStats} 
            dataB={paymentStatsB} 
            isComparing={isComparing} 
          />
        </View>
        </>
        )}

        {activeTab === "Vendedor" && (
          <View style={{ marginTop: 0, gap: 16 }}>
            {/* Selector Horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8, marginTop: 8 }}>
              {historicalVendors.map((v) => (
                <TouchableOpacity 
                  key={v.id_vendedor} 
                  style={[styles.filterTab, { width: 120, paddingHorizontal: 12, backgroundColor: PerlaColors.surfaceContainerLow, borderWidth: 1, borderColor: PerlaColors.outlineVariant }, selectedVendorId === v.id_vendedor && { backgroundColor: PerlaColors.surfaceContainerHigh, borderColor: PerlaColors.tertiary }]}
                  onPress={() => setSelectedVendorId(v.id_vendedor)}
                >
                  <Text style={[styles.filterTabText, selectedVendorId === v.id_vendedor && styles.filterTabTextActive]} numberOfLines={1}>{v.vendedor_nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected Vendor Stats */}
            {(() => {
              const hist = historicalVendors.find(v => v.id_vendedor === selectedVendorId);
              const daily = statsData.vendorStatsArr?.find((v: any) => v.name === hist?.vendedor_nombre);

              if (!hist) return <Text style={styles.emptyText}>Selecciona un vendedor.</Text>;

              return (
                <View style={styles.chartTile}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.vendorAvatar}><Text style={{ fontSize: 20 }}>🏴‍☠️</Text></View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.tileTitle}>{hist.vendedor_nombre}</Text>
                        <Text style={styles.subVal}>Vendedor Activo</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.sectionLabel, { marginBottom: 8, marginTop: 8 }]}>HISTÓRICO GLOBAL</Text>
                  <View style={styles.bentoRow}>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Recaudado</Text>
                      <Text style={[styles.heroVal, { color: PerlaColors.primary }]}>${Number(hist.total_ingresos).toLocaleString()}</Text>
                    </View>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Boletos / Pax</Text>
                      <Text style={styles.heroVal}>{hist.total_boletos} / {hist.total_pax}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.bentoRow}>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Hora Pico Histórica</Text>
                      <Text style={styles.heroVal}>{hist.peak_hour ? `${hist.peak_hour}:00 - ${Number(hist.peak_hour)+1}:00` : 'N/A'}</Text>
                    </View>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Barco Estrella</Text>
                      <Text style={[styles.heroVal, { fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>{hist.top_barco || 'N/A'}</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionLabel, { marginBottom: 8, marginTop: 16 }]}>DEL DÍA / PERIODO</Text>
                  <View style={styles.bentoRow}>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Recaudado</Text>
                      <Text style={[styles.heroVal, { color: PerlaColors.tertiary }]}>${(daily?.ingresos || 0).toLocaleString()}</Text>
                    </View>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Boletos</Text>
                      <Text style={styles.heroVal}>{daily?.tickets || 0}</Text>
                    </View>
                  </View>
                  {daily && (
                    <View style={[styles.tile, { marginTop: 0 }]}>
                      <Text style={styles.miniRowLab}>Hora de Mayor Flujo</Text>
                      <Text style={styles.heroVal}>{daily.peakHour}:00 - {daily.peakHour + 1}:00 hrs</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {activeTab === "Barco" && (
          <View style={{ marginTop: 0, gap: 16 }}>
            {/* Selector Horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8, marginTop: 8 }}>
              {historicalBoats.map((b) => (
                <TouchableOpacity 
                  key={b.id_embarcacion} 
                  style={[styles.filterTab, { width: 120, paddingHorizontal: 12, backgroundColor: PerlaColors.surfaceContainerLow, borderWidth: 1, borderColor: PerlaColors.outlineVariant }, selectedBoatId === b.id_embarcacion && { backgroundColor: PerlaColors.surfaceContainerHigh, borderColor: PerlaColors.tertiary }]}
                  onPress={() => setSelectedBoatId(b.id_embarcacion)}
                >
                  <Text style={[styles.filterTabText, selectedBoatId === b.id_embarcacion && styles.filterTabTextActive]} numberOfLines={1}>{b.barco_nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected Boat Stats */}
            {(() => {
              const hist = historicalBoats.find(b => b.id_embarcacion === selectedBoatId);
              const daily = statsData.boatStatsArr?.find((b: any) => b.name === hist?.barco_nombre);

              if (!hist) return <Text style={styles.emptyText}>Selecciona un barco.</Text>;

              const avgPax = hist.viajes_realizados > 0 ? Math.round(hist.total_pax / hist.viajes_realizados) : 0;

              return (
                <View style={styles.chartTile}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={styles.boatBubble}>
                      <IconSymbol name="ferry" size={16} color={PerlaColors.tertiary} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.tileTitle}>{hist.barco_nombre}</Text>
                      <Text style={styles.subVal}>Estado: {hist.estado_operativo}</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionLabel, { marginBottom: 8, marginTop: 8 }]}>HISTÓRICO GLOBAL</Text>
                  <View style={styles.bentoRow}>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Recaudado</Text>
                      <Text style={[styles.heroVal, { color: PerlaColors.primary }]}>${Number(hist.total_ingresos).toLocaleString()}</Text>
                    </View>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Pax Total</Text>
                      <Text style={styles.heroVal}>{hist.total_pax}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.bentoRow}>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Viajes / Avg Pax</Text>
                      <Text style={styles.heroVal}>{hist.viajes_realizados} / {avgPax}</Text>
                    </View>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Paquete Rey</Text>
                      <Text style={[styles.heroVal, { fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>{hist.paquete_rey || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={[styles.tile, { marginBottom: 16 }]}>
                    <Text style={styles.miniRowLab}>Hora Pico (Mayor Flujo)</Text>
                    <Text style={styles.heroVal}>{hist.peak_hour ? `${hist.peak_hour}:00 - ${Number(hist.peak_hour)+1}:00` : 'N/A'}</Text>
                  </View>

                  <Text style={[styles.sectionLabel, { marginBottom: 8, marginTop: 8 }]}>DEL DÍA / PERIODO</Text>
                  <View style={styles.bentoRow}>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Recaudado</Text>
                      <Text style={[styles.heroVal, { color: PerlaColors.tertiary }]}>${(daily?.ingresos || 0).toLocaleString()}</Text>
                    </View>
                    <View style={[styles.tile, { flex: 1 }]}>
                      <Text style={styles.miniRowLab}>Tickets Vendidos</Text>
                      <Text style={styles.heroVal}>{daily?.tickets || 0}</Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Modal Trip Action */}
        <Modal visible={!!selectedTripAction} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedTripAction(null)}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={styles.exportModalContent}
            >
              <Text style={styles.exportModalTitle}>Estimar Regreso</Text>
              <Text style={styles.exportModalSub}>
                {selectedTripAction?.nombre_barco}
              </Text>
              <View style={styles.exportOptions}>
                {[1, 2, 3, 4].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={styles.hourOption}
                    onPress={async () => {
                      await actualizarRegresoEstimado(
                        selectedTripAction.id_viaje,
                        h,
                      );
                      setSelectedTripAction(null);
                      fetchData();
                    }}
                  >
                    <Text style={styles.hourOptionText}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => setSelectedTripAction(null)}
              >
                <Text style={styles.cancelLinkText}>Cerrar</Text>
              </TouchableOpacity>
            </BlurView>
          </TouchableOpacity>
        </Modal>

        {/* Modal Export */}
        <Modal visible={showExportModal} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowExportModal(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <BlurView
                intensity={20}
                tint="dark"
                style={styles.exportModalContent}
              >
              <Text style={styles.exportModalTitle}>Exportar</Text>
              {isExporting ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={PerlaColors.tertiary} />
                  <Text style={[styles.subVal, { marginTop: 16 }]}>Generando documento...</Text>
                </View>
              ) : (
                <View style={styles.exportOptions}>
                  <TouchableOpacity
                    style={styles.exportOption}
                    onPress={async () => {
                      try {
                        setIsExporting(true);
                        const { rangeS, rangeE } = getExportDates();
                        await exportarPDF(statsData, rangeS, rangeE, paymentStats);
                      } catch (e) {
                        console.error("PDF Export error:", e);
                        alert("Hubo un error al generar el PDF.");
                      } finally {
                        setIsExporting(false);
                        setShowExportModal(false);
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.exportIconBox,
                        { backgroundColor: "#FF525222" },
                      ]}
                    >
                      <Text style={{ fontSize: 24 }}>📄</Text>
                    </View>
                    <Text style={styles.exportOptionText}>PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exportOption}
                    onPress={async () => {
                      try {
                        setIsExporting(true);
                        const { rangeS, rangeE } = getExportDates();
                        await exportarExcel(rangeS, rangeE);
                      } catch (e) {
                        console.error("Excel Export error:", e);
                        alert("Hubo un error al generar el Excel.");
                      } finally {
                        setIsExporting(false);
                        setShowExportModal(false);
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.exportIconBox,
                        { backgroundColor: "#4CAF5022" },
                      ]}
                    >
                      <Text style={{ fontSize: 24 }}>xlsx</Text>
                    </View>
                    <Text style={styles.exportOptionText}>Excel</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                <Text style={styles.cancelLinkText}>Cancelar</Text>
              </TouchableOpacity>
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>

        {showDatePicker && (
          <DateTimePicker
            value={showDatePicker === "start" ? dateRange.start : dateRange.end}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              const currentPicker = showDatePicker;
              setShowDatePicker(null);
              if (date && currentPicker) {
                setDateRange((prev) => ({
                  ...prev,
                  [currentPicker]: date,
                }));
              }
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.surface },
  centered: { justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: CONTAINER_PADDING },
  glowTop: {
    position: "absolute",
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: PerlaColors.tertiary + "05",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  dashTitle: {
    fontFamily: "Newsreader",
    fontSize: 34,
    color: PerlaColors.onSurface,
    marginBottom: 8,
  },
  statsTabs: {
    flexDirection: 'row',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    padding: 4,
  },
  statsTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  statsTabBtnActive: {
    backgroundColor: PerlaColors.surfaceContainerHigh,
  },
  statsTabText: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
  },
  statsTabTextActive: {
    color: PerlaColors.tertiary,
  },
  loadingText: {
    fontFamily: "Manrope-Medium",
    fontSize: 16,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 16,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PerlaColors.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    elevation: 4,
  },
  exportText: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: PerlaColors.onTertiary,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF5252",
    marginRight: 8,
  },
  sectionLabel: {
    fontFamily: "Manrope-Bold",
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 1.5,
  },
  tripCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 24,
    padding: 8,
    marginBottom: 24,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: PerlaColors.outlineVariant + "20",
  },
  boatCol: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  boatBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PerlaColors.tertiary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  boatName: {
    fontFamily: "Newsreader-Bold",
    fontSize: 15,
    color: PerlaColors.onSurface,
  },
  paxMoneyCol: {
    flex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  miniStat: { alignItems: "center", flex: 1 },
  dataVal: {
    fontFamily: "Newsreader-Bold",
    fontSize: 14,
    color: PerlaColors.onSurface,
  },
  dataLab: {
    fontFamily: "Manrope",
    fontSize: 8,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  emptyText: {
    padding: 20,
    color: PerlaColors.onSurfaceVariant,
    textAlign: "center",
    fontFamily: "Manrope",
  },
  filterSection: { marginBottom: 24 },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  filterTabActive: { backgroundColor: PerlaColors.surfaceContainerHigh },
  filterTabText: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
  },
  filterTabTextActive: { color: PerlaColors.tertiary },
  customRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 12,
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PerlaColors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "20",
  },
  dateSelectorText: {
    fontFamily: "Manrope-Bold",
    fontSize: 12,
    color: PerlaColors.onSurface,
  },
  dateSelectorLab: {
    fontFamily: "Manrope-Bold",
    fontSize: 8,
    color: PerlaColors.onSurfaceVariant,
    opacity: 0.6,
    marginBottom: 2,
  },
  dateSeparator: {
    width: 8,
    height: 1,
    backgroundColor: PerlaColors.outlineVariant,
  },
  customFilterWrap: {
    marginTop: 16,
    padding: 16,
    backgroundColor: PerlaColors.surfaceContainerHigh + '40',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '20',
  },
  filterSub: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dualSwitch: {
    flexDirection: 'row',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  switchHalf: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  switchHalfActive: {
    backgroundColor: PerlaColors.tertiary,
  },
  switchLabel: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
  },
  switchLabelActive: {
    color: PerlaColors.onTertiary,
  },
  valStack: {
    marginTop: 4,
  },
  subValComp: {
    fontFamily: 'Manrope-Bold',
    fontSize: 11,
    marginTop: 2,
    opacity: 0.8,
  },
  compMiniVal: {
    fontFamily: 'Manrope-Bold',
    fontSize: 9,
    opacity: 0.7,
  },
  chartLab: {
    fontSize: 10,
    fontFamily: "Manrope-Bold",
    color: PerlaColors.onSurfaceVariant,
    opacity: 0.6,
    width: 24,
    textAlign: "center",
  },
  bentoRow: { flexDirection: "row", gap: 16, marginBottom: 16 },
  tile: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant,
  },
  tileTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  centerBox: { alignItems: "center", marginTop: 12 },
  vendorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PerlaColors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  hugeVal: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: width < 400 ? 20 : 28,
    color: PerlaColors.onSurface,
    lineHeight: width < 400 ? 24 : 32,
  },
  subVal: {
    fontFamily: "Manrope",
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
    opacity: 0.6,
    marginTop: 4,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  compLabel: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: PerlaColors.secondary,
  },
  compVal: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    color: PerlaColors.onSurface,
  },
  heroVal: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: width < 400 ? 18 : 24,
    color: PerlaColors.onSurface,
    marginTop: 4,
  },
  chartTile: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant,
  },
  pieContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 12,
  },
  pieWrapper: { alignItems: "center", justifyContent: "center" },
  pieCenter: { position: "absolute", alignItems: "center" },
  pieCenterVal: {
    fontFamily: "Newsreader-Bold",
    fontSize: 22,
    color: PerlaColors.onSurface,
  },
  pieLegend: { gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendLab: {
    fontFamily: "Manrope",
    fontSize: 11,
    color: PerlaColors.onSurfaceVariant,
  },
  legendVal: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    color: PerlaColors.onSurface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  exportModalContent: {
    width: "100%",
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant,
    overflow: "hidden",
  },
  exportModalTitle: {
    fontFamily: "Newsreader-Bold",
    fontSize: 24,
    color: PerlaColors.onSurface,
    marginBottom: 8,
  },
  exportModalSub: {
    fontFamily: "Manrope",
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 24,
    textAlign: "center",
  },
  exportOptions: { flexDirection: "row", gap: 20, marginBottom: 24 },
  exportOption: { alignItems: "center", gap: 8 },
  exportIconBox: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant,
  },
  exportOptionText: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: PerlaColors.onSurface,
  },
  cancelLink: { padding: 8 },
  cancelLinkText: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  bar: { backgroundColor: PerlaColors.tertiary, borderRadius: 6 },
  barLab: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: PerlaColors.onSurfaceVariant,
    marginTop: 8,
  },
  barVal: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    color: PerlaColors.onSurface,
  },
  miniRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  miniRowLab: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
  miniRowVal: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: PerlaColors.onSurface,
  },
  hourOption: {
    width: 60,
    height: 60,
    borderRadius: 15,
    backgroundColor: PerlaColors.tertiary + "15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PerlaColors.tertiary + "30",
  },
  hourOptionText: {
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    color: PerlaColors.tertiary,
  },
  chartTooltip: {
    position: 'absolute',
    backgroundColor: PerlaColors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '40',
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  chartTooltipText: {
    color: PerlaColors.onSurface,
    fontSize: 10,
    fontFamily: 'Manrope-Bold',
  },
});
