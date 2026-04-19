import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CustomTabBar } from '@/components/ui/CustomTabBar';
import { PerlaColors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
