import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { supabase } from '@/src/lib/supabase';
import { obtenerEstadisticasDiarias } from '@/src/services/viajes.service';

/* ────────────────────────────────────────────────────────────
   THEME CONSTANTS (Neon / Cyberpunk / Solo Leveling Inspired)
   ──────────────────────────────────────────────────────────── */
const NEON = {
  bg: '#0F0C1B',
  card: '#161324',
  cardAlt: '#1A162B',
  primary: '#E040FB', // Neon Pink
  secondary: '#A855F7', // Neon Purple
  tertiary: '#8B5CF6',
  textMain: '#F8FAFC',
  textMuted: '#94A3B8',
  glow: '#E040FB40',
};

export default function CasetaStatsScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await obtenerEstadisticasDiarias();
      setStats(data || []);
    } catch (err) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  /* ─── Mock Data for charts based on DB limits ────── */
  // We'll use actual data for the totals, and mock the weekly shape for the visual
  const ingresosData = [300, 600, 450, 800, 1100, 1400, 1800]; // Simulated 7-day trend
  const maxIngreso = Math.max(...ingresosData);

  const totalIngresos = stats.reduce((sum, s) => sum + (s.ingresos_totales ?? 0), 0);
  const totalPasajeros = stats.reduce((sum, s) => sum + (s.total_pasajeros ?? 0), 0);
  const totalViajes = stats.reduce((sum, s) => sum + (s.total_viajes ?? 0), 0);

  /* ─── Export Functionality ───────────────────────── */
  const handleExportCSV = async () => {
    try {
      const header = "Fecha,Barco,Viajes,Cancelados,Pasajeros,Ingresos\n";
      const rows = stats.map(s => 
        `${s.fecha},${s.barco},${s.total_viajes},${s.viajes_cancelados},${s.total_pasajeros},${s.ingresos_totales}`
      ).join('\n');
      const csvString = header + rows;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Reporte_PerlaNegra_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Native Export prompt (needs expo-sharing or expo-file-system for real save)
        Alert.alert(
          "Exportación Generada",
          "El archivo CSV se ha generado exitosamente en memoria. Para guardar en dispositivo móvil se requiere el módulo de compartición."
        );
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo generar el documento CSV.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={NEON.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NEON.primary} />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titleGlow}>OPERATIONAL MATRIX</Text>
          <Text style={styles.subtitle}>System Online · {new Date().toLocaleDateString()}</Text>
        </View>
        <Pressable style={styles.exportBtn} onPress={handleExportCSV}>
          <Text style={styles.exportBtnText}>EXPORT CSV</Text>
        </Pressable>
      </View>
      <View style={styles.headerLine} />

      {/* ── Main Profile Grid (2 columns on tablet, but stacked on mobile) ── */}
      <View style={styles.gridSection}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarGlowContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>🏴‍☠️</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Administrador</Text>
            <Text style={styles.profileRank}>Rango: Master</Text>
          </View>
          <View style={styles.profileStats}>
            <StatRow icon="👥" label="Pasajeros" value={totalPasajeros} />
            <StatRow icon="🚢" label="Viajes" value={totalViajes} />
            <StatRow icon="💰" label="Ingresos" value={`$${totalIngresos}`} />
          </View>
          {/* Progress Bar (HP styled) */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.barLabel}>Capacidad Diaria (80%)</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: '80%' }]} />
            </View>
          </View>
        </View>

        {/* Weekly Trend (Bar Tracker) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>WEEKLY TREND</Text>
          <View style={styles.barsContainer}>
            {ingresosData.map((val, i) => {
              const pct = (val / maxIngreso) * 100;
              return (
                <View key={i} style={styles.barTrack}>
                  <View style={[styles.barGlow, { height: `${pct}%` }]} />
                  <Text style={styles.barXLabel}>{(i + 1).toString()}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.trendFooter}>
            <Text style={styles.trendUp}>UP +14%</Text>
            <Text style={styles.trendSub}>Semana actual</Text>
          </View>
        </View>
      </View>

      {/* ── Middle Section ── */}
      <View style={styles.gridSection}>
        {/* Skill Tracker (Horizontal bars) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>KPI TRACKER</Text>
          <HorizontalBar label="Puntualidad" icon="⏱️" value={92} />
          <HorizontalBar label="Ventas app" icon="📱" value={45} />
          <HorizontalBar label="Efectivo" icon="💵" value={78} />
          <HorizontalBar label="Satisfacción" icon="⭐" value={98} />
        </View>

        {/* Glowing Gradient Bars (Revenue) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>REVENUE MODULE</Text>
          <View style={styles.revenueHeader}>
            <View><Text style={styles.revVal}>12k</Text><Text style={styles.revLab}>Esta Sem</Text></View>
            <View><Text style={styles.revVal}>18k</Text><Text style={styles.revLab}>Pasada</Text></View>
            <View><Text style={styles.revVal}>45k</Text><Text style={styles.revLab}>Mensual</Text></View>
          </View>
          <View style={styles.revenueBarsContainer}>
            {[40, 20, 60, 30, 90, 80].map((v, i) => (
              <View key={i} style={styles.revenueBarBin}>
                <View style={[styles.revenueBarInner, { height: `${v}%` }]} />
                <View style={[styles.revenueBarGlowTop, { bottom: `${v}%` }]} />
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Bottom Section ── */}
      <View style={styles.gridSection}>
        {/* Ring / Goal Completion */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>OCCUPANCY RATE</Text>
          <View style={styles.ringContainer}>
            <Svg width="140" height="140" viewBox="0 0 140 140">
              <Defs>
                <SvgGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={NEON.primary} />
                  <Stop offset="1" stopColor={NEON.secondary} />
                </SvgGradient>
              </Defs>
              <Circle cx="70" cy="70" r="50" stroke={NEON.cardAlt} strokeWidth="16" fill="none" />
              <Circle 
                cx="70" cy="70" r="50" 
                stroke="url(#grad)" 
                strokeWidth="16" 
                fill="none" 
                strokeDasharray="314" 
                strokeDashoffset={314 * 0.25} 
                strokeLinecap="round" 
                transform="rotate(-90 70 70)"
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringVal}>75%</Text>
              <Text style={styles.ringLab}>Lleno</Text>
            </View>
          </View>
          <View style={styles.ringDots}>
            <View style={styles.ringDot} /><View style={styles.ringDot} /><View style={styles.ringDot} />
          </View>
        </View>

        {/* Small Widgets stack */}
        <View style={{ flex: 1, gap: 16 }}>
          <View style={styles.card}>
            <View style={styles.widgetRow}>
              <Text style={styles.widgetIcon}>📦</Text>
              <View>
                <Text style={styles.widgetTitle}>Paquetes Populares</Text>
                <Text style={styles.widgetDesc}>1. Básico  2. Comida</Text>
              </View>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.widgetRow}>
              <Text style={styles.widgetIcon}>⚠️</Text>
              <View>
                <Text style={styles.widgetTitle}>Alertas del Sistema</Text>
                <Text style={styles.widgetDesc}>Clima óptimo para zarpado</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      
    </ScrollView>
  );
}

