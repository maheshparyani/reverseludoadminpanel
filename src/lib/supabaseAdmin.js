import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client with service_role — bypasses RLS.
 * Use from Next.js Route Handlers only (never import in 'use client' components).
 */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set for admin APIs',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
