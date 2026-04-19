import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';

/* ────────────────────────────────────────────────────────────
   Register Screen – El Perla Negra
   Client self-registration flow
   ──────────────────────────────────────────────────────────── */

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, loading } = useAuth();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = useCallback(async () => {
    setError(null);

    if (!nombre.trim()) {
      setError('Ingresa tu nombre completo');
      return;
    }
    if (!telefono.trim() || telefono.length < 10) {
      setError('Ingresa un teléfono válido (10 dígitos)');
      return;
    }
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const result = await signUp(email.trim(), password, nombre.trim(), telefono.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  }, [nombre, telefono, email, password, confirmPassword, signUp]);

  /* ── Success State ──────────────────────────────── */
  if (success) {
    return (
      <View style={[styles.root, styles.successContainer, { paddingTop: insets.top + 60 }]}>
        <Text style={styles.successIcon}>🏴‍☠️</Text>
        <Text style={styles.successTitle}>¡Bienvenido a la Tripulación!</Text>
        <Text style={styles.successSubtitle}>
          Tu cuenta ha sido creada exitosamente.{'\n'}
          Ya puedes iniciar sesión y reservar tu aventura.
        </Text>
        <Pressable
          style={styles.successButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.successButtonText}>Ir a Iniciar Sesión →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>←  Regresar</Text>
        </Pressable>

        <Text style={styles.formTitle}>Únete a la Tripulación</Text>
        <Text style={styles.formSubtitle}>
          Crea tu cuenta para reservar tus aventuras en El Perla Negra
        </Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️  {error}</Text>
          </View>
        )}

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
              placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Teléfono</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>📱</Text>
            <TextInput
              style={styles.textInput}
              value={telefono}
              onChangeText={setTelefono}
              placeholder="10 dígitos"
              placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
              keyboardType="phone-pad"
              maxLength={10}
              editable={!loading}
            />
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
              placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
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
              placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
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
              placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
          </View>
        </View>

        {/* ── CTA ────────────────────────────────────── */}
        <Pressable
          style={[styles.registerButton, loading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={PerlaColors.onTertiary} />
          ) : (
            <Text style={styles.registerButtonText}>🏴‍☠️  Crear Cuenta</Text>
          )}
        </Pressable>

        {/* ── Login Link ─────────────────────────────── */}
        <View style={styles.loginLinkRow}>
          <Text style={styles.loginLinkText}>¿Ya tienes cuenta? </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginLinkAction}>Inicia Sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 8,
  },
  backText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 15,
    color: PerlaColors.primary,
  },

  /* Header */
  formTitle: {
    fontFamily: 'Newsreader',
    fontSize: 30,
    color: PerlaColors.onSurface,
    marginBottom: 6,
  },
  formSubtitle: {
    fontFamily: 'Manrope',
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: 24,
  },

  /* Error */
  errorBanner: {
    backgroundColor: PerlaColors.errorContainer + '40',
    borderWidth: 1,
    borderColor: PerlaColors.error + '40',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.error,
    lineHeight: 20,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PerlaColors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontFamily: 'Newsreader',
    fontSize: 16,
    color: PerlaColors.onTertiary,
  },
  sectionLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 17,
    color: PerlaColors.onSurface,
    letterSpacing: 0.3,
  },

  /* Fields */
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PerlaColors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PerlaColors.outlineVariant + '33',
    paddingHorizontal: 16,
    gap: 12,
  },
  inputIcon: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Manrope',
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
    alignItems: 'center',
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
    fontFamily: 'Manrope-Bold',
    fontSize: 17,
    color: PerlaColors.onTertiary,
    letterSpacing: 0.5,
  },

  /* Login Link */
  loginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginLinkText: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
  },
  loginLinkAction: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: PerlaColors.tertiary,
  },

  /* Success */
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: 'Newsreader',
    fontSize: 28,
    color: PerlaColors.onSurface,
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontFamily: 'Manrope',
    fontSize: 15,
    color: PerlaColors.onSurfaceVariant,
    textAlign: 'center',
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
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: PerlaColors.onTertiary,
  },
});
