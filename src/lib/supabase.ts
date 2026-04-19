import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Custom storage adapter that handles both web and native platforms.
 * AsyncStorage doesn't work on web SSR (window not defined),
 * so we lazy-load it only on native and use localStorage on web.
 */
const createStorageAdapter = () => {
  if (Platform.OS === "web") {
    // On web, use localStorage (already available in the browser)
    return {
      getItem: (key: string) => {
        if (typeof window === "undefined") return null;
        return window.localStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof window === "undefined") return;
        window.localStorage.removeItem(key);
      },
    };
  }

  // On native, lazy-load AsyncStorage
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;
  return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
