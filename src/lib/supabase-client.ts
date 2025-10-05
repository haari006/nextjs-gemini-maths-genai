import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn("Supabase URL and anon key are not provided. Supabase features will be disabled.");
  // Create a mock client to avoid breaking the app
  supabase = {
    from: () => ({
      select: async () => ({ data: [], error: null }),
      insert: async () => ({ data: [], error: { message: "Supabase not configured", code: "500" } }),
      update: async () => ({ data: [], error: { message: "Supabase not configured", code: "500" } }),
      delete: async () => ({ data: [], error: { message: "Supabase not configured", code: "500" } }),
    }),
  } as any;
}

export { supabase };
