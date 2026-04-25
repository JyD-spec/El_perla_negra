import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import { PerlaColors } from '@/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { getLocalDateString } from '@/src/lib/time';
import { obtenerDescuentos, obtenerPaquetes } from '@/src/services/catalogos.service';
import type { Descuento, Paquete } from '@/src/lib/database.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 600;

/* ────────────────────────────────────────────────────────────
   Home Screen – El Perla Negra
   Nautical Editorial ("The Cartographer's Ledger") design
   ──────────────────────────────────────────────────────────── */

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useSharedValue(0);

  /* ── Live data state ─────────────────────────── */
  const [weather, setWeather] = useState({ icon: '☀️', text: 'Cargando...' });
  const [seats, setSeats] = useState({ taken: 0, capacity: 0, label: 'Cargando...' });
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);

  /* ── Fetch weather (Open-Meteo, free, no key) ──────── */
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Puerto Vallarta coordinates
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=20.6534&longitude=-105.2253&current=temperature_2m,weather_code&timezone=America/Mexico_City'
        );
        const data = await res.json();
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const wmo: Record<number, { icon: string; label: string }> = {
          0: { icon: '☀️', label: 'Despejado' },
          1: { icon: '🌤️', label: 'Casi despejado' },
          2: { icon: '⛅', label: 'Parcialmente nublado' },
          3: { icon: '☁️', label: 'Nublado' },
          45: { icon: '🌫️', label: 'Niebla' },
          48: { icon: '🌫️', label: 'Niebla helada' },
          51: { icon: '🌦️', label: 'Llovizna' },
          53: { icon: '🌦️', label: 'Llovizna' },
          55: { icon: '🌧️', label: 'Llovizna fuerte' },
          61: { icon: '🌧️', label: 'Lluvia ligera' },
          63: { icon: '🌧️', label: 'Lluvia' },
          65: { icon: '⛈️', label: 'Lluvia fuerte' },
          80: { icon: '🌦️', label: 'Chubascos' },
          81: { icon: '🌧️', label: 'Chubascos' },
          82: { icon: '⛈️', label: 'Tormenta' },
          95: { icon: '⚡', label: 'Tormenta eléctrica' },
          96: { icon: '⚡', label: 'Granizo' },
          99: { icon: '⚡', label: 'Granizo fuerte' },
        };
        const w = wmo[code] || { icon: '☀️', label: 'Soleado' };
        setWeather({ icon: w.icon, text: `${w.label}, ${temp}°C` });
      } catch {
        setWeather({ icon: '☀️', text: 'Soleado, 28°C' });
      }
    };
    fetchWeather();
    const iv = setInterval(fetchWeather, 60_000);
    return () => clearInterval(iv);
  }, []);

  /* ── Fetch next active trip seats (real-time) ──────── */
  useEffect(() => {
    const fetchSeats = async () => {
      const today = getLocalDateString();
      // Get next Programado/Abordando trip for El Perla Negra
      const { data: trip } = await supabase
        .from('viaje')
        .select('id_viaje, embarcacion!inner ( nombre, capacidad_maxima )')
        .eq('fecha_programada', today)
        .eq('embarcacion.nombre', 'El Perla Negra')
        .in('estado_viaje', ['Programado', 'Abordando'])
        .order('hora_salida_programada', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!trip) {
        setSeats({ taken: 0, capacity: 0, label: 'Sin viajes hoy' });
        return;
      }

      // @ts-ignore - Supabase types inner joins as arrays sometimes, or objects
      const cap = Array.isArray(trip.embarcacion) 
        ? trip.embarcacion[0]?.capacidad_maxima ?? 0 
        : (trip.embarcacion as any)?.capacidad_maxima ?? 0;

      const { data: reservas } = await supabase
        .from('reservacion')
        .select('cantidad_personas')
        .eq('id_viaje', trip.id_viaje)
        .neq('estado_pase', 'Rechazado');

      const taken = (reservas ?? []).reduce((s, r) => s + r.cantidad_personas, 0);
      const avail = Math.max(0, cap - taken);
      setSeats({ taken, capacity: cap, label: `${avail} Disponibles` });
    };

    fetchSeats();

    // Real-time subscription for reservation changes
    const channel = supabase
      .channel('home-seats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservacion' }, fetchSeats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /* ── Fetch Catalogos (Paquetes y Descuentos) ──────── */
  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const [paquetesData, descuentosData] = await Promise.all([
          obtenerPaquetes(),
          obtenerDescuentos(),
        ]);
        setPaquetes(paquetesData);
        // Sort by ID desc to get newest, take top 3
        const sortedDescuentos = [...descuentosData].sort((a, b) => b.id_descuento - a.id_descuento).slice(0, 3);
        setDescuentos(sortedDescuentos);
      } catch (e) {
        console.error('Error fetching catalogos', e);
      }
    };
    fetchCatalogos();
  }, []);

  /* ── Get specific packages by keyword ──────────────── */
  const paqueteCompleto = paquetes.find(p => p.descripcion.toLowerCase().includes('comida') || p.descripcion.toLowerCase().includes('completo'));
  const paqueteFiesta = paquetes.find(p => p.descripcion.toLowerCase().includes('bebida'));
  const paqueteBasico = paquetes.find(p => p.descripcion.toLowerCase().includes('paseo'));

  /* ── Card interaction state ──────────────────────── */
  const [basicExpanded, setBasicExpanded] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<string | null>(null);

  const DRINKS = [
    { id: 'mojito', name: 'Mojito', icon: '🍸' },
    { id: 'pinacolada', name: 'Piña Colada', icon: '🍹' },
    { id: 'margarita', name: 'Margarita', icon: '🍋' },
    { id: 'cerveza', name: 'Cerveza', icon: '🍺' },
    { id: 'ron', name: 'Ron Añejo', icon: '🥃' },
  ];

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  /* Header bar opacity fades in after scrolling past the hero */
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [200, 350], [0, 1], Extrapolation.CLAMP),
  }));

  /* Parallax on hero image */
  const heroImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-200, 0, HERO_HEIGHT], [-100, 0, 150], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-200, 0], [1.4, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={[styles.root, { paddingTop: 0 }]}>
      {/* ── Sticky Header ──────────────────────────────── */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top + 8 },
          headerStyle,
        ]}
      >
        <Text style={styles.headerTitle}>El Perla Negra</Text>
      </Animated.View>

      {/* ── Main Scroll ────────────────────────────────── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* ── Hero Section ─────────────────────────────── */}
        <View style={styles.heroContainer}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImageStyle]}>
            <Image
              source={require('@/assets/images/hero-ship.jpg')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={600}
            />
            {/* Dark overlay for readability */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,19,18,0.55)' }]} />
          </Animated.View>

          {/* Gradient bottom fade — stronger on mobile for seamless blend */}
          <LinearGradient
            colors={[
              'transparent',
              PerlaColors.surface + '40',
              PerlaColors.surface + 'B3',
              PerlaColors.surface + 'E6',
              PerlaColors.surface,
            ]}
            locations={[0.1, 0.4, 0.6, 0.8, 1]}
            style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
          />

          {/* Hero content */}
          <View style={[styles.heroContent, { paddingTop: insets.top + 60 }]}>
            <Text style={styles.heroHeadline}>
              Tu Aventura Pirata{'\n'}
              <Text style={styles.heroHeadlineAccent}>Comienza Aquí</Text>
            </Text>

            {/* Info Chips */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Text style={styles.chipIcon}>{weather.icon}</Text>
                <Text style={styles.chipText}>{weather.text}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipIcon}>⛵</Text>
                <Text style={styles.chipText}>{seats.label}</Text>
              </View>
            </View>

            {/* CTA Button */}
            <Pressable
              style={styles.ctaButton}
              onPress={() => router.push({ pathname: '/(tabs-comprador)/reserve', params: { paquete: 'comida' } })}
            >
              <Text style={styles.ctaText}>Reservar mi Aventura</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Packages Section ─────────────────────────── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Planes de Navegación</Text>
          <Text style={styles.sectionSubtitle}>
            Selecciona el paquete que mejor se adapte a tu tripulación y embárcate en un viaje inolvidable.
          </Text>

          {/* ── Discount Banner ───────────────────────── */}
          {descuentos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discountsScroll}>
              {descuentos.map(d => (
                <View key={d.id_descuento} style={[styles.discountBanner, { marginRight: 12 }]}>
                  <Text style={styles.discountIcon}>🏷️</Text>
                  <Text style={styles.discountText}>
                    {d.nombre}: {d.porcentaje}% off
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ height: 20 }} />

          {/* ═══════════════════════════════════════════
              CARD 1: Paquete Completo — Direct to Reserve
              ═══════════════════════════════════════════ */}
          <View style={styles.completoCard}>
            <View style={styles.completoImageWrap}>
              <Image
                source={require('@/assets/images/paquete-completo.jpg')}
                style={styles.completoImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', PerlaColors.surfaceContainerLow + 'E6', PerlaColors.surfaceContainerLow]}
                locations={[0.2, 0.7, 1]}
                style={StyleSheet.absoluteFill}
              />
            </View>

            <View style={styles.completoContent}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>Recomendado</Text>
              </View>
              <Text style={styles.cardTitle}>🍽️  Paquete Completo</Text>
              <Text style={styles.cardDescription}>Paseo + Comida Incluida</Text>

              <View style={styles.completoFooter}>
                <View>
                  <Text style={styles.priceLabel}>Por persona</Text>
                  <Text style={styles.priceValue}>${paqueteCompleto ? paqueteCompleto.costo_persona : '450'} MXN</Text>
                </View>
                <Pressable
                  style={styles.elegirButton}
                  onPress={() => router.push({ pathname: '/(tabs-comprador)/reserve', params: { paquete: 'comida' } })}
                >
                  <Text style={styles.elegirText}>Reservar →</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ═══════════════════════════════════════════
              CARD 2: Paquete Fiesta — Drink Selector
              ═══════════════════════════════════════════ */}
          <View style={styles.fiestaCard}>
            {/* Card image header */}
            <View style={styles.fiestaImageWrap}>
              <Image
                source={require('@/assets/images/fiesta-drinks.jpg')}
                style={styles.fiestaImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', PerlaColors.surfaceContainerLow + 'E6', PerlaColors.surfaceContainerLow]}
                locations={[0.2, 0.7, 1]}
                style={StyleSheet.absoluteFill}
              />
            </View>

            <View style={styles.fiestaContent}>
              <Text style={styles.cardTitle}>🍹  Paquete Fiesta</Text>
              <Text style={styles.cardDescription}>Paseo + Bebidas incluidas</Text>

              {/* Drink pre-selector */}
              <Text style={styles.drinkSelectorLabel}>Reserva tu bebida favorita</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.drinkScrollRow}>
                {DRINKS.map((drink) => (
                  <Pressable
                    key={drink.id}
                    style={[
                      styles.drinkChip,
                      selectedDrink === drink.id && styles.drinkChipSelected,
                    ]}
                    onPress={() => setSelectedDrink(drink.id === selectedDrink ? null : drink.id)}
                  >
                    <Text style={styles.drinkChipIcon}>{drink.icon}</Text>
                    <Text
                      style={[
                        styles.drinkChipText,
                        selectedDrink === drink.id && styles.drinkChipTextSelected,
                      ]}
                    >
                      {drink.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.fiestaFooter}>
                <Text style={styles.packagePrice}>${paqueteFiesta ? paqueteFiesta.costo_persona : '350'} MXN</Text>
                <Pressable
                  style={[
                    styles.elegirButton,
                    !selectedDrink && styles.elegirButtonDisabled,
                  ]}
                  onPress={() => {
                    if (selectedDrink) {
                      router.push({
                        pathname: '/(tabs-comprador)/reserve',
                        params: { paquete: 'bebidas', bebida: selectedDrink },
                      });
                    }
                  }}
                >
                  <Text style={[
                    styles.elegirText,
                    !selectedDrink && styles.elegirTextDisabled,
                  ]}>
                    {selectedDrink ? 'Elegir Paquete →' : 'Elige una bebida'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ═══════════════════════════════════════════
              CARD 3: Paseo Básico — Expandable Details
              ═══════════════════════════════════════════ */}
          <View style={styles.basicCard}>
            {/* Image strip */}
            <View style={styles.basicImageWrap}>
              <Image
                source={require('@/assets/images/bay-paseo.jpg')}
                style={styles.basicImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', PerlaColors.surfaceContainerLow]}
                locations={[0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
            </View>

            <View style={styles.basicInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>🧭  Paseo Básico</Text>
                <Text style={styles.cardDescription}>Solo paseo por la bahía</Text>
              </View>
              <Text style={styles.packagePrice}>${paqueteBasico ? paqueteBasico.costo_persona : '250'} MXN</Text>
            </View>

            {/* Expand / Collapse details */}
            {!basicExpanded ? (
              <Pressable
                style={styles.detailsButton}
                onPress={() => setBasicExpanded(true)}
              >
                <Text style={styles.detailsButtonText}>Ver detalles  ▾</Text>
              </Pressable>
            ) : (
              <View style={styles.expandedSection}>
                <View style={styles.expandedDivider} />
                <Text style={styles.expandedText}>
                  Recorre la hermosa bahía de Acapulco a bordo de El Perla Negra. Disfruta del viento marino, las vistas del atardecer y la experiencia pirata por 1 hora y media de navegación. Incluye música en vivo y ambiente temático.
                </Text>

                <View style={styles.expandedFeatures}>
                  <View style={styles.featureChip}>
                    <Text style={styles.featureChipText}>⏱️ 1.5 horas</Text>
                  </View>
                  <View style={styles.featureChip}>
                    <Text style={styles.featureChipText}>🎵 Música en vivo</Text>
                  </View>
                  <View style={styles.featureChip}>
                    <Text style={styles.featureChipText}>📸 Fotos incluidas</Text>
                  </View>
                </View>

                <View style={styles.expandedActions}>
                  <Pressable
                    style={styles.elegirButton}
                    onPress={() => router.push({ pathname: '/(tabs-comprador)/reserve', params: { paquete: 'paseo' } })}
                  >
                    <Text style={styles.elegirText}>Elegir Paquete →</Text>
                  </Pressable>
                  <Pressable onPress={() => setBasicExpanded(false)}>
                    <Text style={styles.collapseText}>Ocultar  ▴</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>El Perla Negra</Text>
          <View style={styles.footerLinks}>
            <Pressable><Text style={styles.footerLink}>Privacidad</Text></Pressable>
            <Pressable><Text style={styles.footerLink}>Términos</Text></Pressable>
            <Pressable><Text style={styles.footerLink}>Ubicación</Text></Pressable>
          </View>
          <Text style={styles.footerCopy}>© 1720 El Perla Negra. Todos los horizontes reservados.</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PerlaColors.background,
  },

  /* ── Header ────────────────────────────────────────────── */
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: PerlaColors.surface + 'B3', // 70% opacity
    paddingBottom: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)' }
      : {}),
  },
  headerTitle: {
    fontFamily: 'Newsreader',
    fontSize: 20,
    color: PerlaColors.gold,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },

  /* ── Hero ──────────────────────────────────────────────── */
  heroContainer: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroContent: {
    zIndex: 2,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heroHeadline: {
    fontFamily: 'Newsreader',
    fontSize: 42,
    color: PerlaColors.onSurface,
    textAlign: 'center',
    lineHeight: 50,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  heroHeadlineAccent: {
    fontFamily: 'Newsreader-Italic',
    color: PerlaColors.tertiary,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PerlaColors.surface + 'B3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '26',
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    fontFamily: 'Manrope-Medium',
    color: PerlaColors.onSurfaceVariant,
    fontSize: 13,
  },
  ctaButton: {
    backgroundColor: PerlaColors.tertiary,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: PerlaColors.tertiary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaText: {
    fontFamily: 'Manrope-Bold',
    color: PerlaColors.onTertiary,
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* ── Packages Section ──────────────────────────────────── */
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Newsreader',
    fontSize: 32,
    color: PerlaColors.onSurface,
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontFamily: 'Manrope',
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 400,
    alignSelf: 'center',
  },
  discountsScroll: {
    flexGrow: 0,
    paddingHorizontal: 4,
  },

  /* ── Completo Card ─────────────────────────────────────── */
  completoCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  completoImageWrap: {
    height: 160,
    width: '100%',
  },
  completoImage: {
    ...StyleSheet.absoluteFillObject,
  },
  completoContent: {
    padding: 24,
    paddingTop: 8,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: PerlaColors.tertiary + '1A', // 10% opacity
    borderWidth: 1,
    borderColor: PerlaColors.tertiary + '33', // 20% opacity
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
    marginTop: -4,
  },
  badgeText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    color: PerlaColors.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  cardTitle: {
    fontFamily: 'Newsreader',
    fontSize: 26,
    color: PerlaColors.onSurface,
    marginBottom: 4,
  },
  cardTitleSmall: {
    fontFamily: 'Newsreader',
    fontSize: 20,
    color: PerlaColors.onSurface,
  },
  cardDescription: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },
  completoFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  priceLabel: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 2,
  },
  priceValue: {
    fontFamily: 'Newsreader',
    fontSize: 32,
    color: PerlaColors.tertiary,
  },
  elegirButton: {
    backgroundColor: PerlaColors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  elegirText: {
    fontFamily: 'Manrope-Bold',
    color: PerlaColors.onPrimaryContainer,
    fontSize: 14,
  },

  /* ── Fiesta Card ─────────────────────────────────────── */
  fiestaCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  fiestaImageWrap: {
    height: 160,
    width: '100%',
  },
  fiestaImage: {
    ...StyleSheet.absoluteFillObject,
  },
  fiestaContent: {
    padding: 24,
    paddingTop: 0,
    marginTop: -20,
  },
  drinkSelectorLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 12,
  },
  drinkScrollRow: {
    marginHorizontal: -4,
    marginBottom: 18,
  },
  drinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PerlaColors.surfaceContainerHighest,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  drinkChipSelected: {
    borderColor: PerlaColors.tertiary + '99',
    backgroundColor: PerlaColors.tertiary + '1A',
  },
  drinkChipIcon: {
    fontSize: 18,
  },
  drinkChipText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },
  drinkChipTextSelected: {
    color: PerlaColors.tertiary,
    fontFamily: 'Manrope-Bold',
  },
  fiestaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: PerlaColors.outlineVariant + '26',
    paddingTop: 16,
  },
  elegirButtonDisabled: {
    backgroundColor: PerlaColors.surfaceContainerHighest,
    opacity: 0.6,
  },
  elegirTextDisabled: {
    color: PerlaColors.onSurfaceVariant,
  },
  packagePrice: {
    fontFamily: 'Newsreader',
    fontSize: 22,
    color: PerlaColors.onSurface,
  },

  /* ── Basic / Paseo Card ─────────────────────────────────── */
  basicCard: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  basicImageWrap: {
    height: 130,
    width: '100%',
  },
  basicImage: {
    ...StyleSheet.absoluteFillObject,
  },
  basicInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 16,
    marginTop: -10,
  },
  detailsButton: {
    backgroundColor: PerlaColors.surface,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '4D',
    marginBottom: 20,
  },
  detailsButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: PerlaColors.onSurface,
    textAlign: 'center',
  },

  /* ── Expanded Section ────────────────────────────────── */
  expandedSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: PerlaColors.outlineVariant + '26',
    marginBottom: 18,
  },
  expandedText: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: 16,
  },
  expandedFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  featureChip: {
    backgroundColor: PerlaColors.surfaceContainerHighest,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  featureChipText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  expandedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseText: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    opacity: 0.7,
  },

  /* ── Discount Banner ───────────────────────────────────── */
  discountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PerlaColors.secondaryContainer + '33', // 20%
    borderWidth: 1,
    borderColor: PerlaColors.secondaryContainer,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  discountIcon: {
    fontSize: 18,
  },
  discountText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.secondary,
    letterSpacing: 0.3,
    flex: 1,
  },

  /* ── Footer ────────────────────────────────────────────── */
  footer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: PerlaColors.surface,
    borderTopWidth: 1,
    borderTopColor: PerlaColors.surfaceContainerHighest + '26',
    alignItems: 'center',
    gap: 16,
  },
  footerBrand: {
    fontFamily: 'Newsreader-Italic',
    fontSize: 20,
    color: PerlaColors.gold,
  },
  footerLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  footerLink: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  footerCopy: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.3,
    opacity: 0.6,
    textAlign: 'center',
  },
});
