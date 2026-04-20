import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, SlideInUp, SlideOutUp, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { PerlaColors } from '@/constants/theme';

type ToastType = 'success' | 'error' | 'warning';

interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextData {
  showToast: (options: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Translations for Supabase common errors
const translateError = (error: string): string => {
  const errLower = error.toLowerCase();
  if (errLower.includes('invalid login credentials')) return 'Correo electrónico o contraseña incorrectos.';
  if (errLower.includes('user already registered')) return 'Este correo ya se encuentra registrado.';
  if (errLower.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (errLower.includes('email not confirmed')) return 'Debes confirmar tu correo electrónico antes de ingresar.';
  return error;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timeoutRef = useRef<any>(null);

  const hideToast = useCallback(() => {
    setToast(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const showToast = useCallback(({ message, type, duration = 3500 }: ToastOptions) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Auto-translate if it's an error
    const finalMessage = type === 'error' ? translateError(message) : message;
    
    setToast({ message: finalMessage, type, duration });
    
    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [hideToast]);

  const success = useCallback((message: string, duration?: number) => showToast({ message, type: 'success', duration }), [showToast]);
  const error = useCallback((message: string, duration?: number) => showToast({ message, type: 'error', duration }), [showToast]);
  const warning = useCallback((message: string, duration?: number) => showToast({ message, type: 'warning', duration }), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning }}>
      {children}
      {toast && (
        <Animated.View
          entering={SlideInUp.duration(300).springify()}
          exiting={FadeOutUp.duration(300)}
          layout={Layout.springify()}
          style={styles.toastWrapper}
          pointerEvents="box-none"
        >
          <BlurView intensity={25} tint="dark" style={styles.blurContainer}>
            <View style={[styles.toastContainer, getToastStyles(toast.type)]}>
              <View style={styles.iconContainer}>
                {getToastIcon(toast.type)}
              </View>
              <Text style={styles.messageText}>{toast.message}</Text>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

/* ── UI Helpers ───────────────────────────────────── */

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success': return <Ionicons name="checkmark-circle" size={24} color="#a4e8bb" />;
    case 'warning': return <Ionicons name="warning" size={24} color={PerlaColors.tertiary} />;
    case 'error':   return <Ionicons name="close-circle" size={24} color={PerlaColors.onErrorContainer} />;
  }
};

const getToastStyles = (type: ToastType) => {
  switch (type) {
    case 'success': return { borderColor: '#1f3e2b', backgroundColor: 'rgba(20, 48, 30, 0.85)' };
    case 'warning': return { borderColor: PerlaColors.tertiaryContainer, backgroundColor: 'rgba(78, 61, 0, 0.85)' };
    case 'error':   return { borderColor: PerlaColors.errorContainer, backgroundColor: 'rgba(105, 0, 5, 0.85)' };
  }
};

/* ── Styles ───────────────────────────────────────── */

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 60, // Avoid safe area / notch
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  messageText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    color: PerlaColors.onSurface,
    flex: 1,
    flexWrap: 'wrap',
  },
});
