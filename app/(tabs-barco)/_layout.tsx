import { Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/ui/CustomTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function BarcoTabLayout() {
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
          title: 'Viaje',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="ferry.fill" color={color} />,
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
        name="manifest"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
