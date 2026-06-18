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

    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;

    // Look up user by email to check existence (works regardless of password)
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    const existingUser = profileData;

    if (existingUser) {
      // Check if user is staff (designer or admin)
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUser.user_id);

      const isStaff = (roles || []).some(
        (r: { role: string }) =>
          r.role === "designer" || r.role === "admin" || r.role === "reseller"
      );

      if (isStaff) {
        // Staff must login via staff-login page with password
        return new Response(
          JSON.stringify({
            success: true,
            existingUser: true,
            isStaff: true,
            phone: normalizedPhone,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Regular returning customer — auto-login via magic link (reliable)
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: syntheticEmail,
        });

      if (linkError || !linkData?.properties?.hashed_token) {
        console.error("Generate link error for returning user:", linkError);
        return new Response(
          JSON.stringify({ error: "فشل تسجيل الدخول التلقائي" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange magic link token for a real session
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const verifyResp = await fetch(`${supabaseUrl}/auth/v1/verify`, {
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

      if (verifyResp.ok && sessionData?.access_token) {
        return new Response(
          JSON.stringify({
            success: true,
            existingUser: true,
            isStaff: false,
            session: sessionData,
            phone: normalizedPhone,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("Session exchange failed for returning user:", JSON.stringify(sessionData));
    }

    // New user — OTP DISABLED: auto-create the account and issue a session
    // directly (no WhatsApp code). NOTE: this means a phone number is NOT
    // verified — anyone can sign in as any number. Temporary, by request.
    const salt = Deno.env.get("PHONE_AUTH_SECRET_SALT");
    if (!salt) {
      console.error("PHONE_AUTH_SECRET_SALT is not configured");
      return new Response(
        JSON.stringify({ error: "خطأ في إعدادات الخادم" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${normalizedPhone}`));
    const hashedPassword = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: newUser, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: hashedPassword,
      phone: normalizedPhone,
      email_confirm: true,
      user_metadata: { display_name: normalizedPhone, phone: normalizedPhone },
    });

    if (signUpError || !newUser?.user) {
      console.error("Sign up error:", signUpError);
      return new Response(
        JSON.stringify({ error: "فشل إنشاء الحساب" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Issue a session via magic link (same mechanism as returning users).
    const { data: newLink, error: newLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });

    if (newLinkError || !newLink?.properties?.hashed_token) {
      console.error("Generate link error for new user:", newLinkError);
      return new Response(
        JSON.stringify({ error: "فشل تسجيل الدخول التلقائي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserVerifyResp = await fetch(`${Deno.env.get("SUPABASE_URL")!}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({
        type: "magiclink",
        token_hash: newLink.properties.hashed_token,
      }),
    });

    const newSession = await newUserVerifyResp.json();

    if (!newUserVerifyResp.ok || !newSession?.access_token) {
      console.error("Session exchange failed for new user:", JSON.stringify(newSession));
      return new Response(
        JSON.stringify({ error: "فشل إنشاء الجلسة" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        existingUser: false,
        isNewUser: true,
        isStaff: false,
        session: newSession,
        phone: normalizedPhone,
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
