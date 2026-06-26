import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Phone + password sign-in. `password` is the customer's 6-digit PIN or a staff password —
 * both are real bcrypt-hashed Supabase passwords. There is NO passwordless / salt-derived
 * branch (the old one was an unauthenticated account-takeover, C1) and NO account creation
 * (accounts are created only by verify-otp after a real OTP). A per-phone lockout defends the
 * small (1e6) PIN space against brute force.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, password } = await req.json();
    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return json({ error: "رقم هاتف غير صالح" }, 400);
    }
    if (!password || typeof password !== "string") {
      return json({ error: "الرمز مطلوب" }, 400);
    }

    const normalizedPhone = phone.replace(/\s+/g, "").replace(/^0/, "964");
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Lockout check (reset a stale lock so legitimate users aren't permanently blocked) ──
    const { data: throttle } = await supabaseAdmin
      .from("phone_throttle")
      .select("login_attempts, login_locked_until")
      .eq("phone", normalizedPhone).maybeSingle();

    const locked = throttle?.login_locked_until && new Date(throttle.login_locked_until) > new Date();
    if (locked) {
      const minutesLeft = Math.ceil((new Date(throttle!.login_locked_until).getTime() - Date.now()) / 60000);
      return json({ error: `تم تجاوز عدد المحاولات. حاول بعد ${minutesLeft} دقائق` }, 429);
    }
    const priorAttempts = (throttle && !throttle.login_locked_until) ? (throttle.login_attempts || 0) : 0;

    // ── Authenticate (the only verification step) ──
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: syntheticEmail, password,
    });

    if (signInError || !signInData?.session) {
      const currentAttempts = priorAttempts + 1;
      const lockout = currentAttempts >= LOCK_THRESHOLD
        ? { login_locked_until: new Date(Date.now() + LOCK_MS).toISOString() }
        : { login_locked_until: null };
      await supabaseAdmin.from("phone_throttle").upsert({
        phone: normalizedPhone, login_attempts: currentAttempts,
        updated_at: new Date().toISOString(), ...lockout,
      });
      const remaining = LOCK_THRESHOLD - currentAttempts;
      return json(
        { error: remaining <= 0 ? "تم تجاوز عدد المحاولات. حاول بعد 15 دقيقة" : "الرمز غير صحيح" },
        remaining <= 0 ? 429 : 401,
      );
    }

    // Success → clear login attempts.
    await supabaseAdmin.from("phone_throttle")
      .update({ login_attempts: 0, login_locked_until: null, updated_at: new Date().toISOString() })
      .eq("phone", normalizedPhone);

    return json({ success: true, session: signInData.session }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
