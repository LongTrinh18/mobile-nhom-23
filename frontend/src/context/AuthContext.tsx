import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../api/types';
import { supabase } from '../lib/supabase';
import { authErrorMessage, loadMyProfile, signOutCurrentDevice } from '../services/auth-service';

type AuthState = { user: User | null; profile: Profile | null; initializing: boolean; profileLoading: boolean;
  error: string | null; refreshProfile: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(Boolean(supabase));
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = useRef<string | null>(null);
  const epoch = useRef(0);
  const refreshProfile = useCallback(async () => {
    const id = owner.current, request = ++epoch.current;
    if (!id) return;
    setProfileLoading(true); setError(null);
    try {
      const next = await loadMyProfile();
      if (epoch.current === request && owner.current === id && next.id === id) setProfile(next);
    } catch (e) {
      if (epoch.current === request) setError(authErrorMessage(e));
    } finally { if (epoch.current === request) setProfileLoading(false); }
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true, receivedEvent = false;
    const invalidate = () => { ++epoch.current; };
    const apply = (next: User | null) => {
      if (!active) return;
      const changed = owner.current !== (next?.id ?? null);
      owner.current = next?.id ?? null;
      setUser(next); setInitializing(false);
      if (changed) {
        ++epoch.current; setProfile(null); setError(null); setProfileLoading(Boolean(next));
        // auth-js holds its lock during notifications: schedule database work afterwards.
        if (next) setTimeout(() => { if (active) void refreshProfile(); }, 0);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true; apply(session?.user ?? null);
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || receivedEvent) return;
      if (sessionError) { setError(authErrorMessage(sessionError)); setInitializing(false); }
      else apply(data.session?.user ?? null);
    }).catch(e => { if (active && !receivedEvent) { setError(authErrorMessage(e)); setInitializing(false); } });
    const refresh = () => {
      if (AppState.currentState === 'active') supabase!.auth.startAutoRefresh();
      else supabase!.auth.stopAutoRefresh();
    };
    const appState = Platform.OS === 'web' ? null : AppState.addEventListener('change', refresh);
    if (Platform.OS !== 'web') refresh();
    return () => { active = false; invalidate(); subscription.unsubscribe(); appState?.remove();
      if (Platform.OS !== 'web') supabase!.auth.stopAutoRefresh(); };
  }, [refreshProfile]);
  return <AuthContext.Provider value={{ user, profile, initializing, profileLoading, error, refreshProfile, signOut: signOutCurrentDevice }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
