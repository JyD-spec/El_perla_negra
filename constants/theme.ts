/**
 * Perla Negra – Nautical Editorial Design System
 * "The Cartographer's Ledger"
 *
 * Palette rooted in Abyssal Blue, Heartwood Brown, and Sunken Gold.
 */

import { Platform } from 'react-native';

/* ── Design Tokens ─────────────────────────────────────────── */

export const PerlaColors = {
  // Surfaces
  surface:                '#141312',
  surfaceDim:             '#141312',
  surfaceBright:          '#3b3937',
  surfaceContainerLowest: '#0f0e0d',
  surfaceContainerLow:    '#1d1b1a',
  surfaceContainer:       '#211f1e',
  surfaceContainerHigh:   '#2b2a28',
  surfaceContainerHighest:'#363433',
  surfaceVariant:         '#363433',
  background:             '#141312',

  // On-surface
  onBackground:           '#e6e1df',
  onSurface:              '#e6e1df',
  onSurfaceVariant:       '#c4c6cf',

  // Primary – Abyssal Blue
  primary:                '#adc7f7',
  primaryContainer:       '#1a365d',
  onPrimary:              '#133057',
  onPrimaryContainer:     '#86a0cd',
  primaryFixed:           '#d6e3ff',
  primaryFixedDim:        '#adc7f7',
  onPrimaryFixed:         '#001b3c',
  onPrimaryFixedVariant:  '#2d476f',
  inversePrimary:         '#455f88',

  // Secondary – Heartwood Brown
  secondary:              '#dec1af',
  secondaryContainer:     '#574335',
  onSecondary:            '#3f2c20',
  onSecondaryContainer:   '#ccb09f',
  secondaryFixed:         '#fbddca',
  secondaryFixedDim:      '#dec1af',
  onSecondaryFixed:       '#28180d',
  onSecondaryFixedVariant:'#574335',

  // Tertiary – Sunken Gold
  tertiary:               '#e9c349',
  tertiaryContainer:      '#cba72f',
  onTertiary:             '#3c2f00',
  onTertiaryContainer:    '#4e3d00',
  tertiaryFixed:          '#ffe088',
  tertiaryFixedDim:       '#e9c349',
  onTertiaryFixed:        '#241a00',
  onTertiaryFixedVariant: '#574500',

  // Error
  error:                  '#ffb4ab',
  errorContainer:         '#93000a',
  onError:                '#690005',
  onErrorContainer:       '#ffdad6',

  // Misc
  outline:                '#8e9099',
  outlineVariant:         '#43474e',
  inverseSurface:         '#e6e1df',
  inverseOnSurface:       '#32302f',
  surfaceTint:            '#adc7f7',

  // Brand overrides
  gold:                   '#d4af37',
};

/* ── Legacy compat (ThemedText / ThemedView) ───────────────── */

export const Colors = {
  light: {
    text:              PerlaColors.onSurface,
    background:        PerlaColors.background,
    tint:              PerlaColors.tertiary,
    icon:              PerlaColors.onSurfaceVariant,
    tabIconDefault:    PerlaColors.onSurfaceVariant,
    tabIconSelected:   PerlaColors.tertiary,
  },
  dark: {
    text:              PerlaColors.onSurface,
    background:        PerlaColors.background,
    tint:              PerlaColors.tertiary,
    icon:              PerlaColors.onSurfaceVariant,
    tabIconDefault:    PerlaColors.onSurfaceVariant,
    tabIconSelected:   PerlaColors.tertiary,
  },
};

/* ── Fonts ─────────────────────────────────────────────────── */

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "Manrope, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Newsreader, Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
