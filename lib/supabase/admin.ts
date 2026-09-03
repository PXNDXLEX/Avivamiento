import { createClient } from '@supabase/supabase-js';

/**
 * Admin client usando la service role key.
 * Solo usar en Server Actions / Route Handlers.
 * Requiere SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
