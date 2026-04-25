import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PerlaColors } from "@/constants/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useToast } from "@/src/contexts/ToastContext";

/* ────────────────────────────────────────────────────────────
   Register Screen – El Perla Negra
   Client self-registration flow
   ──────────────────────────────────────────────────────────── */

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, loading } = useAuth();
  const toast = useToast();

  const [nombre, setNombre] = useState("");
  const [lada, setLada] = useState("+52");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [countries, setCountries] = useState<
    { name: string; code: string; flag: string; iso: string }[]
  >([]);

  // Fetch international country codes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,idd,flag,cca2",
        );
        const data = await res.json();
        const list = data
          .map((c: any) => ({
            name: c.name.common,
            code: c.idd.root + (c.idd.suffixes?.[0] || ""),
            flag: c.flag,
            iso: c.cca2,
          }))
          .filter((c: any) => c.code)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        setCountries(list);
      } catch (err) {
        console.error("Error fetching countries:", err);
        setCountries([
          { name: "México", code: "+52", flag: "🇲🇽", iso: "MX" },
          { name: "USA", code: "+1", flag: "🇺🇸", iso: "US" },
        ]);
      }
    })();
  }, []);

  const handleRegister = useCallback(async () => {
    if (!nombre.trim()) {
      toast.warning("Ingresa tu nombre completo");
      return;
    }
    if (!telefono.trim() || telefono.length < 10) {
      toast.warning("Ingresa un teléfono válido (10 dígitos)");
      return;
    }
    if (!email.trim()) {
      toast.warning("Ingresa tu correo electrónico");
      return;
    }
    if (password.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.warning("Las contraseñas no coinciden");
      return;
    }

    const result = await signUp(
      email.trim(),
      password,
      nombre.trim(),
      telefono.trim(),
      lada,
    );
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("¡Registro exitoso! Bienvenido a bordo.");
      setSuccess(true);
    }
  }, [nombre, telefono, lada, email, password, confirmPassword, signUp, toast]);

  /* ── Success State ──────────────────────────────── */
  if (success) {
    return (
      <View
        style={[
          styles.root,
          styles.successContainer,
          { paddingTop: insets.top + 60 },
        ]}
      >
        <Text style={styles.successIcon}>🏴‍☠️</Text>
        <Text style={styles.successTitle}>¡Bienvenido a la Tripulación!</Text>
        <Text style={styles.successSubtitle}>
          Tu cuenta ha sido creada exitosamente.{"\n"}
          Ya puedes iniciar sesión y reservar tu aventura.
        </Text>
        <Pressable
          style={styles.successButton}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={styles.successButtonText}>Ir a Iniciar Sesión →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────── */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Regresar</Text>
        </Pressable>

        <Text style={styles.formTitle}>Únete a la Tripulación</Text>
        <Text style={styles.formSubtitle}>
          Crea tu cuenta para reservar tus aventuras en El Perla Negra
        </Text>

        {/* ── Section 1: Personal ────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>1</Text>
          </View>
          <Text style={styles.sectionLabel}>Datos Personales</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Nombre Completo</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.textInput}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Jack Sparrow"
              placeholderTextColor={PerlaColors.onSurfaceVariant + "50"}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Teléfono</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={styles.ladaSelector}
              onPress={() => setShowCountryPicker(true)}
              disabled={loading}
            >
              <Text style={styles.isoCode}>
                {countries.find((c) => c.code === lada)?.iso || "MX"}
              </Text>
              <Text style={styles.ladaText}>{lada}</Text>
            </Pressable>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.inputIcon}>📱</Text>
              <TextInput
                style={styles.textInput}
                value={telefono}
                onChangeText={setTelefono}
                placeholder="dígitos"
                placeholderTextColor={PerlaColors.onSurfaceVariant + "50"}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!loading}
              />
            </View>
          </View>
        </View>

        {/* ── Section 2: Account ─────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>2</Text>
          </View>
          <Text style={styles.sectionLabel}>Datos de Acceso</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Correo Electrónico</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>📧</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor={PerlaColors.onSurfaceVariant + "50"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Contraseña</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={PerlaColors.onSurfaceVariant + "50"}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Text style={styles.eyeIcon}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Confirmar Contraseña</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.textInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña"
              placeholderTextColor={PerlaColors.onSurfaceVariant + "50"}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
          </View>
        </View>

        {/* ── CTA ────────────────────────────────────── */}
        <Pressable
          style={[
            styles.registerButton,
            loading && styles.registerButtonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={PerlaColors.onTertiary} />
          ) : (
            <Text style={styles.registerButtonText}>🏴‍☠️ Crear Cuenta</Text>
          )}
        </Pressable>

        {/* ── Login Link ─────────────────────────────── */}
        <View style={styles.loginLinkRow}>
          <Text style={styles.loginLinkText}>¿Ya tienes cuenta? </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.loginLinkAction}>Inicia Sesión</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Country Picker Modal ───────────────────── */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar País</Text>
              <Pressable onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.modalSearch}
              placeholder="Buscar país..."
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholderTextColor={PerlaColors.onSurfaceVariant + "60"}
            />

            <FlatList
              data={countries.filter(
                (c) =>
                  c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                  c.code.includes(countrySearch) ||
                  c.iso.toLowerCase().includes(countrySearch.toLowerCase()),
              )}
              keyExtractor={(item, index) => `${item.iso}-${index}`}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.countryItem}
                  onPress={() => {
                    setLada(item.code);
                    setShowCountryPicker(false);
                    setCountrySearch("");
                  }}
                >
                  <Text style={styles.isoCodeItem}>{item.iso}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCode}>{item.code}</Text>
                </Pressable>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PerlaColors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },

  /* Back */
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
    paddingVertical: 8,
  },
  backText: {
    fontFamily: "Manrope-Medium",
    fontSize: 15,
    color: PerlaColors.primary,
  },

  /* Header */
  formTitle: {
    fontFamily: "Newsreader",
    fontSize: 30,
    color: PerlaColors.onSurface,
    marginBottom: 6,
  },
  formSubtitle: {
    fontFamily: "Manrope",
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: 24,
  },

  /* Error */
  errorBanner: {
    backgroundColor: PerlaColors.errorContainer + "40",
    borderWidth: 1,
    borderColor: PerlaColors.error + "40",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: PerlaColors.error,
    lineHeight: 20,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PerlaColors.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeText: {
    fontFamily: "Newsreader",
    fontSize: 16,
    color: PerlaColors.onTertiary,
  },
  sectionLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 17,
    color: PerlaColors.onSurface,
    letterSpacing: 0.3,
  },

  /* Fields */
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "33",
    paddingHorizontal: 16,
    gap: 12,
  },
  inputIcon: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    fontFamily: "Manrope",
    fontSize: 16,
    color: PerlaColors.onSurface,
    paddingVertical: 16,
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },

  /* Register Button */
  registerButton: {
    backgroundColor: PerlaColors.tertiary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 28,
    shadowColor: PerlaColors.tertiary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontFamily: "Manrope-Bold",
    fontSize: 17,
    color: PerlaColors.onTertiary,
    letterSpacing: 0.5,
  },

  /* Login Link */
  loginLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  loginLinkText: {
    fontFamily: "Manrope",
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },
  loginLinkAction: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: PerlaColors.tertiary,
  },

  /* Success */
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: "Newsreader",
    fontSize: 28,
    color: PerlaColors.onSurface,
    textAlign: "center",
    marginBottom: 12,
  },
  successSubtitle: {
    fontFamily: "Manrope",
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  successButton: {
    backgroundColor: PerlaColors.tertiary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  successButtonText: {
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    color: PerlaColors.onTertiary,
  },

  /* Lada Styles */
  ladaSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + "33",
    paddingHorizontal: 12,
    gap: 4,
    minWidth: 85,
  },
  isoCode: {
    fontFamily: "Manrope-Bold",
    fontSize: 12,
    color: PerlaColors.tertiary,
  },
  ladaText: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: PerlaColors.onSurface,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: PerlaColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "70%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Newsreader-Bold",
    fontSize: 22,
    color: PerlaColors.onSurface,
  },
  modalClose: {
    fontSize: 24,
    color: PerlaColors.onSurfaceVariant,
  },
  modalSearch: {
    backgroundColor: PerlaColors.surfaceContainerLow,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    color: PerlaColors.onSurface,
    fontFamily: "Manrope",
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: PerlaColors.outlineVariant + "20",
  },
  isoCodeItem: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: PerlaColors.tertiary,
    width: 35,
    marginRight: 10,
  },
  countryName: {
    flex: 1,
    fontFamily: "Manrope-Medium",
    fontSize: 16,
    color: PerlaColors.onSurface,
  },
  countryCode: {
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    color: PerlaColors.tertiary,
  },
});
