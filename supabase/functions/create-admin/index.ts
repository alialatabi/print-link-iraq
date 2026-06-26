import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS_PLATFORM, normalizePhone, getServiceClient } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS_PLATFORM });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = getServiceClient();

    // Verify the calling user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is super admin using the database flag
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "هذه الصلاحية متاحة فقط للسوبر أدمن" }),
        { status: 403, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    // Also verify caller has admin role
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!(callerRoles || []).some(r => r.role === "admin")) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 403, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    const { phone, display_name, password } = await req.json();

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return new Response(
        JSON.stringify({ error: "رقم هاتف غير صالح" }),
        { status: 400, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
        { status: 400, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;

    // H4: refuse to act on a phone that already belongs to an account. The old code reset
    // the existing user's password here, which was an account-takeover vector. Reliable,
    // pagination-safe existence check via profiles.phone (also fixes the listUsers()
    // first-page bug, M9). Promoting an existing user to admin must be done deliberately,
    // not by colliding on a phone number.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "يوجد حساب مسجّل بهذا الرقم بالفعل — استخدم رقماً آخر" }),
        { status: 409, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      phone: normalizedPhone,
      email_confirm: true,
      user_metadata: { display_name: display_name || normalizedPhone, phone: normalizedPhone },
    });

    if (createError) {
      console.error("Create user error:", createError);
      return new Response(
        JSON.stringify({ error: "فشل إنشاء الحساب: " + createError.message }),
        { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }
    const targetUserId: string = newUser.user!.id;

    // Update display_name in profile if provided
    if (display_name) {
      await supabaseAdmin
        .from("profiles")
        .update({ display_name })
        .eq("user_id", targetUserId);
    }

    // Add admin role if not already present
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId);

    if (!(existingRoles || []).some(r => r.role === "admin")) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: targetUserId, role: "admin" });

      if (roleError) {
        console.error("Role insert error:", roleError);
        return new Response(
          JSON.stringify({ error: "تم إنشاء الحساب لكن فشل إضافة صلاحية الأدمن" }),
          { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: targetUserId, is_new: true }),
      { status: 200, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "خطأ غير متوقع" }),
      { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
    );
  }
});
