import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

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
