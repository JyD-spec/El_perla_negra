import React from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';

export default function DevPortal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
      <Text style={styles.title}>DEV PORTAL 🛠️</Text>
      <Text style={styles.subtitle}>Panel maestro para pruebas. Elige una interfaz para emular su flujo.</Text>

      <View style={styles.grid}>
        <DevCard 
          title="Caseta" 
          icon="📊" 
          desc="Control Global y Estadísticas" 
          onPress={() => router.push('/(tabs-caseta)' as any)} 
          color="#3b82f6"
        />
        <DevCard 
          title="Vendedor" 
          icon="🎫" 
          desc="Venta Rápida en Muelle" 
          onPress={() => router.push('/(tabs-vendedor)' as any)} 
          color="#10b981"
        />
        <DevCard 
          title="Barco" 
          icon="🚢" 
          desc="Control de Manifiesto y Viaje" 
          onPress={() => router.push('/(tabs-barco)' as any)} 
          color="#f59e0b"
        />
        <DevCard 
          title="Comprador" 
          icon="📱" 
          desc="Reservas y Boletos Cliente" 
          onPress={() => router.push('/(tabs-comprador)' as any)} 
          color="#8b5cf6"
        />
      </View>

      <Pressable style={styles.logoutBtn} onPress={signOut}>
        <Text style={styles.logoutText}>Cerrar Sesión (DEV)</Text>
      </Pressable>
    </ScrollView>
  );
}

function DevCard({ title, icon, desc, onPress, color }: { title: string, icon: string, desc: string, onPress: () => void, color: string }) {
  return (
    <Pressable style={[styles.card, { borderColor: color + '40' }]} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  content: { paddingHorizontal: 20 },
  title: { fontFamily: 'Newsreader-Bold', fontSize: 32, color: PerlaColors.onSurface, marginBottom: 8 },
  subtitle: { fontFamily: 'Manrope', fontSize: 15, color: PerlaColors.onSurfaceVariant, marginBottom: 32 },
  grid: { gap: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: PerlaColors.surfaceContainer,
    borderRadius: 16, padding: 20, borderWidth: 1, borderLeftWidth: 4,
  },
  iconContainer: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  icon: { fontSize: 24 },
  cardTitle: { fontFamily: 'Manrope-Bold', fontSize: 18, color: PerlaColors.onSurface, marginBottom: 4 },
  cardDesc: { fontFamily: 'Manrope', fontSize: 13, color: PerlaColors.onSurfaceVariant },
  logoutBtn: {
    marginTop: 40, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    backgroundColor: PerlaColors.error + '20', borderWidth: 1, borderColor: PerlaColors.error + '40',
  },
  logoutText: { fontFamily: 'Manrope-Bold', fontSize: 14, color: PerlaColors.errorContainer },
});
