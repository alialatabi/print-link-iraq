import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// OTP validity window: after a successful OTP, a returning customer is auto-logged-in WITHOUT a new
// code (and no SMS cost) for this long; after it, OTP is required again. 3 weeks.
const OTP_VALIDITY_MS = 21 * 24 * 60 * 60 * 1000;

// Mint a real session for an existing user without an OTP (admin magic-link → exchange), mirroring
// verify-otp's session step. Returns null on failure so callers can fall back to sending an OTP.
// deno-lint-ignore no-explicit-any
async function createSessionForEmail(supabaseAdmin: any, supabaseUrl: string, anonKey: string, email: string) {
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !linkData?.properties?.hashed_token) return null;
  const resp = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ type: "magiclink", token_hash: linkData.properties.hashed_token }),
  });
  const session = await resp.json().catch(() => null);
  if (!resp.ok || !session?.access_token) return null;
  return session;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return json({ error: "رقم هاتف غير صالح" }, 400);
    }

    // Normalize phone: strip spaces, replace a leading 0 with the Iraq code.
    const normalizedPhone = phone.replace(/\s+/g, "").replace(/^0/, "964");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up an existing profile to (a) tell new vs. returning customers
    // apart and (b) keep staff out of the OTP flow (they use password login).
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("user_id, last_otp_verified_at")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    if (profileData) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profileData.user_id);

      const isStaff = (roles || []).some(
        (r: { role: string }) =>
          r.role === "designer" || r.role === "admin" || r.role === "reseller"
      );

      if (isStaff) {
        // Staff must sign in via the staff-login page with their password.
        return json({ success: true, existingUser: true, isStaff: true, phone: normalizedPhone }, 200);
      }

      // Within the OTP validity window → auto-login this returning customer WITHOUT a new code
      // (no SMS / no OTPIQ cost). After the window, fall through to the normal OTP send below.
      const lastOtp = (profileData as { last_otp_verified_at?: string | null }).last_otp_verified_at;
      if (lastOtp && Date.now() - new Date(lastOtp).getTime() < OTP_VALIDITY_MS) {
        const session = await createSessionForEmail(
          supabaseAdmin,
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          `${normalizedPhone}@phone.matbaati.local`,
        );
        if (session) {
          return json({ success: true, existingUser: true, isStaff: false, session }, 200);
        }
        // session mint failed → fall through and send an OTP instead (safe fallback).
      }
    }

    const existingUser = !!profileData;

    // Rate limit OTP *sending* so the WhatsApp endpoint can't be abused as a
    // free messaging gun. Reuse the otp_attempts row that verify-otp manages.
    const { data: attempts } = await supabaseAdmin
      .from("otp_attempts")
      .select("locked_until")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (attempts?.locked_until && new Date(attempts.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(attempts.locked_until).getTime() - Date.now()) / 60000
      );
      return json({ error: `تم تجاوز عدد المحاولات. حاول بعد ${minutesLeft} دقائق` }, 429);
    }

    // Both new and returning customers must verify by OTP on every login.
    // Generate a 6-digit code using cryptographically secure randomness.
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const code = String(100000 + (randomBytes[0] % 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Invalidate previous unused codes for this phone.
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("phone", normalizedPhone)
      .eq("used", false);

    const { error: insertError } = await supabaseAdmin
      .from("otp_codes")
      .insert({ phone: normalizedPhone, code, expires_at: expiresAt });

    if (insertError) {
      console.error("DB insert error:", insertError);
      return json({ error: "خطأ في حفظ الرمز" }, 500);
    }

    // Deliver the code via OTPIQ (Iraq-focused: SMS / WhatsApp / Telegram). We generate and
    // store the code ourselves (above) and pass it as OTPIQ's `verificationCode`; OTPIQ sends a
    // verification message and, with provider "auto", routes over the most reliable available
    // channel for the number. phoneNumber must be the full international form without "+" (e.g.
    // 9647xxxxxxxxx) — `normalizedPhone` already matches that.
    const otpiqApiKey = Deno.env.get("OTPIQ_API_KEY");
    if (!otpiqApiKey) {
      console.error("OTPIQ_API_KEY not configured");
      return json({ error: "خدمة الرسائل غير مهيأة" }, 500);
    }
    // auto | whatsapp | sms | telegram — "auto" lets OTPIQ pick + fall back for best delivery.
    const provider = Deno.env.get("OTPIQ_PROVIDER") || "auto";

    const otpiqResponse = await fetch("https://api.otpiq.com/api/sms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${otpiqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber: normalizedPhone,
        smsType: "verification",
        verificationCode: code,
        provider,
      }),
    });

    if (!otpiqResponse.ok) {
      const otpiqData = await otpiqResponse.json().catch(() => ({}));
      console.error("OTPIQ API error:", otpiqResponse.status, JSON.stringify(otpiqData));
      return json({ error: "فشل إرسال رمز التحقق" }, 500);
    }

    return json({ success: true, existingUser, isStaff: false, phone: normalizedPhone }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
