import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Pressable } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PerlaColors } from '@/constants/theme';
import { IconSymbol } from './icon-symbol';

/**
 * OfflineBanner component - Displays a discrete but clearly visible notification
 * when the app loses internet connection.
 */
export function OfflineBanner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Animation for the slide-down effect
  const slideAnim = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    // 1. Initial check & Subscribe to listener
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // isConnected is true/false, we handle null as 'unknown/connecting'
      const connected = state.isConnected !== false;
      setIsConnected(connected);
      
      // Auto-reset dismissal when status changes
      if (!connected) {
        setIsDismissed(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // 2. Animate the banner based on connection and dismissal state
    const shouldShow = isConnected === false && !isDismissed;
    
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -120, // Move into view or hide
      useNativeDriver: true,
      tension: 40,
      friction: 8
    }).start();
  }, [isConnected, isDismissed]);

  // If we are definitely connected and the animation is hidden, don't overlap anything
  // Note: we let Animated handle the opacity/hiding via position

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          paddingTop: insets.top + 8,
          transform: [{ translateY: slideAnim }] 
        }
      ]}
    >
      <View style={styles.bannerOuter}>
        <BlurView 
          intensity={80} 
          tint="dark" 
          style={StyleSheet.absoluteFill} 
        />
        <View style={styles.bannerContent}>
          <View style={styles.iconContainer}>
            <IconSymbol name="wifi.exclamationmark" size={18} color={PerlaColors.error} />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>Sin Conexión</Text>
            <Text style={styles.subtitle}>Las reservas y cambios no se sincronizarán.</Text>
          </View>

          <Pressable 
            onPress={() => setIsDismissed(true)}
            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="xmark" size={14} color={PerlaColors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999, // Ensure it's above everything
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bannerOuter: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PerlaColors.error + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: PerlaColors.error + '10', // Subtle red tint
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PerlaColors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: PerlaColors.onSurface,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'Manrope',
    fontSize: 12,
    color: PerlaColors.onSurfaceVariant,
  },
  dismissBtn: {
    padding: 8,
  },
});
