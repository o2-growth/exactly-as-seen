import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { hasBackendConfig, getBackendClientSafe, getBackendConfigError } from '@/lib/supabase-safe';
import type { Session } from '@supabase/supabase-js';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const configOk = hasBackendConfig();

  useEffect(() => {
    if (!configOk) {
      setSession(null);
      return;
    }
    const supabase = getBackendClientSafe();
    if (!supabase) {
      setSession(null);
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [configOk]);

  if (!configOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Configuração ausente</h1>
          <p className="text-muted-foreground text-sm">{getBackendConfigError()}</p>
        </div>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}
