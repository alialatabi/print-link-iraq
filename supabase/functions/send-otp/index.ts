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

// OTP send rate limit: at most this many sends per phone inside the rolling window.
const SEND_LIMIT = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;

/**
 * Routing + OTP delivery for the phone/PIN auth flow.
 *
 * OTP is sent ONLY when the customer needs to verify their phone — i.e. a new account
 * or a recovery ("forgot PIN", force=true) or an existing account that has not chosen a
 * PIN yet. Returning customers who already have a PIN are routed straight to code login
 * with NO SMS. This function NEVER returns a session (sessions come only from a real OTP
 * verification or a correct PIN login).
 *
 * Response: { route: 'staff' | 'code' | 'otp', isNewUser? }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, force } = await req.json();
    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return json({ error: "رقم هاتف غير صالح" }, 400);
    }
    const normalizedPhone = phone.replace(/\s+/g, "").replace(/^0/, "964");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Resolve account state: staff vs customer, and whether a PIN is set.
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("user_id, pin_set_at")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    if (profileData) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profileData.user_id);
      const isStaff = (roles || []).some(
        (r: { role: string }) => r.role === "designer" || r.role === "admin" || r.role === "reseller",
      );
      if (isStaff) {
        // Staff sign in with their password on the staff page; never OTP.
        return json({ route: "staff" }, 200);
      }
      // Returning customer who already has a PIN → straight to code login (no SMS),
      // unless this is an explicit recovery request (force = "forgot my PIN").
      if (profileData.pin_set_at && !force) {
        return json({ route: "code" }, 200);
      }
    }

    const isNewUser = !profileData;

    // ── Rate-limit OTP sending (anti SMS-bombing / OTPIQ cost abuse) ──
    const now = Date.now();
    const { data: throttle } = await supabaseAdmin
      .from("phone_throttle")
      .select("otp_send_count, otp_send_window_start")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    let count = throttle?.otp_send_count ?? 0;
    let windowStart = throttle?.otp_send_window_start ? new Date(throttle.otp_send_window_start).getTime() : 0;
    if (!windowStart || now - windowStart > SEND_WINDOW_MS) {
      // Window expired (or first send) → reset.
      windowStart = now;
      count = 0;
    }
    if (count >= SEND_LIMIT) {
      const minutesLeft = Math.ceil((windowStart + SEND_WINDOW_MS - now) / 60000);
      return json({ error: `تم تجاوز عدد المحاولات. حاول بعد ${minutesLeft} دقائق` }, 429);
    }
    await supabaseAdmin.from("phone_throttle").upsert({
      phone: normalizedPhone,
      otp_send_count: count + 1,
      otp_send_window_start: new Date(windowStart).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // ── Generate + store a 6-digit OTP (CSPRNG), 5-minute expiry ──
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const code = String(100000 + (randomBytes[0] % 900000));
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();

    await supabaseAdmin.from("otp_codes").update({ used: true })
      .eq("phone", normalizedPhone).eq("used", false);

    const { error: insertError } = await supabaseAdmin
      .from("otp_codes")
      .insert({ phone: normalizedPhone, code, expires_at: expiresAt });
    if (insertError) {
      console.error("DB insert error:", insertError);
      return json({ error: "خطأ في حفظ الرمز" }, 500);
    }

    // ── Deliver via OTPIQ (auto channel: SMS / WhatsApp / Telegram) ──
    const otpiqApiKey = Deno.env.get("OTPIQ_API_KEY");
    if (!otpiqApiKey) {
      console.error("OTPIQ_API_KEY not configured");
      return json({ error: "خدمة الرسائل غير مهيأة" }, 500);
    }
    const provider = Deno.env.get("OTPIQ_PROVIDER") || "auto";
    const otpiqResponse = await fetch("https://api.otpiq.com/api/sms", {
      method: "POST",
      headers: { Authorization: `Bearer ${otpiqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: normalizedPhone, smsType: "verification", verificationCode: code, provider }),
    });
    if (!otpiqResponse.ok) {
      const otpiqData = await otpiqResponse.json().catch(() => ({}));
      console.error("OTPIQ API error:", otpiqResponse.status, JSON.stringify(otpiqData));
      return json({ error: "فشل إرسال رمز التحقق" }, 500);
    }

    return json({ route: "otp", isNewUser }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
