import { Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/ui/CustomTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function CasetaTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Estadísticas',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Viajes',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="ferry.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="list.clipboard.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Config',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="new-reservation"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