/* ── Components ── */
function StatRow({ icon, label, value }: { icon: string, label: string, value: string | number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function HorizontalBar({ label, icon, value }: { label: string, icon: string, value: number }) {
  return (
    <View style={styles.horizBarRow}>
      <View style={styles.horizBarIconContainer}><Text>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.horizBarLabel}>{label}</Text>
        <View style={styles.horizBarBg}>
          <View style={[styles.horizBarFill, { width: `${value}%` }]} />
        </View>
      </View>
      <Text style={styles.horizBarVal}>{value}%</Text>
    </View>
  );
}


/* ── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEON.bg },
  content: { paddingHorizontal: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  titleGlow: { 
    fontFamily: 'Newsreader-Bold', fontSize: 24, color: NEON.textMain, 
    textShadowColor: NEON.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
    letterSpacing: 2, textTransform: 'uppercase',
  },
  subtitle: { fontFamily: 'Manrope', fontSize: 12, color: NEON.textMuted, marginTop: 4 },
  
  exportBtn: {
    backgroundColor: NEON.primary + '20', borderWidth: 1, borderColor: NEON.primary,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    shadowColor: NEON.primary, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  exportBtnText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: NEON.primary, letterSpacing: 1 },
  
  headerLine: { height: 1, backgroundColor: NEON.primary + '30', marginVertical: 16 },

  gridSection: { flexDirection: 'column', gap: 16, marginBottom: 16 }, // Mobile optimized, no dual columns without wrapper width checks
  card: {
    backgroundColor: NEON.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: NEON.primary + '15',
  },
  cardTitle: { fontFamily: 'Manrope-Bold', fontSize: 12, color: NEON.textMain, letterSpacing: 1.5, marginBottom: 16 },

  /* Profile Card */
  profileCard: {
    backgroundColor: NEON.card, borderRadius: 16, padding: 20, 
    borderWidth: 1, borderColor: NEON.primary + '15',
  },
  avatarGlowContainer: {
    alignSelf: 'center', marginBottom: 12,
    borderRadius: 50, shadowColor: NEON.primary, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: NEON.cardAlt,
    borderWidth: 2, borderColor: NEON.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 32 },
  profileInfo: { alignItems: 'center', marginBottom: 16 },
  profileName: { fontFamily: 'Newsreader-Bold', fontSize: 20, color: NEON.textMain, textShadowColor: NEON.glow, textShadowRadius: 5 },
  profileRank: { fontFamily: 'Manrope', fontSize: 12, color: NEON.secondary },
  profileStats: { gap: 8, backgroundColor: NEON.cardAlt, padding: 12, borderRadius: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statIcon: { fontSize: 12, marginRight: 8 },
  statLabel: { fontFamily: 'Manrope', fontSize: 12, color: NEON.textMuted },
  statValue: { fontFamily: 'Manrope-Bold', fontSize: 13, color: NEON.textMain },
  
  barLabel: { fontFamily: 'Manrope-Bold', fontSize: 10, color: NEON.textMuted, marginBottom: 4, letterSpacing: 1 },
  barBg: { height: 8, backgroundColor: NEON.cardAlt, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: NEON.primary, borderRadius: 4 },

  /* Weekly Bars */
  barsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, marginBottom: 16 },
  barTrack: { width: '10%', height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barGlow: { width: '100%', backgroundColor: NEON.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4, shadowColor: NEON.primary, shadowRadius: 8, shadowOpacity: 0.8 },
  barXLabel: { fontFamily: 'Manrope-Bold', fontSize: 9, color: NEON.textMuted, marginTop: 8 },
  trendFooter: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  trendUp: { fontFamily: 'Manrope-Bold', fontSize: 13, color: NEON.primary },
  trendSub: { fontFamily: 'Manrope', fontSize: 11, color: NEON.textMuted },

  /* Horiz Bars */
  horizBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  horizBarIconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: NEON.cardAlt, alignItems: 'center', justifyContent: 'center' },
  horizBarLabel: { fontFamily: 'Manrope', fontSize: 11, color: NEON.textMain, marginBottom: 4 },
  horizBarBg: { height: 4, backgroundColor: NEON.cardAlt, borderRadius: 2 },
  horizBarFill: { height: '100%', backgroundColor: NEON.secondary, borderRadius: 2 },
  horizBarVal: { fontFamily: 'Manrope-Bold', fontSize: 11, color: NEON.textMuted },

  /* Glowing Vertical Bars (Revenue) */
  revenueHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  revVal: { fontFamily: 'Newsreader-Bold', fontSize: 16, color: NEON.textMain },
  revLab: { fontFamily: 'Manrope', fontSize: 10, color: NEON.textMuted },
  revenueBarsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 100 },
  revenueBarBin: { width: 24, height: '100%', justifyContent: 'flex-end', backgroundColor: NEON.cardAlt, borderRadius: 12, paddingHorizontal: 4, paddingBottom: 4 },
  revenueBarInner: { width: '100%', backgroundColor: NEON.primary + '80', borderRadius: 8 },
  revenueBarGlowTop: { position: 'absolute', width: 24, height: 10, backgroundColor: '#fff', borderRadius: 5, shadowColor: NEON.primary, shadowRadius: 15, shadowOpacity: 1, elevation: 5 },

  /* Ring Chart */
  ringContainer: { alignItems: 'center', marginVertical: 10 },
  ringCenter: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  ringVal: { fontFamily: 'Newsreader-Bold', fontSize: 24, color: NEON.textMain },
  ringLab: { fontFamily: 'Manrope', fontSize: 11, color: NEON.textMuted },
  ringDots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  ringDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: NEON.primary + '40' },

  /* Tiny widgets */
  widgetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  widgetIcon: { fontSize: 24, padding: 10, backgroundColor: NEON.cardAlt, borderRadius: 12 },
  widgetTitle: { fontFamily: 'Manrope-Bold', fontSize: 13, color: NEON.textMain },
  widgetDesc: { fontFamily: 'Manrope', fontSize: 11, color: NEON.textMuted },
});
