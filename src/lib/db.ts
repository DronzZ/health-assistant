import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _serviceClient: SupabaseClient | null = null;
let _anonClient: SupabaseClient | null = null;

// Supabase JS client needs the project base URL, not the REST endpoint URL.
// Strip any trailing /rest/v1/ that may have been put in the env var by mistake.
function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/rest\/v1\/?$/, "");
}

export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(supabaseUrl(), process.env.SUPABASE_SERVICE_KEY!);
  }
  return _serviceClient;
}

export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(supabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return _anonClient;
}

// Proxy: all property accesses go through the lazy singleton
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getServiceClient() as any)[prop];
  },
});

// Awaits a Supabase query builder and THROWS if it returned an error, instead of
// silently ignoring failed writes (which made the bot reply "✅ saved" when the
// row never persisted). Returns the query's `data`. Use for every write, and for
// reads where a failure should surface to the user rather than show false success.
export async function runQuery<T>(
  query: PromiseLike<{ data: T; error: { message?: string } | null }>,
  context: string
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${context}: ${error.message ?? "database error"}`);
  }
  return data;
}
