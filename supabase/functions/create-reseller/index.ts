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

    // Verify caller is an admin
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!(callerRoles || []).some(r => r.role === "admin")) {
      return new Response(
        JSON.stringify({ error: "هذه الصلاحية متاحة فقط للأدمن" }),
        { status: 403, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    const { phone, password, shop_name, shop_phone, shop_address } = await req.json();

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

    if (!shop_name || typeof shop_name !== "string" || !shop_name.trim()) {
      return new Response(
        JSON.stringify({ error: "اسم المطبعة مطلوب" }),
        { status: 400, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    if (!shop_phone || typeof shop_phone !== "string" || !shop_phone.trim()) {
      return new Response(
        JSON.stringify({ error: "رقم المطبعة مطلوب" }),
        { status: 400, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    if (!shop_address || typeof shop_address !== "string" || !shop_address.trim()) {
      return new Response(
        JSON.stringify({ error: "عنوان المطبعة مطلوب" }),
        { status: 400, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;
    const displayName = shop_name.trim();

    // H4: refuse to act on a phone that already belongs to an account. The old code reset
    // the existing user's password and stripped their role here, which was an account-takeover
    // vector (incl. against the super-admin). Reliable, pagination-safe existence check via
    // profiles.phone (also fixes the listUsers() first-page bug, M9).
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

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      phone: normalizedPhone,
      email_confirm: true,
      user_metadata: { display_name: displayName, phone: normalizedPhone },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: "فشل إنشاء الحساب: " + createError.message }),
        { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }
    const targetUserId: string = newUser.user!.id;

    // Update display_name in profile
    await supabaseAdmin
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", targetUserId);

    // Remove customer role (reseller should only have reseller role)
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .eq("role", "customer");

    // Add reseller role if not already present
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId);

    if (!(existingRoles || []).some(r => r.role === "reseller")) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: targetUserId, role: "reseller" });

      if (roleError) {
        return new Response(
          JSON.stringify({ error: "تم إنشاء الحساب لكن فشل إضافة صلاحية المطبعة" }),
          { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
        );
      }
    }

    // Upsert reseller business profile
    const { error: resellerError } = await supabaseAdmin
      .from("resellers")
      .upsert({
        user_id: targetUserId,
        shop_name: displayName,
        shop_phone: shop_phone.trim(),
        shop_address: shop_address.trim(),
      }, { onConflict: "user_id" });

    if (resellerError) {
      return new Response(
        JSON.stringify({ error: "تم إنشاء الحساب لكن فشل حفظ بيانات المطبعة: " + resellerError.message }),
        { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
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
