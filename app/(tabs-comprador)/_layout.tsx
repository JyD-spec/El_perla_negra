import { Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/ui/CustomTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function CompradorTabLayout() {
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
          title: 'Inicio',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          href: null,
          title: 'Boletos',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="ticket.fill" color={color} />,
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
        name="reserve"
        options={{
          href: null,
          title: 'Reservar'
        }}
      />
    </Tabs>
  );
}
