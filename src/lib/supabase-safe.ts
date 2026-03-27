import { createClient, SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_PROJECT_ID = 'nqpmyugsscvqsvjxdshd';
const FALLBACK_URL = `https://${FALLBACK_PROJECT_ID}.supabase.co`;
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcG15dWdzc2N2cXN2anhkc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDA4MjIsImV4cCI6MjA4ODkxNjgyMn0.e7RfALb11WA__w0hF5fq0NI3oMxcwQQ4Y4kfC4HcawI';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || FALLBACK_KEY;
const SUPABASE_PROJECT_ID = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) || FALLBACK_PROJECT_ID;

let _client: SupabaseClient | null = null;

export function hasBackendConfig(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_KEY;
}

export function getProjectId(): string | undefined {
  return SUPABASE_PROJECT_ID;
}

export function getAnonKey(): string | undefined {
  return SUPABASE_KEY;
}

export function getBackendClient(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Backend não configurado');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return _client;
}

export function getBackendClientSafe(): SupabaseClient | null {
  if (_client) return _client;
  if (!hasBackendConfig()) return null;
  try {
    return getBackendClient();
  } catch {
    return null;
  }
}

export function getBackendConfigError(): string | null {
  if (hasBackendConfig()) return null;
  return 'A configuração do backend está ausente. Tente republicar o app ou entre em contato com o suporte.';
}
