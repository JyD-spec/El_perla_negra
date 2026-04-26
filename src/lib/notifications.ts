import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  // Push notifications are not supported in Expo Go since SDK 53.
  // Detect Expo Go: appOwnership === 'expo' or executionEnvironment === 'storeClient'.
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient';

  if (isExpoGo) {
    console.warn('Push notifications are not available in Expo Go (SDK 53+). Use a development build.');
    return null;
  }

  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  const projectId = (Constants.expoConfig?.extra?.eas?.projectId as string) ?? undefined;
  
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } catch (e) {
    console.error('Error getting push token:', e);
    return null;
  }
}

export async function updatePushToken(idCliente: number, token: string) {
  const { error } = await supabase
    .from('cliente')
    .update({ push_token: token })
    .eq('id_cliente', idCliente);
  
  if (error) {
    console.error('Error updating push token:', error);
  }
}
