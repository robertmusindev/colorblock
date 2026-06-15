import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
  initializeAuth: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  
  initializeAuth: () => {
    // Safety net: never let the app hang on the LOADING screen if Supabase is
    // unreachable (e.g. paused project / DNS failure). Clear loading after 5s.
    const failsafe = setTimeout(() => {
      set((s) => (s.isLoading ? { isLoading: false } : s));
    }, 5000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(failsafe);
        set({ session, user: session?.user ?? null, isLoading: false });
      })
      .catch((err) => {
        clearTimeout(failsafe);
        console.error('Auth init failed (Supabase unreachable?):', err);
        set({ session: null, user: null, isLoading: false });
      });

    supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(failsafe);
      set({ session, user: session?.user ?? null, isLoading: false });
    });
  },
  
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  }
}));
