import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const configValida = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith("https://") &&
  supabaseAnonKey &&
  supabaseAnonKey.length > 20,
);

export const supabase = configValida
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
