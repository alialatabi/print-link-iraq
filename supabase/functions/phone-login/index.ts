import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, password } = await req.json();

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return json({ error: "رقم هاتف غير صالح" }, 400);
    }

    const normalizedPhone = phone.replace(/\s+/g, "").replace(/^0/, "964");
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Resolve the password to use. If the caller supplied one (staff login),
    // use it directly. Otherwise fall back to the deterministic salt-derived
    // password (legacy passwordless flow) — only this branch needs the salt.
    let loginPassword: string | undefined = password;
    if (!loginPassword) {
      const salt = Deno.env.get("PHONE_AUTH_SECRET_SALT");
      if (!salt) {
        console.error("PHONE_AUTH_SECRET_SALT is not configured");
        return json({ error: "خطأ في إعدادات الخادم" }, 500);
      }
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(`${salt}:${normalizedPhone}`),
      );
      loginPassword = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check whether the account already exists.
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users?.find((u) => u.email === syntheticEmail);

    let isNewUser = false;

    if (!existingUser) {
      // First time this phone is seen: create the account with the supplied
      // password so the user can sign in with it from now on.
      const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: loginPassword,
        phone: normalizedPhone,
        email_confirm: true,
        user_metadata: { display_name: normalizedPhone, phone: normalizedPhone },
      });

      if (signUpError && signUpError.code !== "email_exists") {
        console.error("Sign up error:", signUpError);
        return json({ error: "فشل إنشاء الحساب" }, 500);
      }
      isNewUser = !signUpError;
    }

    // Authenticate with the password. This is the real verification step:
    // an existing user must provide the correct password to obtain a session.
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData, error: signInError } =
      await supabaseAuth.auth.signInWithPassword({
        email: syntheticEmail,
        password: loginPassword!,
      });

    if (signInError || !signInData?.session) {
      console.error("Sign in error:", signInError?.message);
      return json({ error: "كلمة المرور غير صحيحة" }, 401);
    }

    return json({ success: true, session: signInData.session, isNewUser }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
