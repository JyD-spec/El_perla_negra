import { View, ActivityIndicator } from 'react-native';
import { PerlaColors } from '@/constants/theme';

/**
 * app/index.tsx
 * Explicit root entry point. This screen is hidden by the Auth Gating 
 * in _layout.tsx until redirection occurs.
 */
export default function RootIndex() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PerlaColors.background }}>
      <ActivityIndicator size="large" color={PerlaColors.tertiary} />
    </View>
  );
}
