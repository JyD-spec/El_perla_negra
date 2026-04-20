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
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { PerlaColors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';

/* ────────────────────────────────────────────────────────────
   Login Screen – El Perla Negra
   Premium dark nautical aesthetic
   ──────────────────────────────────────────────────────────── */

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, loading } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!email.trim()) {
      toast.warning('Ingresa tu correo electrónico');
      return;
    }
    if (!password.trim()) {
      toast.warning('Ingresa tu contraseña');
      return;
    }

    const result = await signIn(email.trim(), password);
    if (result.error) {
      toast.error(result.error);
    }
  }, [email, password, signIn, toast]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero Section ──────────────────────────────── */}
        <View style={styles.heroContainer}>
          <Image
            source={require('@/assets/images/hero-ship.jpg')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={600}
          />
          <LinearGradient
            colors={[
              'transparent',
              PerlaColors.background + '80',
              PerlaColors.background + 'CC',
              PerlaColors.background,
            ]}
            locations={[0.0, 0.4, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroContent}>
            <Text style={styles.brandName}>El Perla Negra</Text>
            <Text style={styles.brandTagline}>Puerto Peñasco</Text>
          </View>
        </View>

        {/* ── Login Form ────────────────────────────────── */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Bienvenido a Bordo</Text>
          <Text style={styles.formSubtitle}>
            Ingresa a tu cuenta para zarpar
          </Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Correo Electrónico</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="capitan@perlanegra.mx"
                placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Contraseña</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={PerlaColors.onSurfaceVariant + '50'}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Login Button */}
          <Pressable
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={PerlaColors.onTertiary} />
            ) : (
              <Text style={styles.loginButtonText}>⚓  Iniciar Sesión</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>¿Nuevo tripulante?</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register Link */}
          <Pressable
            style={styles.registerButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerButtonText}>Crear Cuenta</Text>
          </Pressable>
        </View>

        {/* ── Footer ──────────────────────────────────── */}
        <Text style={styles.footerText}>
          © 1720 El Perla Negra{'\n'}Todos los horizontes reservados.
        </Text>
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
    flexGrow: 1,
  },

  /* Hero */
  heroContainer: {
    height: 300,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroContent: {
    zIndex: 2,
    alignItems: 'center',
    paddingBottom: 24,
  },
  brandName: {
    fontFamily: 'Newsreader',
    fontSize: 38,
    color: PerlaColors.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  brandTagline: {
    fontFamily: 'Manrope',
    fontSize: 14,
    color: PerlaColors.onSurfaceVariant,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  /* Form */
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
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
    marginBottom: 28,
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

  /* Fields */
  fieldGroup: {
    marginBottom: 18,
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

  /* Login Button */
  loginButton: {
    backgroundColor: PerlaColors.tertiary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: PerlaColors.tertiary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 17,
    color: PerlaColors.onTertiary,
    letterSpacing: 0.5,
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PerlaColors.outlineVariant + '33',
  },
  dividerText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
  },

  /* Register */
  registerButton: {
    borderWidth: 1.5,
    borderColor: PerlaColors.primaryContainer,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  registerButtonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: PerlaColors.primary,
    letterSpacing: 0.3,
  },

  /* Footer */
  footerText: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant + '60',
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 18,
  },
});
