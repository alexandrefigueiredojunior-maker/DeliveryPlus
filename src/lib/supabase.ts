import { createClient } from '@supabase/supabase-js';

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function sanitize(val: string) {
  if (!val) return val;
  // Remove possible quotes at start and end
  let sanitized = val.trim();
  if (sanitized.startsWith('"') && sanitized.endsWith('"')) sanitized = sanitized.slice(1, -1);
  if (sanitized.startsWith("'") && sanitized.endsWith("'")) sanitized = sanitized.slice(1, -1);
  sanitized = sanitized.trim();
  
  // Ensure it has a protocol if it's supposed to be the URL
  if (sanitized && !sanitized.includes('://') && sanitized.includes('.supabase.co')) {
    sanitized = `https://${sanitized}`;
  }
  
  return sanitized;
}

let sanitizedUrl = sanitize(supabaseUrl);
const sanitizedKey = sanitize(supabaseAnonKey);

if (sanitizedUrl) {
  sanitizedUrl = sanitizedUrl.replace(/\/+$/, ''); // Remove trailing slashes
  sanitizedUrl = sanitizedUrl.replace(/\/rest\/v1\/?$/, ''); // Remove /rest/v1
  sanitizedUrl = sanitizedUrl.replace(/\/auth\/v1\/?$/, ''); // Remove /auth/v1
}

console.log('Supabase Init:', {
  url: sanitizedUrl,
  hasKey: !!sanitizedKey,
  isConfigured: !!(sanitizedUrl && sanitizedKey && sanitizedUrl !== 'https://placeholder.supabase.co')
});

export const supabase = createClient(
  sanitizedUrl || 'https://placeholder.supabase.co', 
  sanitizedKey || 'placeholder'
);

export const isSupabaseConfigured = !!(sanitizedUrl && sanitizedKey && sanitizedUrl !== 'https://placeholder.supabase.co');
