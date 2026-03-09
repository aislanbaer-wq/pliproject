// lib/supabase.js
// Supabase client — used by both API routes and frontend
// ─────────────────────────────────────────────────────────────────────────────
// Install: npm install @supabase/supabase-js
// Env vars required (Vercel dashboard or .env.local):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← backend only, never expose to browser
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  ← safe for browser

const { createClient } = require('@supabase/supabase-js');

// Backend client (service role — bypasses RLS, only used in API routes)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Frontend client (anon key — subject to RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

module.exports = { supabase, supabaseAdmin };
