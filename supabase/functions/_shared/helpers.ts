import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Shared helpers for Supabase Deno edge functions.
 * Behavior-preserving extraction — zero change to any function's runtime behavior,
 * responses, status codes, or auth logic.
 */

// ── CORS ──────────────────────────────────────────────────────────────────────

/**
 * Standard 4-header CORS set.
 * Used by internal auth/util functions: send-otp, verify-otp, set-pin,
 * update-phone, send-push, sync-alwaseet-locations, admin-delete-user,
 * generate-sitemap.
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Extended CORS set that includes Supabase client-platform headers.
 * Required by functions called from the Supabase client SDK on web/native:
 * phone-login, create-admin, create-designer, create-reseller,
 * validate-coupon, send-to-telegram, ai-design-generate.
 */
export const CORS_HEADERS_PLATFORM = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── JSON response helper ───────────────────────────────────────────────────────

/**
 * Build a JSON response using CORS_HEADERS (short set).
 * Functions that need CORS_HEADERS_PLATFORM define their own local json()
 * using that set (ai-design-generate, phone-login).
 */
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

// ── Phone normalization ────────────────────────────────────────────────────────

/**
 * Normalize an Iraqi phone number: strip whitespace, convert leading 0 → 964.
 * Example: "07801234567" → "9647801234567"
 */
export const normalizePhone = (phone: string): string =>
  phone.replace(/\s+/g, "").replace(/^0/, "964");

// ── Supabase service-role client ──────────────────────────────────────────────

/**
 * Create a Supabase admin (service-role) client with token auto-refresh and
 * session persistence disabled — the standard setup for Deno edge functions.
 *
 * Only replaces inline createClient() calls that already had these exact options:
 *   { auth: { autoRefreshToken: false, persistSession: false } }
 * Functions whose original call omits those options (admin-delete-user,
 * send-to-telegram, generate-sitemap) keep their original inline init.
 */
export const getServiceClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
