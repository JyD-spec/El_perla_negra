// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { RangoUsuario } from '@/src/lib/database.types';

/* ── Types ──────────────────────────────────────────────── */

interface ClienteProfile {
  id_cliente: number;
  nombre_completo: string;
  telefono: string;
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
  signUp: (email: string, password: string, nombre: string, telefono: string) => Promise<{ error: string | null }>;
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
        // User is an employee (Caseta, Vendedor, or Barco)
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
        .select('id_cliente, nombre_completo, telefono, es_registrado, push_token')
        .eq('auth_id', user.id)
        .maybeSingle();

      setState(prev => ({
        ...prev,
        rango: null, // Comprador
        cliente: clienteData as ClienteProfile | null,
        loading: false,
        initialized: true,
      }));
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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({ ...prev, session, user: session.user }));
        fetchProfile(session.user);
      } else {
        setState(prev => ({
          ...prev,
          session: null,
          user: null,
          loading: false,
          initialized: true,
        }));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        if (session?.user) {
          await fetchProfile(session.user);
        } else {
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
  }, [fetchProfile]);

  /* ── Actions ──────────────────────────────────────── */

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState(prev => ({ ...prev, loading: false }));
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    nombre: string,
    telefono: string,
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
        }
      }
    });

    if (authError || !authData.user) {
      setState(prev => ({ ...prev, loading: false }));
      return { error: authError?.message ?? 'Error al crear la cuenta' };
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      session: null,
      user: null,
      rango: null,
      cliente: null,
      loading: false,
      initialized: true,
    });
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
