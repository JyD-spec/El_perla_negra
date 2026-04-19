import React, { useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Animated,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Polygon, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { PerlaColors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

/* ────────────────────────────────────────────────────────
   Tab Item — Individual tab with animated active state
   ──────────────────────────────────────────────────────── */

interface TabItemProps {
  route: any;
  descriptor: any;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ route, descriptor, isFocused, onPress, onLongPress }: TabItemProps) {
  const { options } = descriptor;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  // Animate pill on focus change
  React.useEffect(() => {
    Animated.timing(pillOpacity, {
      toValue: isFocused ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, []);

  const icon = options.tabBarIcon
    ? options.tabBarIcon({
        focused: isFocused,
        color: isFocused ? PerlaColors.tertiary : PerlaColors.onSurfaceVariant,
        size: 22,
      })
    : null;

  const label =
    options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
      ? options.title
      : route.name;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      testID={options.tabBarTestID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
    >
      <Animated.View
        style={[
          styles.tabItemInner,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Active pill indicator — Design 03 style: overflows bar top & bottom */}
        <Animated.View
          style={[
            styles.activePill,
            { opacity: pillOpacity },
          ]}
        />

        {/* Icon */}
        <View style={styles.iconWrap}>{icon}</View>

        {/* Label */}
        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? PerlaColors.tertiary : PerlaColors.onSurfaceVariant,
              fontFamily: isFocused ? 'Manrope-Bold' : 'Manrope-Medium',
            },
          ]}
          numberOfLines={1}
        >
          {label as string}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* ────────────────────────────────────────────────────────
   Hexagon FAB — Design 04 style with gradient & glow
   ──────────────────────────────────────────────────────── */

function HexagonFAB({ onPress }: { onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 10,
    }).start();
  }, []);

  return (
    <View style={styles.fabContainer} pointerEvents="box-none">
      {/* Outer glow ring */}
      <View style={styles.fabGlowRing} />

      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.fabPressable}
      >
        <Animated.View
          style={[
            styles.fabButton,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Hexagon shape — pointy-top with gradient fill */}
          <Svg height="62" width="62" viewBox="0 0 62 62">
            <Defs>
              <SvgGradient id="hexGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={PerlaColors.tertiaryFixed} stopOpacity="1" />
                <Stop offset="1" stopColor={PerlaColors.tertiary} stopOpacity="1" />
              </SvgGradient>
            </Defs>
            <Polygon
              points="31,2 59,16 59,46 31,60 3,46 3,16"
              fill="url(#hexGrad)"
            />
            {/* Inner highlight line for depth */}
            <Polygon
              points="31,6 55,18 55,44 31,56 7,44 7,18"
              fill="none"
              stroke={PerlaColors.tertiaryFixed}
              strokeWidth="0.5"
              strokeOpacity={0.4}
            />
          </Svg>

          {/* Center icon */}
          <View style={styles.fabIcon}>
            <IconSymbol
              name="creditcard.fill"
              color={PerlaColors.onTertiary}
              size={26}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/* ────────────────────────────────────────────────────────
   Custom Tab Bar — main export
   ──────────────────────────────────────────────────────── */

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const handleFabPress = useCallback(() => {
    // Navigate to primary action (e.g. quick-reserve or POS)
    console.log('Center Hexagon Action Requested');
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ── Floating Bar ── */}
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const tabButton = (
            <TabItem
              key={route.key}
              route={route}
              descriptor={descriptor}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );

          // Insert hexagon spacer between first half and second half
          if (index === 0 && state.routes.length === 2) {
            return (
              <React.Fragment key={route.key}>
                {tabButton}
                <View style={styles.spacer} />
              </React.Fragment>
            );
          }

          // For 3+ tabs, insert spacer at the midpoint
          const midIndex = Math.floor(state.routes.length / 2);
          if (index === midIndex - 1 && state.routes.length > 2) {
            return (
              <React.Fragment key={route.key}>
                {tabButton}
                <View style={styles.spacer} />
              </React.Fragment>
            );
          }

          return tabButton;
        })}
      </View>

      {/* ── Center Hexagon FAB (floats above bar) ── */}
      <HexagonFAB onPress={handleFabPress} />
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const HEXAGON_SIZE = 62;
const BAR_HEIGHT = 66;
const BAR_BOTTOM_MARGIN = 14;
const BAR_HORIZONTAL_MARGIN = 20;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },

  /* ── Floating Bar ─────────────────────────────────── */
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    backgroundColor: PerlaColors.surfaceContainerLow,
    marginHorizontal: BAR_HORIZONTAL_MARGIN,
    marginBottom: BAR_BOTTOM_MARGIN,
    borderRadius: 28,
    alignItems: 'center',
    // Elevated shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    // Subtle border for definition
    borderWidth: 1,
    borderColor: PerlaColors.surfaceContainerHighest + '40',
  },

  /* ── Tab Item ─────────────────────────────────────── */
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },

  /* ── Active Pill (Design 03) ──────────────────────── */
  activePill: {
    position: 'absolute',
    width: 52,
    height: 78, // Overflows the bar top & bottom
    backgroundColor: PerlaColors.tertiary + '1A', // ~10% opacity gold tint
    borderRadius: 26,
    // Soft inner glow via border
    borderWidth: 1,
    borderColor: PerlaColors.tertiary + '26', // ~15% opacity
  },

  iconWrap: {
    marginBottom: 2,
  },

  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.3,
    marginTop: 2,
  },

  /* ── Spacer for hexagon ───────────────────────────── */
  spacer: {
    width: HEXAGON_SIZE + 8, // Hexagon + breathing room
  },

  /* ── Hexagon FAB (Design 04) ──────────────────────── */
  fabContainer: {
    position: 'absolute',
    bottom: BAR_BOTTOM_MARGIN + (BAR_HEIGHT / 2) - (HEXAGON_SIZE / 2) + 6,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fabGlowRing: {
    position: 'absolute',
    width: HEXAGON_SIZE + 16,
    height: HEXAGON_SIZE + 16,
    borderRadius: (HEXAGON_SIZE + 16) / 2,
    backgroundColor: PerlaColors.tertiary + '12', // Very subtle glow
    // Pulsing effect can be added later with Animated
  },
  fabPressable: {
    width: HEXAGON_SIZE + 4,
    height: HEXAGON_SIZE + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    width: HEXAGON_SIZE,
    height: HEXAGON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for the hexagon
    ...Platform.select({
      ios: {
        shadowColor: PerlaColors.tertiary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 14,
      },
      default: {
        shadowColor: PerlaColors.tertiary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
    }),
  },
  fabIcon: {
    position: 'absolute',
  },
});
