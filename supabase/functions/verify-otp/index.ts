import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف والرمز مطلوبان" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = phone.replace(/\s+/g, "").replace(/^0/, "964");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Rate limiting: check attempts
    const { data: attempts } = await supabaseAdmin
      .from("otp_attempts")
      .select("*")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (attempts?.locked_until && new Date(attempts.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(attempts.locked_until).getTime() - Date.now()) / 60000);
      return new Response(
        JSON.stringify({ error: `تم تجاوز عدد المحاولات. حاول بعد ${minutesLeft} دقائق` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find valid OTP
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
      // Increment failed attempts
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

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: remaining <= 0 ? 429 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;
    
    // Generate secure password using SHA-256 + secret salt
    const salt = Deno.env.get("PHONE_AUTH_SECRET_SALT");
    if (!salt) {
      console.error("PHONE_AUTH_SECRET_SALT is not configured");
      return new Response(
        JSON.stringify({ error: "خطأ في إعدادات الخادم" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const encoder = new TextEncoder();
    const hashData = encoder.encode(`${salt}:${normalizedPhone}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Check if the account already exists via the profiles table (a profile is
    // auto-created by the handle_new_user trigger). This avoids paginating
    // auth.admin.listUsers(), which only returns the first page of users.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    let isNewUser = false;

    if (!existingProfile) {
      // First-time customer: create the auth user. The trigger creates the
      // matching profile + default customer role.
      const { data: newUser, error: signUpError } =
        await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
          password: hashedPassword,
          phone: normalizedPhone,
          email_confirm: true,
          user_metadata: { display_name: normalizedPhone, phone: normalizedPhone },
        });

      if (signUpError && signUpError.code !== "email_exists") {
        console.error("Sign up error:", signUpError);
        return new Response(
          JSON.stringify({ error: "فشل إنشاء الحساب" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      isNewUser = !signUpError;
    }

    // Generate a session using Admin API (bypasses email provider requirement)
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: syntheticEmail,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Generate link error:", linkError);
      return new Response(
        JSON.stringify({ error: "فشل إنشاء الجلسة" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange the magic link token for a real session
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const verifyUrl = `${supabaseUrl}/auth/v1/verify`;
    const verifyResp = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({
        type: "magiclink",
        token_hash: linkData.properties.hashed_token,
      }),
    });

    const sessionData = await verifyResp.json();

    if (!verifyResp.ok || !sessionData?.access_token) {
      console.error("Verify error:", JSON.stringify(sessionData));
      return new Response(
        JSON.stringify({ error: "فشل التحقق من الجلسة" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset attempts on successful verification
    await supabaseAdmin
      .from("otp_attempts")
      .delete()
      .eq("phone", normalizedPhone);

    // Stamp the OTP verification time so send-otp can skip OTP (auto-login) for the next 3 weeks
    // and the client knows when to force a re-verification.
    await supabaseAdmin
      .from("profiles")
      .update({ last_otp_verified_at: new Date().toISOString() })
      .eq("phone", normalizedPhone);

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        isNewUser,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
