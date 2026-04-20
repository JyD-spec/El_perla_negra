import { IconSymbol } from "@/components/ui/icon-symbol";
import { PerlaColors } from "@/constants/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useToast } from "@/src/contexts/ToastContext";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ── Settings Screen (shared across all roles) ─────────── */

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, rango, cliente, signOut } = useAuth();
  const toast = useToast();

  const handleSignOut = () => {
    toast.warning("Zarpando... Cerrando sesión.");
    signOut();
  };

  const displayName = cliente?.nombre_completo ?? user?.email ?? "Usuario";
  const roleName = rango ?? "Comprador";

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
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

      {/* Catálogos Section */}
      <Text style={styles.sectionTitle}>Catálogos</Text>
      <View style={styles.menuContainer}>
        <MenuButton
          icon="ferry.fill"
          title="Barcos"
          subtitle="Capacidad y tiempos de espera"
          onPress={() => router.push("/(tabs-caseta)/catalog/boats")}
        />
        <MenuButton
          icon="gift.fill"
          title="Paquetes"
          subtitle="Precios y tipos de tickets"
          onPress={() => router.push("/(tabs-caseta)/catalog/packages")}
        />
        <MenuButton
          icon="tag.fill"
          title="Descuentos"
          subtitle="Reglas y porcentajes"
          onPress={() => router.push("/(tabs-caseta)/catalog/discounts")}
        />
      </View>

      {/* Sign Out */}
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && { opacity: 0.7 },
        ]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>🚪 Cerrar Sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuButton({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && { backgroundColor: PerlaColors.surfaceContainerHigh },
      ]}
      onPress={onPress}
    >
      <View style={styles.menuIconContainer}>
        <IconSymbol name={icon as any} size={22} color={PerlaColors.primary} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <IconSymbol
        name="chevron.right"
        size={16}
        color={PerlaColors.onSurfaceVariant}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PerlaColors.background },
  scrollContent: { paddingHorizontal: 20 },
  title: {
    fontFamily: "Newsreader",
    fontSize: 34,
    color: PerlaColors.onSurface,
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: PerlaColors.surfaceVariant + "33",
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PerlaColors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuTextContainer: { flex: 1 },
  menuTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    color: PerlaColors.onSurface,
  },
  menuSubtitle: {
    fontFamily: "Manrope",
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Newsreader",
    fontSize: 24,
    color: PerlaColors.onPrimaryContainer,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    color: PerlaColors.onSurface,
    marginBottom: 2,
  },
  profileEmail: {
    fontFamily: "Manrope",
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: PerlaColors.tertiary + "1A",
    borderWidth: 1,
    borderColor: PerlaColors.tertiary + "33",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  roleBadgeText: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: PerlaColors.tertiary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  signOutButton: {
    backgroundColor: PerlaColors.errorContainer + "40",
    borderWidth: 1,
    borderColor: PerlaColors.error + "30",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 16,
  },
  signOutText: {
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    color: PerlaColors.error,
  },
});
