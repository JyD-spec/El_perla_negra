import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import "react-native-reanimated";

import { PerlaColors } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { ToastProvider } from "@/src/contexts/ToastContext";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

SplashScreen.preventAutoHideAsync();

/** Navigation theme matching Perla Negra dark surfaces */
const PerlaDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: PerlaColors.tertiary,
    background: PerlaColors.background,
    card: PerlaColors.surfaceContainerLow,
    text: PerlaColors.onSurface,
    border: PerlaColors.outlineVariant,
    notification: PerlaColors.error,
  },
};

/* ── Auth-gated navigation ─────────────────────────────── */

const ROLE_ROUTES = {
  Dev: "dev",
  Caseta: "(tabs-caseta)",
  Vendedor: "(tabs-vendedor)",
  Barco: "(tabs-barco)",
} as const;

function RootNavigator() {
  const { session, rango, loading, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 1. Wait until auth is fully determined
    if (!initialized || loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    
    if (!session) {
      // 2. Force login if no session
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // 3. Authenticated - determine target based on role
      const targetGroup = ROLE_ROUTES[rango as keyof typeof ROLE_ROUTES] || "(tabs-comprador)";

      const inAuthGroup = segments[0] === "(auth)";

      // Rule 1: Universal - Always move AWAY from auth if logged in
      if (inAuthGroup) {
        router.replace(`/${targetGroup}` as any);
        return;
      }

      // Rule 2: Strict Enforcement - Only for non-Dev roles
      if (rango !== "Dev" && segments[0] !== targetGroup) {
        router.replace(`/${targetGroup}` as any);
      }
    }
  }, [session, rango, initialized, segments[0], loading]);

  // 5. Performance: Only show the global spinner during the VERY FIRST cold boot.
  // Once initialized, don't unmount the entire tree even if loading is true (e.g. background syncs)
  if (!initialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs-comprador)" />
        <Stack.Screen name="(tabs-vendedor)" />
        <Stack.Screen name="(tabs-caseta)" />
        <Stack.Screen name="(tabs-barco)" />
        <Stack.Screen name="dev" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      {/* ── Role Dev Support ── */}
      {rango === "Dev" && segments[0] !== "dev" && (
        <Pressable
          style={({ pressed }) => [
            styles.devFloatingBtn,
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
          onPress={() => router.replace("/dev")}
        >
          <Text style={styles.devFloatingIcon}>🛠️</Text>
          <Text style={styles.devFloatingText}>Regresar a Panel DEV</Text>
        </Pressable>
      )}
    </>
  );
}

/* ── Root Layout ───────────────────────────────────────── */

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Newsreader: require("@/assets/fonts/Newsreader-Regular.ttf"),
    "Newsreader-Italic": require("@/assets/fonts/Newsreader-Italic.ttf"),
    "Newsreader-Bold": require("@/assets/fonts/Newsreader-Bold.ttf"),
    Manrope: require("@/assets/fonts/Manrope-Regular.ttf"),
    "Manrope-Medium": require("@/assets/fonts/Manrope-Medium.ttf"),
    "Manrope-SemiBold": require("@/assets/fonts/Manrope-SemiBold.ttf"),
    "Manrope-Bold": require("@/assets/fonts/Manrope-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <ThemeProvider value={PerlaDarkTheme}>
          <OfflineBanner />
          <RootNavigator />
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: PerlaColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  devFloatingBtn: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: PerlaColors.tertiary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  devFloatingIcon: {
    fontSize: 18,
  },
  devFloatingText: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: PerlaColors.onTertiary,
  },
});
