import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { PerlaColors } from '@/constants/theme';

/* ── Settings Screen (shared across all roles) ─────────── */

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, rango, cliente, signOut } = useAuth();
  const toast = useToast();

  const handleSignOut = () => {
    toast.warning('Zarpando... Cerrando sesión.');
    signOut();
  };

  const displayName = cliente?.nombre_completo ?? user?.email ?? 'Usuario';
  const roleName = rango ?? 'Comprador';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
      ]}
    >
      <Text style={styles.title}>Configuración</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleName}</Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <Pressable 
        style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.7 }]} 
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>🚪  Cerrar Sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  scrollContent: { paddingHorizontal: 20 },
  title: {
    fontFamily: 'Newsreader',
    fontSize: 34,
    color: PerlaColors.onSurface,
    marginBottom: 28,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PerlaColors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Newsreader',
    fontSize: 24,
    color: PerlaColors.onPrimaryContainer,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: 'Manrope-Bold',
    fontSize: 18,
    color: PerlaColors.onSurface,
    marginBottom: 2,
  },
  profileEmail: {
    fontFamily: 'Manrope',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PerlaColors.tertiary + '1A',
    borderWidth: 1,
    borderColor: PerlaColors.tertiary + '33',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  roleBadgeText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 10,
    color: PerlaColors.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  signOutButton: {
    backgroundColor: PerlaColors.errorContainer + '40',
    borderWidth: 1,
    borderColor: PerlaColors.error + '30',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  signOutText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: PerlaColors.error,
  },
});
