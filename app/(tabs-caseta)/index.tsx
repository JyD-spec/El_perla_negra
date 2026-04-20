import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { 
  Circle, 
  Path, 
  Defs, 
  LinearGradient as SvgGradient, 
  Stop,
  G,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { PerlaColors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { obtenerVistaOperativa, obtenerEstadisticasDiarias } from '@/src/services/viajes.service';

import { globalEvents } from '@/src/lib/events';

const { width } = Dimensions.get('window');
const SPACING = 16;
const CONTAINER_PADDING = 20;
const FULL_WIDTH = width - (CONTAINER_PADDING * 2);

type TimeRange = 'hoy' | '7d' | '30d' | 'personalizado';

/* ────────────────────────────────────────────────────────────
   MASTER DASHBOARD V2 (Caseta Operations & Analytics)
   ──────────────────────────────────────────────────────────── */

export default function CasetaMasterDashboard() {
  const insets = useSafeAreaInsets();
  
  /* ── State ─────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('hoy');
  const [compareMode, setCompareMode] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const [liveTrips, setLiveTrips] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any>({
    sales: [20, 45, 28, 80, 99, 43, 50],
    pax: [15, 30, 45, 35, 60, 50, 65],
    boats: [
      { name: 'Perla Negra', val: 85 },
      { name: 'Holandés Errante', val: 65 },
      { name: 'Venganza Reina Ana', val: 45 },
    ],
    attendance: { boarded: 75, noShow: 25 },
    topPackage: 'Aventura Pirata',
    topVendor: 'Barbosa',
    scheduledToday: 12
  });

  const fetchData = useCallback(async () => {
    try {
      const trips = await obtenerVistaOperativa();
      setLiveTrips(trips || []);
      // In a real scenario, fetch based on timeRange
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
    
    // FAB event listener
    const unsubscribe = globalEvents.on('fab-press-index', () => {
      setShowExportModal(true);
    });

    return () => unsubscribe();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
        <Text style={styles.loadingText}>Desplegando Bitácora de Mando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Background decoration */}
      <View style={styles.glowTop} />

      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: 120 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PerlaColors.tertiary} />
        }
      >
        {/* ── 1. ACTION: Export ── */}
        <View style={styles.headerRow}>
          <Text style={styles.dashTitle}>ESTADÍSTICAS</Text>
          <Pressable style={styles.exportBtn} onPress={() => setShowExportModal(true)}>
            <IconSymbol name="square.and.arrow.up.fill" size={12} color={PerlaColors.onTertiary} />
            <Text style={styles.exportText}>EXPORTAR REPORTE</Text>
          </Pressable>
        </View>

        {/* ── Export Format Modal ── */}
        <Modal visible={showExportModal} transparent animationType="fade">
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setShowExportModal(false)}
          >
            <BlurView intensity={20} tint="dark" style={styles.exportModalContent}>
              <Text style={styles.exportModalTitle}>Exportar Reporte</Text>
              <Text style={styles.exportModalSub}>Selecciona el formato de tu bitácora</Text>
              
              <View style={styles.exportOptions}>
                <Pressable 
                  style={styles.exportOption} 
                  onPress={() => {
                    console.log('Exporting PDF...');
                    setShowExportModal(false);
                  }}
                >
                  <View style={[styles.exportIconBox, { backgroundColor: '#FF525222' }]}>
                    <Text style={{ fontSize: 24 }}>📄</Text>
                  </View>
                  <Text style={styles.exportOptionText}>PDF</Text>
                </Pressable>

                <Pressable 
                  style={styles.exportOption}
                  onPress={() => {
                    console.log('Exporting Excel...');
                    setShowExportModal(false);
                  }}
                >
                  <View style={[styles.exportIconBox, { backgroundColor: '#4CAF5022' }]}>
                    <Text style={{ fontSize: 24 }}>xlsx</Text>
                  </View>
                  <Text style={styles.exportOptionText}>Excel</Text>
                </Pressable>
              </View>

              <Pressable 
                style={styles.cancelLink} 
                onPress={() => setShowExportModal(false)}
              >
                <Text style={styles.cancelLinkText}>Cancelar</Text>
              </Pressable>
            </BlurView>
          </Pressable>
        </Modal>

        {/* ── 2. OPERATION: Current Trips ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.pulseDot} />
          <Text style={styles.sectionLabel}>VIAJES ACTUALES</Text>
        </View>

        <View style={styles.tripCard}>
          {liveTrips.length === 0 ? (
            <Text style={styles.emptyText}>No hay naves en navegación actualmente.</Text>
          ) : (
            liveTrips.slice(0, 3).map((trip, idx) => (
              <View key={trip.id_viaje} style={[styles.tripRow, idx === 0 && { borderTopWidth: 0 }]}>
                <View style={styles.boatCol}>
                  <View style={styles.boatBubble}>
                    <IconSymbol name="sailboat.fill" size={14} color={PerlaColors.tertiary} />
                  </View>
                  <Text style={styles.boatName} numberOfLines={1}>{trip.nombre_barco}</Text>
                </View>
                
                <View style={styles.dataGrid}>
                  <View style={styles.dataCol}>
                    <Text style={styles.dataVal}>{trip.hora_salida_programada?.slice(0,5)} - {trip.hora_limite_zarpe?.slice(0,5)}</Text>
                    <Text style={styles.dataLab}>ZARPE - REGRESO</Text>
                  </View>
                  <View style={styles.paxMoneyCol}>
                    <View style={styles.miniStat}>
                      <Text style={styles.dataVal}>45</Text>
                      <Text style={styles.dataLab}>PAX</Text>
                    </View>
                    <View style={[styles.miniStat, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.dataVal, { color: PerlaColors.tertiary }]}>$12k</Text>
                      <Text style={styles.dataLab}>MONTO</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── 3. FILTERS: Time ── */}
        <View style={styles.filterSection}>
          <View style={styles.filterTabs}>
            {(['hoy', '7d', '30d', 'personalizado'] as TimeRange[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setTimeRange(r)}
                style={[styles.filterTab, timeRange === r && styles.filterTabActive]}
              >
                <Text style={[styles.filterTabText, timeRange === r && styles.filterTabTextActive]}>
                  {r === 'personalizado' ? '...' : r.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          
          {timeRange === 'personalizado' && (
            <BlurView intensity={20} tint="dark" style={styles.customFilterBox}>
              <View style={styles.customRow}>
                <Pressable style={styles.dateSelector}><Text style={styles.dateText}>Inicio - Fin</Text></Pressable>
                <Pressable 
                  style={[styles.compareToggle, compareMode && styles.compareActive]}
                  onPress={() => setCompareMode(!compareMode)}
                >
                  <Text style={styles.compareText}>COMPARAR</Text>
                </Pressable>
              </View>
            </BlurView>
          )}
        </View>

        {/* ── 4. ANALYTICS ── */}
        
        {/* Sales Trend */}
        <View style={styles.chartTile}>
          <Text style={styles.tileTitle}>TENDENCIAS DE VENTAS</Text>
          <LineChart data={statsData.sales} color={PerlaColors.tertiary} />
        </View>

        {/* Customer Trend */}
        <View style={styles.chartTile}>
          <Text style={styles.tileTitle}>TENDENCIAS CLIENTES</Text>
          <LineChart data={statsData.pax} color={PerlaColors.primary} area />
        </View>

        {/* Boats Distribution & Top Vendor (Row) */}
        <View style={styles.bentoRow}>
          <View style={[styles.tile, { flex: 1.2 }]}>
            <Text style={styles.tileTitle}>BARCOS SOLICITADOS</Text>
            {statsData.boats.map((b: any, i: number) => (
              <View key={i} style={styles.boatRankRow}>
                <Text style={styles.rankLabel}>{b.name}</Text>
                <View style={styles.rankTrack}>
                  <View style={[styles.rankFill, { width: `${b.val}%`, backgroundColor: i === 0 ? PerlaColors.tertiary : PerlaColors.primary }]} />
                </View>
              </View>
            ))}
          </View>
          
          <View style={[styles.tile, { flex: 0.8 }]}>
            <Text style={styles.tileTitle}>VENDEDOR TOP</Text>
            <View style={styles.centerBox}>
              <View style={styles.vendorAvatar}><Text style={{fontSize: 24}}>🏴‍☠️</Text></View>
              <Text style={styles.hugeVal}>{statsData.topVendor}</Text>
              <Text style={styles.subVal}>Líder del Mes</Text>
            </View>
          </View>
        </View>

        {/* Attendance (Pie Chart) - GLOBAL */}
        <View style={styles.chartTile}>
          <Text style={styles.tileTitle}>ASISTENCIA GLOBAL</Text>
          <View style={styles.pieContainer}>
            <AttendancePie boarded={78} noShow={22} />
            <View style={styles.pieLegend}>
              <LegendItem color={PerlaColors.tertiary} label="Subieron" val="78%" />
              <LegendItem color={PerlaColors.surfaceContainerHighest} label="No-show" val="22%" />
            </View>
          </View>
        </View>

        {/* Bottom Bento: Top Package & Scheduled */}
        <View style={styles.bentoRow}>
          <View style={[styles.tile, { flex: 1, backgroundColor: PerlaColors.secondary + '20' }]}>
            <Text style={styles.tileTitle}>PAQUETE REY</Text>
            <Text style={styles.heroVal}>{statsData.topPackage}</Text>
            <Text style={styles.subVal}>Favorito de los clientes</Text>
          </View>
          <View style={[styles.tile, { width: 120 }]}>
            <Text style={styles.tileTitle}>PROG. HOY</Text>
            <Text style={styles.heroVal}>{statsData.scheduledToday}</Text>
            <Text style={styles.subVal}>Viajes en bitácora</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

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

function AttendancePie({ boarded, noShow }: any) {
  const size = 120;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c - (boarded / 100) * c;

  return (
    <View style={styles.pieWrapper}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={r} stroke={PerlaColors.surfaceContainerHighest} strokeWidth={stroke} fill="none" />
        <Circle 
          cx={size/2} cy={size/2} r={r} 
          stroke={PerlaColors.tertiary} 
          strokeWidth={stroke} 
          fill="none" 
          strokeDasharray={c} 
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={styles.pieCenter}>
        <Text style={styles.pieCenterVal}>{boarded}%</Text>
      </View>
    </View>
  );
}

function LineChart({ data, color, area }: { data: number[], color: string, area?: boolean }) {
  const h = 80;
  const w = FULL_WIDTH - 40;
  const stepX = w / (data.length - 1);
  const getPath = (points: number[]) => points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${h - (v / 100) * h}`).join(' ');

  return (
    <View style={{ height: h, marginTop: 16 }}>
      <Svg height={h} width={w}>
        <Defs><SvgGradient id="grad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.3" /><Stop offset="1" stopColor={color} stopOpacity="0" /></SvgGradient></Defs>
        {area && <Path d={`${getPath(data)} L ${w} ${h} L 0 ${h} Z`} fill="url(#grad)" />}
        <Path d={getPath(data)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {data.map((v, i) => <Circle key={i} cx={i * stepX} cy={h - (v / 100) * h} r="3.5" fill={PerlaColors.surface} stroke={color} strokeWidth="2" />)}
      </Svg>
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.surface },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontFamily: 'Manrope', color: PerlaColors.onSurfaceVariant, fontSize: 13 },
  content: { paddingHorizontal: CONTAINER_PADDING },
  
  glowTop: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: PerlaColors.tertiary + '05' },

  /* 1. Header */
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  dashTitle: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: PerlaColors.onSurface, letterSpacing: 1 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: PerlaColors.tertiary,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 8, elevation: 4,
  },
  exportText: { fontFamily: 'Manrope-Bold', fontSize: 10, color: PerlaColors.onTertiary, letterSpacing: 0.5 },

  /* 2. Live Trips */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5252', marginRight: 8 },
  sectionLabel: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#FF5252', letterSpacing: 1.5 },
  
  tripCard: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: PerlaColors.outlineVariant, marginBottom: 24 },
  tripRow: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: PerlaColors.outlineVariant, gap: 12 },
  boatCol: { width: 90, alignItems: 'center' },
  boatBubble: { width: 36, height: 36, borderRadius: 18, backgroundColor: PerlaColors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  boatName: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurface, textAlign: 'center' },
  dataGrid: { flex: 1, flexDirection: 'row', gap: 12 },
  dataCol: { flex: 1, justifyContent: 'center' },
  paxMoneyCol: { flex: 1.2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniStat: { alignItems: 'flex-start' },
  dataVal: { fontFamily: 'Newsreader-Bold', fontSize: 14, color: PerlaColors.onSurface },
  dataLab: { fontFamily: 'Manrope', fontSize: 8, color: PerlaColors.onSurfaceVariant, letterSpacing: 0.5 },
  emptyText: { padding: 20, color: PerlaColors.onSurfaceVariant, textAlign: 'center', fontFamily: 'Manrope' },

  /* 3. Filters */
  filterSection: { marginBottom: 24 },
  filterTabs: { flexDirection: 'row', backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 14, padding: 4 },
  filterTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  filterTabActive: { backgroundColor: PerlaColors.surfaceContainerHigh },
  filterTabText: { fontFamily: 'Manrope-Bold', fontSize: 10, color: PerlaColors.onSurfaceVariant },
  filterTabTextActive: { color: PerlaColors.tertiary },
  customFilterBox: { marginTop: 12, borderRadius: 16, padding: 12, overflow: 'hidden', backgroundColor: PerlaColors.surfaceContainerLow },
  customRow: { flexDirection: 'row', gap: 10 },
  dateSelector: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: PerlaColors.surfaceContainerHigh, justifyContent: 'center' },
  dateText: { color: PerlaColors.onSurface, fontSize: 11, fontFamily: 'Manrope' },
  compareToggle: { padding: 10, borderRadius: 8, backgroundColor: PerlaColors.surfaceContainerHigh, justifyContent: 'center' },
  compareActive: { backgroundColor: PerlaColors.tertiary },
  compareText: { fontSize: 10, fontFamily: 'Manrope-Bold', color: PerlaColors.onSurfaceVariant },

  /* 4. Analytics Titles & Bento */
  chartTile: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: PerlaColors.outlineVariant },
  tileTitle: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurfaceVariant, letterSpacing: 1.5, marginBottom: 4 },
  bentoRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  tile: { backgroundColor: PerlaColors.surfaceContainerLow, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: PerlaColors.outlineVariant },
  
  boatRankRow: { marginBottom: 10 },
  rankLabel: { fontFamily: 'Manrope', fontSize: 10, color: PerlaColors.onSurfaceVariant, marginBottom: 4 },
  rankTrack: { height: 4, backgroundColor: PerlaColors.surfaceContainerHigh, borderRadius: 2, overflow: 'hidden' },
  rankFill: { height: '100%', borderRadius: 2 },

  centerBox: { alignItems: 'center', marginTop: 12 },
  vendorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: PerlaColors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  hugeVal: { fontFamily: 'Newsreader-Bold', fontSize: 22, color: PerlaColors.onSurface },
  subVal: { fontFamily: 'Manrope', fontSize: 9, color: PerlaColors.onSurfaceVariant },
  heroVal: { fontFamily: 'Newsreader-Bold', fontSize: 20, color: PerlaColors.onSurface, marginTop: 12 },

  /* Pie Chart */
  pieContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 12 },
  pieWrapper: { alignItems: 'center', justifyContent: 'center' },
  pieCenter: { position: 'absolute', alignItems: 'center' },
  pieCenterVal: { fontFamily: 'Newsreader-Bold', fontSize: 22, color: PerlaColors.onSurface },
  pieLegend: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendLab: { fontFamily: 'Manrope', fontSize: 11, color: PerlaColors.onSurfaceVariant },
  legendVal: { fontFamily: 'Manrope-Bold', fontSize: 11, color: PerlaColors.onSurface },

  /* Export Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  exportModalContent: {
    width: '100%',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant,
    overflow: 'hidden',
  },
  exportModalTitle: {
    fontFamily: 'Newsreader-Bold',
    fontSize: 24,
    color: PerlaColors.onSurface,
    marginBottom: 8,
  },
  exportModalSub: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 24,
    textAlign: 'center',
  },
  exportOptions: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  exportOption: {
    alignItems: 'center',
    gap: 8,
  },
  exportIconBox: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant,
  },
  exportOptionText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: PerlaColors.onSurface,
  },
  cancelLink: {
    padding: 8,
  },
  cancelLinkText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },
});
