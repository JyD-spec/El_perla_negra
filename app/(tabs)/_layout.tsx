import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PerlaColors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PerlaColors.tertiary,
        tabBarInactiveTintColor: PerlaColors.onSurfaceVariant,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: PerlaColors.surfaceContainerLow + 'CC',
            borderTopColor: PerlaColors.surfaceContainerHighest + '26',
            borderTopWidth: 0.5,
          },
          default: {
            backgroundColor: PerlaColors.surfaceContainerLow,
            borderTopColor: PerlaColors.surfaceContainerHighest + '26',
            borderTopWidth: 0.5,
            elevation: 0,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reserve"
        options={{
          title: 'Reservar',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="calendar.badge.plus" color={color} />,
        }}
      />
    </Tabs>
  );
}
