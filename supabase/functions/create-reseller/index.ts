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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!(callerRoles || []).some(r => r.role === "admin")) {
      return new Response(
        JSON.stringify({ error: "هذه الصلاحية متاحة فقط للأدمن" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, password, shop_name, shop_phone, shop_address } = await req.json();

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return new Response(
        JSON.stringify({ error: "رقم هاتف غير صالح" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shop_name || typeof shop_name !== "string" || !shop_name.trim()) {
      return new Response(
        JSON.stringify({ error: "اسم المطبعة مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shop_phone || typeof shop_phone !== "string" || !shop_phone.trim()) {
      return new Response(
        JSON.stringify({ error: "رقم المطبعة مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shop_address || typeof shop_address !== "string" || !shop_address.trim()) {
      return new Response(
        JSON.stringify({ error: "عنوان المطبعة مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = phone.replace(/\s+/g, "").replace(/^0/, "964");
    const syntheticEmail = `${normalizedPhone}@phone.matbaati.local`;
    const displayName = shop_name.trim();

    // Check if user already exists
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users?.find(u => u.email === syntheticEmail);

    let targetUserId: string;

    if (existingUser) {
      targetUserId = existingUser.id;
      // Update password
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
    } else {
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
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetUserId = newUser.user!.id;
    }

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
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: targetUserId, is_new: !existingUser }),
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
