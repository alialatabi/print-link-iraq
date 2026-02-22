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

    // Generate secure password using SHA-256 + secret salt
    const salt = Deno.env.get("PHONE_AUTH_SECRET_SALT") || "";
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${normalizedPhone}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

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
        (r: { role: string }) => r.role === "designer" || r.role === "admin"
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

      // Regular returning customer — auto-login with hashed password
      const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({
        email: syntheticEmail,
        password: hashedPassword,
      });

      if (signInData?.session) {
        return new Response(
          JSON.stringify({
            success: true,
            existingUser: true,
            isStaff: false,
            session: signInData.session,
            phone: normalizedPhone,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // New user — send OTP for first-time verification
    // Generate 6-digit OTP using cryptographically secure randomness
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const code = String(100000 + (randomBytes[0] % 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Invalidate previous unused codes for this phone
    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("phone", normalizedPhone)
      .eq("used", false);

    // Insert new code
    const { error: insertError } = await supabaseAdmin
      .from("otp_codes")
      .insert({ phone: normalizedPhone, code, expires_at: expiresAt });

    if (insertError) {
      console.error("DB insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "خطأ في حفظ الرمز" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Twilio WhatsApp
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "خدمة الرسائل غير مهيأة" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const body = new URLSearchParams({
      From: `whatsapp:${fromNumber}`,
      To: `whatsapp:+${normalizedPhone}`,
      Body: `رمز التحقق الخاص بك هو: ${code}\n\nصالح لمدة 5 دقائق.`,
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio API error:", JSON.stringify(twilioData));
      return new Response(
        JSON.stringify({ error: "فشل إرسال رمز التحقق", details: twilioData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, existingUser: false, phone: normalizedPhone }),
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
