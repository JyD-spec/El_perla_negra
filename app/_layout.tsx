import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { PerlaColors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';

SplashScreen.preventAutoHideAsync();

/** Navigation theme matching Perla Negra dark surfaces */
const PerlaDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary:      PerlaColors.tertiary,
    background:   PerlaColors.background,
    card:         PerlaColors.surfaceContainerLow,
    text:         PerlaColors.onSurface,
    border:       PerlaColors.outlineVariant,
    notification: PerlaColors.error,
  },
};

/* ── Auth-gated navigation ─────────────────────────────── */

function RootNavigator() {
  const { session, rango, loading, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      // Not logged in → go to auth
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Logged in → go to proper role tab group
      // Logged in → ensure they are in their proper role tab group
      const inGenericTabs = !segments[0] || segments[0] === '(tabs)';
      
      if (inAuthGroup || inGenericTabs) {
        // Determine which tab group based on role
        switch (rango) {
          case 'Dev':
            router.replace('/dev' as any);
            break;
          case 'Caseta':
            router.replace('/(tabs-caseta)' as any);
            break;
          case 'Vendedor':
            router.replace('/(tabs-vendedor)' as any);
            break;
          case 'Barco':
            router.replace('/(tabs-barco)' as any);
            break;
          default:
            // null rango = Comprador (registered client)
            router.replace('/(tabs-comprador)' as any);
            break;
        }
      }
    }
  }, [session, rango, initialized, segments]);

  if (!initialized || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PerlaColors.tertiary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs-comprador)" />
      <Stack.Screen name="(tabs-vendedor)" />
      <Stack.Screen name="(tabs-caseta)" />
      <Stack.Screen name="(tabs-barco)" />
      <Stack.Screen name="dev" />
      {/* Keep legacy tabs hidden but available for backwards compat */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

/* ── Root Layout ───────────────────────────────────────── */

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Newsreader':        require('@/assets/fonts/Newsreader-Regular.ttf'),
    'Newsreader-Italic': require('@/assets/fonts/Newsreader-Italic.ttf'),
    'Newsreader-Bold':   require('@/assets/fonts/Newsreader-Bold.ttf'),
    'Manrope':           require('@/assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium':    require('@/assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold':  require('@/assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold':      require('@/assets/fonts/Manrope-Bold.ttf'),
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
    <AuthProvider>
      <ThemeProvider value={PerlaDarkTheme}>
        <RootNavigator />
        <StatusBar style="light" />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: PerlaColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
