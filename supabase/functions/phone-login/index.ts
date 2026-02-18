import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return new Response(
        JSON.stringify({ error: "رقم هاتف غير صالح" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone: ensure it starts with country code
    const normalizedPhone = phone.replace(/\s+/g, "").replace(/^0/, "964");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create synthetic email for Supabase Auth
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;
    const deterministicPassword = `PHONE_AUTH_${normalizedPhone}_SECRET_KEY_2024`;

    // Try to sign in first (existing user)
    const { data: signInData } =
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

    // Sign in the newly created user
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
