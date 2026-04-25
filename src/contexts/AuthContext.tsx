// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { registerForPushNotificationsAsync, updatePushToken } from '@/src/lib/notifications';
import type { Session, User } from '@supabase/supabase-js';
import type { RangoUsuario } from '@/src/lib/database.types';

/* ── Types ──────────────────────────────────────────────── */

interface ClienteProfile {
  id_cliente: number;
  nombre_completo: string;
  telefono: string;
  lada: string | null;
  es_registrado: boolean;
  push_token: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  rango: RangoUsuario | null;      // null = Comprador (registered client without employee role)
  cliente: ClienteProfile | null;  // populated if the user is a Comprador
  loading: boolean;
  initialized: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nombre: string, telefono: string, lada: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ── Provider ───────────────────────────────────────────── */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    rango: null,
    cliente: null,
    loading: true,
    initialized: false,
  });

  // Refs to track current state without triggering effect re-runs
  const stateRef = useRef<AuthState>(state);
  const fetchingProfileFor = useRef<string | null>(null);

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Fetch the role and profile for the given user.
   * Uses obtener_mi_rango() RPC to determine if user is an employee.
   * Falls back to checking the cliente table for registered buyers.
   */
  const fetchProfile = useCallback(async (user: User) => {
    try {
      // 1. Check if user is an employee (has a row in usuario table)
      const { data: rangoData, error: rangoError } = await supabase
        .rpc('obtener_mi_rango');

      if (!rangoError && rangoData) {
        // Fetch their 'activo' state
        const { data: userData } = await supabase
          .from('usuario')
          .select('activo')
          .eq('id_usuario', user.id)
          .maybeSingle();

        if (userData && userData.activo === false) {
          await supabase.auth.signOut();
          throw new Error("Membresía o cuenta desactivada");
        }

        // User is an employee
        setState(prev => ({
          ...prev,
          rango: rangoData as RangoUsuario,
          cliente: null,
          loading: false,
          initialized: true,
        }));
        return;
      }

      // 2. Not an employee — check if registered client
      const { data: clienteData } = await supabase
        .from('cliente')
        .select('id_cliente, nombre_completo, telefono, lada, es_registrado, push_token')
        .eq('auth_id', user.id)
        .maybeSingle();

      setState(prev => ({
        ...prev,
        rango: null, // Comprador
        cliente: clienteData as ClienteProfile | null,
        loading: false,
        initialized: true,
      }));

      // 3. Register Push Token for clients
      if (clienteData) {
        const token = await registerForPushNotificationsAsync();
        if (token && token !== clienteData.push_token) {
          await updatePushToken(clienteData.id_cliente, token);
          setState(prev => ({
            ...prev,
            cliente: prev.cliente ? { ...prev.cliente, push_token: token } : null
          }));
        }
      }
    } catch {
      setState(prev => ({
        ...prev,
        rango: null,
        cliente: null,
        loading: false,
        initialized: true,
      }));
    }
  }, []);

  /* ── Auth state listener ──────────────────────────── */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        const currentState = stateRef.current;

        // 1. Identify context
        const isExplicitLogin = event === 'SIGNED_IN';
        const isInitialLoad = event === 'INITIAL_SESSION' && !currentState.initialized;
        
        // We only show the global "ActivityIndicator" for initial boot or explicit login.
        // TOKEN_REFRESHED or background resumes should be SILENT.
        const shouldLockUI = isExplicitLogin || isInitialLoad;

        // 2. Update basic session info
        setState(prev => ({
          ...prev,
          session,
          user,
          // Only trigger loading UI if it's a critical transition
          loading: shouldLockUI ? true : prev.loading,
        }));

        if (user) {
          // 3. Avoid duplicate or redundant fetches
          if (fetchingProfileFor.current === user.id) return;
          
          // Optimization: If we already have the profile for this user and it's not an explicit login, 
          // we don't need to block the UI or re-fetch immediately.
          if (currentState.user?.id === user.id && (currentState.rango || currentState.cliente) && !isExplicitLogin) {
            if (shouldLockUI) {
              setState(prev => ({ ...prev, loading: false, initialized: true }));
            }
            return;
          }

          fetchingProfileFor.current = user.id;
          
          try {
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout fetching profile')), 8000)
            );
            
            await Promise.race([fetchProfile(user), timeoutPromise]);
          } catch (err) {
            console.error('Profile fetch failed or timed out:', err);
            setState(prev => ({ ...prev, loading: false, initialized: true }));
          } finally {
            fetchingProfileFor.current = null;
          }
        } else {
          // 4. Clear profile on sign out (Event: SIGNED_OUT)
          fetchingProfileFor.current = null;
          setState(prev => ({
            ...prev,
            rango: null,
            cliente: null,
            loading: false,
            initialized: true,
          }));
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]); // Note: dependency array is now stable

  /* ── Actions ──────────────────────────────────────── */
  
  const mapAuthError = (message: string) => {
    const msg = message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('disconnected') || msg.includes('internet')) {
      return 'Sin conexión a Internet. Verifica tu señal.';
    }
    return message;
  };

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setState(prev => ({ ...prev, loading: false }));
        return { error: mapAuthError(error.message) };
      }
      return { error: null };
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false }));
      return { error: mapAuthError(err.message || 'Error de conexión') };
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    nombre: string,
    telefono: string,
    lada: string,
  ) => {
    setState(prev => ({ ...prev, loading: true }));

    // 1. Create auth user with metadata (trigger will create the cliente record atomically)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre: nombre,
          telefono: telefono,
          lada: lada,
        }
      }
    });

    if (authError || !authData.user) {
      setState(prev => ({ ...prev, loading: false }));
      return { error: mapAuthError(authError?.message ?? 'Error al crear la cuenta') };
    }

    // 2. If we got a session back (no email confirmation required), profile will be
    //    fetched automatically by the onAuthStateChange listener.
    if (!authData.session) {
      setState(prev => ({ ...prev, loading: false }));
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    // 1. Update state immediately to trigger UI redirection
    setState({
      session: null,
      user: null,
      rango: null,
      cliente: null,
      loading: false,
      initialized: true,
    });

    // 2. Perform server-side sign out in the background
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during Supabase signOut (background):', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (state.user) {
      await fetchProfile(state.user);
    }
  }, [state.user, fetchProfile]);

  /* ── Context value ────────────────────────────────── */

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ───────────────────────────────────────────────── */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
