import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS, json, getServiceClient } from "../_shared/helpers.ts";

/** Reject trivially-guessable PINs (all-same, simple ascending/descending runs). */
function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true; // 000000, 111111…
  const asc = "0123456789", desc = "9876543210";
  if (asc.includes(pin) || desc.includes(pin)) return true; // 123456, 654321…
  if (pin === "000000" || pin === "123456") return true;
  return false;
}

/**
 * Set the caller's 6-digit login PIN as their real (bcrypt-hashed) Supabase password.
 * Authenticated only (verify_jwt = true). Used right after OTP verification, for both
 * first-time PIN setup and forgot-PIN recovery.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return json({ error: "الرمز يجب أن يكون 6 أرقام" }, 400);
    }
    if (isWeakPin(code)) {
      return json({ error: "رمز ضعيف جداً، اختر رمزاً أصعب" }, 400);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "غير مصرح" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Verify the caller's identity from the JWT (do NOT trust client-supplied ids).
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "غير مصرح" }, 401);

    const supabaseAdmin = getServiceClient();

    // Set the PIN as the account password.
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: code });
    if (updErr) {
      console.error("set-pin update error:", updErr);
      return json({ error: "تعذّر حفظ الرمز" }, 500);
    }

    // Stamp pin_set_at so the login flow routes this account to PIN login from now on,
    // and clear any login lockout for the phone.
    await supabaseAdmin.from("profiles").update({ pin_set_at: new Date().toISOString() }).eq("user_id", user.id);
    const phone = (user.user_metadata as { phone?: string })?.phone;
    if (phone) {
      await supabaseAdmin.from("phone_throttle")
        .update({ login_attempts: 0, login_locked_until: null }).eq("phone", phone);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
