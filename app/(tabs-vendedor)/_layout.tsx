import { Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/ui/CustomTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function VendedorTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Ventas',
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
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
