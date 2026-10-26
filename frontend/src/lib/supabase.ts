import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// EXPO_PUBLIC_ variables are intentionally visible to the mobile app.
// ONLY use a Supabase publishable / anon key here. NEVER use secret/service_role.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseConfig = Boolean(url && publishableKey);

// No Auth in week 1: keep the catalog client stateless.
// Person C can add persistent Auth storage later, without altering catalog screens.
export const supabase: SupabaseClient | null = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;
