import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { PerlaColors } from '@/constants/theme';

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

export const unstable_settings = {
  anchor: '(tabs)',
};

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
    <ThemeProvider value={PerlaDarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
