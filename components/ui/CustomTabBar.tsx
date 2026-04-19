import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import React, { useCallback, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgGradient,
} from "react-native-svg";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { PerlaColors } from "@/constants/theme";

/* ─── Constants ──────────────────────────────────────────── */

const HEXAGON_SIZE = 75;
const BAR_HEIGHT = 62;
const BAR_BOTTOM_MARGIN = 14;
const BAR_HORIZONTAL_MARGIN = 16;
const TAB_WIDTH = 64;

/* ────────────────────────────────────────────────────────
   Tab Item — Blobs orgánicos con Animación de Transición
   ──────────────────────────────────────────────────────── */

interface TabItemProps {
  route: any;
  descriptor: any;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({
  route,
  descriptor,
  isFocused,
  onPress,
  onLongPress,
}: TabItemProps) {
  const { options } = descriptor;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const activeAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      speed: 28,
      bounciness: 10,
    }).start();
  }, [isFocused]);

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
      speed: 18,
      bounciness: 10,
    }).start();
  }, []);

  const icon = options.tabBarIcon
    ? options.tabBarIcon({
        focused: isFocused,
        color: isFocused ? PerlaColors.tertiary : PerlaColors.onSurfaceVariant,
        size: 20,
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
        style={[styles.tabItemInner, { transform: [{ scale: scaleAnim }] }]}
      >
        {/* ── Active Indicator — Gotas Orgánicas Asimétricas ── */}
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              opacity: activeAnim,
            },
          ]}
        >
          {/* Gota Superior (Top Blob) */}
          <Animated.View
            style={[
              styles.blobTop,
              {
                transform: [
                  {
                    translateY: activeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                  {
                    scaleX: activeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width={TAB_WIDTH} height={16} viewBox={`0 0 ${TAB_WIDTH} 16`}>
              <Path
                d={`M 0 0 C 6 20, 24 16, 36 8 C 48 2, 58 0, ${TAB_WIDTH} 0 Z`}
                fill={PerlaColors.tertiary}
              />
            </Svg>
          </Animated.View>

          {/* Gota Inferior (Bottom Blob) */}
          <Animated.View
            style={[
              styles.blobBottom,
              {
                transform: [
                  {
                    translateY: activeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                  {
                    scaleX: activeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width={TAB_WIDTH} height={16} viewBox={`0 0 ${TAB_WIDTH} 16`}>
              <Path
                d={`M 0 16 C 6 16, 16 14, 28 8 C 40 0, 58 2, ${TAB_WIDTH} 16 Z`}
                fill={PerlaColors.tertiary}
              />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* ── Animación Grácil del Contenido (Icono + Texto) ── */}
        <Animated.View
          style={[
            styles.contentWrap,
            {
              transform: [
                {
                  scale: activeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1], // Crece muy sutilmente al activarse
                  }),
                },
                {
                  translateY: activeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, 0], // Se asienta ligeramente hacia abajo cuando se desactiva
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.iconWrap}>{icon}</View>
          <Text
            style={[
              styles.tabLabel,
              {
                color: isFocused
                  ? PerlaColors.tertiary
                  : PerlaColors.onSurfaceVariant,
                fontFamily: isFocused ? "Manrope-Bold" : "Manrope-Medium",
              },
            ]}
            numberOfLines={1}
          >
            {label as string}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/* ────────────────────────────────────────────────────────
   Hexagon FAB
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
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.fabTouchable}
    >
      <Animated.View
        style={[styles.fabWrap, { transform: [{ scale: scaleAnim }] }]}
      >
        <Svg height={HEXAGON_SIZE} width={HEXAGON_SIZE} viewBox="0 0 60 60">
          <Defs>
            <SvgGradient id="hexFill" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={PerlaColors.tertiary}
                stopOpacity="1"
              />
              <Stop offset="1" stopColor="#c49b1f" stopOpacity="1" />
            </SvgGradient>
          </Defs>
          <Path
            d="M26.5,3.1 C28.6,1.9,31.4,1.9,33.5,3.1 L51.6,13.5 C53.7,14.7,55.1,17.1,55.1,19.5 L55.1,40.5 C55.1,42.9,53.7,45.3,51.6,46.5 L33.5,56.9 C31.4,58.1,28.6,58.1,26.5,56.9 L8.4,46.5 C6.3,45.3,4.9,42.9,4.9,40.5 L4.9,19.5 C4.9,17.1,6.3,14.7,8.4,13.5 Z"
            fill="url(#hexFill)"
          />
        </Svg>

        <View style={styles.fabIconOverlay}>
          <IconSymbol
            name="creditcard.fill"
            color={PerlaColors.onTertiary}
            size={24}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ────────────────────────────────────────────────────────
   Custom Tab Bar
   ──────────────────────────────────────────────────────── */

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const handleFabPress = useCallback(() => {
    console.log("Center Hexagon Action Requested");
  }, []);

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.fabPositioner} pointerEvents="box-none">
        <HexagonFAB onPress={handleFabPress} />
      </View>

      <View style={styles.barOuter}>
        <View style={styles.barClip}>
          {Platform.OS === "ios" || Platform.OS === "web" ? (
            <BlurView
              intensity={Platform.OS === "ios" ? 50 : 65}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.barTint} />
          <View style={styles.barTopHighlight} />

          <View style={styles.barContent}>
            {state.routes.map((route, index) => {
              const descriptor = descriptors[route.key];
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: "tabLongPress",
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

              if (state.routes.length === 2 && index === 0) {
                return (
                  <React.Fragment key={route.key}>
                    {tabButton}
                    <View style={styles.hexSpacer} />
                  </React.Fragment>
                );
              }

              const mid = Math.floor(state.routes.length / 2);
              if (state.routes.length > 2 && index === mid - 1) {
                return (
                  <React.Fragment key={route.key}>
                    {tabButton}
                    <View style={styles.hexSpacer} />
                  </React.Fragment>
                );
              }

              return tabButton;
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_HEIGHT + BAR_BOTTOM_MARGIN + 30,
    backgroundColor: "transparent",
  },

  barOuter: {
    position: "absolute",
    bottom: BAR_BOTTOM_MARGIN,
    left: BAR_HORIZONTAL_MARGIN,
    right: BAR_HORIZONTAL_MARGIN,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  barClip: {
    flex: 1,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  barTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PerlaColors.surfaceContainerLow + "25",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: BAR_HEIGHT / 2,
  },
  barTopHighlight: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2,
  },
  barContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
  },

  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  tabItemInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    overflow: "visible",
    height: "100%",
  },

  activeIndicator: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  blobTop: {
    position: "absolute",
    top: -1,
    alignItems: "center",
    width: TAB_WIDTH,
  },
  blobBottom: {
    position: "absolute",
    bottom: -1,
    alignItems: "center",
    width: TAB_WIDTH,
  },

  contentWrap: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    paddingVertical: 8,
  },
  iconWrap: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },

  hexSpacer: {
    width: HEXAGON_SIZE - 10,
  },

  fabPositioner: {
    position: "absolute",
    bottom: BAR_BOTTOM_MARGIN + 12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  fabTouchable: {
    alignItems: "center",
    justifyContent: "center",
  },
  fabWrap: {
    width: HEXAGON_SIZE,
    height: HEXAGON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  fabIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
