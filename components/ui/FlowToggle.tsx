import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { PerlaColors } from '@/constants/theme';
import { IconSymbol } from './icon-symbol';

const { width } = Dimensions.get('window');
const TOGGLE_WIDTH = Math.min(width - 48, 400);
const ITEM_WIDTH = TOGGLE_WIDTH / 2;

interface FlowToggleProps {
  activeTab: 'reserve' | 'tickets';
}

export function FlowToggle({ activeTab }: FlowToggleProps) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(activeTab === 'reserve' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'reserve' ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, [activeTab]);

  const handleToggle = (target: 'reserve' | 'tickets') => {
    if (target === activeTab) return;
    router.replace(`/(tabs-comprador)/${target}` as any);
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, ITEM_WIDTH - 4],
  });

  return (
    <View style={styles.container}>
      <View style={styles.outerBorder}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.glassTint} />
        </BlurView>
        
        <View style={styles.content}>
          {/* Moving Indicator */}
          <Animated.View 
            style={[
              styles.indicator, 
              { transform: [{ translateX }] }
            ]} 
          />

          {/* Option 1: Reservar */}
          <Pressable 
            onPress={() => handleToggle('reserve')}
            style={styles.item}
          >
            <IconSymbol 
              name="calendar.badge.plus" 
              size={16} 
              color={activeTab === 'reserve' ? PerlaColors.onTertiary : PerlaColors.onSurfaceVariant} 
            />
            <Text style={[
              styles.label,
              activeTab === 'reserve' && styles.activeLabel
            ]}>
              Reservar
            </Text>
          </Pressable>

          {/* Option 2: Boletos */}
          <Pressable 
            onPress={() => handleToggle('tickets')}
            style={styles.item}
          >
            <IconSymbol 
              name="ticket.fill" 
              size={16} 
              color={activeTab === 'tickets' ? PerlaColors.onTertiary : PerlaColors.onSurfaceVariant} 
            />
            <Text style={[
              styles.label,
              activeTab === 'tickets' && styles.activeLabel
            ]}>
              Mis Boletos
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  outerBorder: {
    width: TOGGLE_WIDTH,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PerlaColors.surfaceContainerLow + '40',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  indicator: {
    position: 'absolute',
    width: ITEM_WIDTH - 8,
    height: 40,
    borderRadius: 20,
    backgroundColor: PerlaColors.tertiary,
    shadowColor: PerlaColors.tertiary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 10,
  },
  label: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: PerlaColors.onSurfaceVariant,
    marginLeft: 8,
  },
  activeLabel: {
    fontFamily: 'Manrope-Bold',
    color: PerlaColors.onTertiary,
  },
});
