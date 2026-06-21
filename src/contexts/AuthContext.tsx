import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { syncProfileFromAuth } from '../services/profile';

type AuthState = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  guestMode: boolean;
  needsOnboarding: boolean | null;
  enterAsGuest: () => void;
  signOut: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
  markOnboardingDone: () => void;
};

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  configured: false,
  guestMode: false,
  needsOnboarding: null,
  enterAsGuest: () => {},
  signOut: async () => {},
  refreshOnboarding: async () => {},
  markOnboardingDone: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  async function checkOnboarding(uid: string | undefined) {
    if (!uid) {
      setNeedsOnboarding(null);
      return;
    }
    const { count, error } = await supabase
      .from('emergency_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);
    if (error) {
      setNeedsOnboarding(false);
      return;
    }
    setNeedsOnboarding((count ?? 0) === 0);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        syncProfileFromAuth();
        await checkOnboarding(data.session.user.id);
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s && event === 'SIGNED_IN') {
        syncProfileFromAuth();
        checkOnboarding(s.user.id);
      }
      if (!s) setNeedsOnboarding(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setSession(null);
    setGuestMode(false);
    setNeedsOnboarding(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        configured: isSupabaseConfigured,
        guestMode,
        needsOnboarding,
        enterAsGuest: () => {
          setGuestMode(true);
          setNeedsOnboarding(false);
        },
        signOut,
        refreshOnboarding: () => checkOnboarding(session?.user.id),
        markOnboardingDone: () => setNeedsOnboarding(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
