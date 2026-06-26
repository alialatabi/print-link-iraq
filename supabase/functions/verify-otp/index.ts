import { CORS_HEADERS, json, normalizePhone, getServiceClient } from "../_shared/helpers.ts";

const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Verify a phone OTP (first-time verification or forgot-PIN recovery only).
 *
 * On success it mints a session so the client is signed in, and reports `needsPin`
 * so the UI forces the customer to choose / reset their 6-digit PIN (via set-pin)
 * before continuing. New accounts are created here with an UNGUESSABLE random
 * password — the customer cannot PIN-login until they set one.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { phone, code } = await req.json();
    if (!phone || !code) return json({ error: "رقم الهاتف والرمز مطلوبان" }, 400);

    const normalizedPhone = normalizePhone(phone);
    const supabaseAdmin = getServiceClient();

    // ── Brute-force lockout for OTP verification (otp_attempts). Reset a stale lock. ──
    const { data: attempts } = await supabaseAdmin
      .from("otp_attempts").select("*").eq("phone", normalizedPhone).maybeSingle();

    const lockActive = attempts?.locked_until && new Date(attempts.locked_until) > new Date();
    if (lockActive) {
      const minutesLeft = Math.ceil((new Date(attempts!.locked_until).getTime() - Date.now()) / 60000);
      return json({ error: `تم تجاوز عدد المحاولات. حاول بعد ${minutesLeft} دقائق` }, 429);
    }
    // H6 fix: once the lock window has passed, start counting fresh instead of
    // resuming at the old (>=5) count which would re-lock on the first attempt.
    const priorAttempts = (attempts && !attempts.locked_until) ? (attempts.attempts || 0) : 0;

    // ── Find a valid, unused, unexpired code ──
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("otp_codes").select("*")
      .eq("phone", normalizedPhone).eq("code", code).eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).single();

    if (otpError || !otpRecord) {
      const currentAttempts = priorAttempts + 1;
      const lockout = currentAttempts >= LOCK_THRESHOLD
        ? { locked_until: new Date(Date.now() + LOCK_MS).toISOString() }
        : { locked_until: null };
      await supabaseAdmin.from("otp_attempts").upsert({
        phone: normalizedPhone, attempts: currentAttempts,
        last_attempt: new Date().toISOString(), ...lockout,
      });
      const remaining = LOCK_THRESHOLD - currentAttempts;
      return json(
        { error: remaining <= 0 ? "تم تجاوز عدد المحاولات. حاول بعد 15 دقيقة" : `رمز التحقق غير صحيح. المحاولات المتبقية: ${remaining}` },
        remaining <= 0 ? 429 : 400,
      );
    }

    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);

    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;

    // Existing account? (profile auto-created by handle_new_user trigger.)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles").select("user_id, pin_set_at")
      .eq("phone", normalizedPhone).limit(1).maybeSingle();

    let isNewUser = false;
    if (!existingProfile) {
      // New account: create with a random unguessable password (the customer sets
      // a real PIN immediately via set-pin; they can't PIN-login until then).
      const rnd = new Uint8Array(24);
      crypto.getRandomValues(rnd);
      const randomPassword = Array.from(rnd).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail, password: randomPassword, phone: normalizedPhone,
        email_confirm: true, user_metadata: { display_name: normalizedPhone, phone: normalizedPhone },
      });
      if (signUpError && signUpError.code !== "email_exists") {
        console.error("Sign up error:", signUpError);
        return json({ error: "فشل إنشاء الحساب" }, 500);
      }
      isNewUser = !signUpError;
    }

    // Mint a session via admin magic-link → exchange.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink", email: syntheticEmail,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Generate link error:", linkError);
      return json({ error: "فشل إنشاء الجلسة" }, 500);
    }
    const verifyResp = await fetch(`${Deno.env.get("SUPABASE_URL")!}/auth/v1/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      body: JSON.stringify({ type: "magiclink", token_hash: linkData.properties.hashed_token }),
    });
    const sessionData = await verifyResp.json();
    if (!verifyResp.ok || !sessionData?.access_token) {
      console.error("Verify error:", JSON.stringify(sessionData));
      return json({ error: "فشل التحقق من الجلسة" }, 500);
    }

    // Clear throttles for this phone on success.
    await supabaseAdmin.from("otp_attempts").delete().eq("phone", normalizedPhone);

    // needsPin: true for new accounts and existing ones that never chose a PIN
    // (legacy migration) → the client forces a set-PIN step before continuing.
    const needsPin = isNewUser || !existingProfile?.pin_set_at;

    return json({ success: true, session: sessionData, isNewUser, needsPin }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
