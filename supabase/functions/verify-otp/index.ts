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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
      return new Response(
        JSON.stringify({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    // Create synthetic email for Supabase Auth
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;
    // Use a deterministic password based on phone (user never sees this)
    const deterministicPassword = `PHONE_AUTH_${normalizedPhone}_SECRET_KEY_2024`;

    // Try to sign in first
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: syntheticEmail,
        password: deterministicPassword,
      });

    if (signInData?.session) {
      return new Response(
        JSON.stringify({
          success: true,
          session: signInData.session,
          isNewUser: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User doesn't exist, create account
    const { data: signUpData, error: signUpError } =
      await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: deterministicPassword,
        phone: normalizedPhone,
        email_confirm: true,
        user_metadata: { display_name: normalizedPhone, phone: normalizedPhone },
      });

    if (signUpError) {
      console.error("Sign up error:", signUpError);
      return new Response(
        JSON.stringify({ error: "فشل إنشاء الحساب" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sign in the newly created user to get a session
    const { data: newSession, error: newSignInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: syntheticEmail,
        password: deterministicPassword,
      });

    if (newSignInError || !newSession?.session) {
      console.error("New user sign-in error:", newSignInError);
      return new Response(
        JSON.stringify({ error: "فشل تسجيل الدخول" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: newSession.session,
        isNewUser: true,
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
