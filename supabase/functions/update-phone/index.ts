import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS, json, normalizePhone, getServiceClient } from "../_shared/helpers.ts";

// Change the authenticated customer's phone number after verifying an OTP that was sent to the NEW
// number. The phone is the login identity (synthetic email `{phone}@phone.matbaati.local` + a
// phone-derived password), so a change must re-key the auth user — not just `profiles.phone` —
// otherwise the next login would break. Mirrors verify-otp's crypto + session minting.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { newPhone, code } = await req.json();

    if (!newPhone || typeof newPhone !== "string" || newPhone.length < 10) {
      return json({ error: "رقم هاتف غير صالح" }, 400);
    }
    if (!code) {
      return json({ error: "رمز التحقق مطلوب" }, 400);
    }

    const normalizedPhone = normalizePhone(newPhone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller from their JWT (verify_jwt is off; we validate manually).
    // getUser() MUST be given the JWT explicitly — a server-side client has no stored
    // session, so a bare getUser() always fails.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "غير مصرح" }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "غير مصرح" }, 401);

    const supabaseAdmin = getServiceClient();

    // No-op guard: changing to the same number is pointless.
    const { data: myProfile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("user_id", user.id)
      .maybeSingle();
    if (myProfile?.phone === normalizedPhone) {
      return json({ error: "هذا هو رقمك الحالي" }, 400);
    }

    // Reject if the new number already belongs to a different account.
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", normalizedPhone)
      .neq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (taken) {
      return json({ error: "هذا الرقم مستخدم بالفعل بحساب آخر" }, 409);
    }

    // Rate limiting: shared otp_attempts row (keyed by the target phone).
    const { data: attempts } = await supabaseAdmin
      .from("otp_attempts")
      .select("*")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (attempts?.locked_until && new Date(attempts.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(attempts.locked_until).getTime() - Date.now()) / 60000
      );
      return json({ error: `تم تجاوز عدد المحاولات. حاول بعد ${minutesLeft} دقائق` }, 429);
    }

    // Verify the OTP that send-otp delivered to the new number.
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      const currentAttempts = (attempts?.attempts || 0) + 1;
      const lockout = currentAttempts >= 5
        ? { locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() }
        : {};
      await supabaseAdmin
        .from("otp_attempts")
        .upsert({
          phone: normalizedPhone,
          attempts: currentAttempts,
          last_attempt: new Date().toISOString(),
          ...lockout,
        });

      const remaining = 5 - currentAttempts;
      const errorMsg = remaining <= 0
        ? "تم تجاوز عدد المحاولات. حاول بعد 15 دقيقة"
        : `رمز التحقق غير صحيح. المحاولات المتبقية: ${remaining}`;
      return json({ error: errorMsg }, remaining <= 0 ? 429 : 400);
    }

    // Mark OTP as used.
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    // Re-key the auth identity: synthetic email + phone + phone-derived password.
    const salt = Deno.env.get("PHONE_AUTH_SECRET_SALT");
    if (!salt) {
      console.error("PHONE_AUTH_SECRET_SALT is not configured");
      return json({ error: "خطأ في إعدادات الخادم" }, 500);
    }
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${salt}:${normalizedPhone}`)
    );
    const hashedPassword = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email: syntheticEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      email_confirm: true,
      user_metadata: { ...user.user_metadata, phone: normalizedPhone },
    });
    if (updErr) {
      console.error("Auth update error:", updErr);
      return json({ error: "فشل تحديث الرقم. قد يكون مستخدماً بالفعل" }, 500);
    }

    // Update the profile and re-stamp the OTP window.
    await supabaseAdmin
      .from("profiles")
      .update({ phone: normalizedPhone, last_otp_verified_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // Reset attempts for the new number.
    await supabaseAdmin
      .from("otp_attempts")
      .delete()
      .eq("phone", normalizedPhone);

    // Changing email/password may revoke the existing refresh token, so mint a fresh session
    // for the new identity and hand it back for the client to adopt.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Generate link error:", linkError);
      // The phone was changed successfully; the client can re-login if the session is lost.
      return json({ success: true, phone: normalizedPhone, session: null }, 200);
    }

    const verifyResp = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ type: "magiclink", token_hash: linkData.properties.hashed_token }),
    });
    const sessionData = await verifyResp.json().catch(() => null);

    return json(
      {
        success: true,
        phone: normalizedPhone,
        session: verifyResp.ok && sessionData?.access_token ? sessionData : null,
      },
      200
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
