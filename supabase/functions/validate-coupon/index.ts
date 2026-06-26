import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS_PLATFORM, getServiceClient } from "../_shared/helpers.ts";

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

    // Verify the user is authenticated
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

    const supabaseAdmin = getServiceClient();

    const { action, code } = await req.json();

    if (action === "list") {
      // Return active coupons with limited fields (no used_count/max_uses)
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("coupons")
        .select("id, code, percentage, is_active, expires_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: "فشل جلب الكوبونات" }),
          { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
        );
      }

      // Filter out expired and maxed-out coupons server-side
      // We need max_uses/used_count for filtering but don't expose them
      const { data: fullData } = await supabaseAdmin
        .from("coupons")
        .select("id, code, percentage, expires_at, max_uses, used_count")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const coupons = (fullData || [])
        .filter(c => {
          if (c.expires_at && c.expires_at < now) return false;
          if (c.max_uses && c.used_count >= c.max_uses) return false;
          return true;
        })
        .map(c => ({
          id: c.id,
          code: c.code,
          percentage: c.percentage,
          expires_at: c.expires_at,
        }));

      return new Response(
        JSON.stringify({ coupons }),
        { status: 200, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    if (action === "validate") {
      if (!code || typeof code !== "string") {
        return new Response(
          JSON.stringify({ error: "كود غير صالح" }),
          { status: 400, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("coupons")
        .select("id, code, percentage, is_active, expires_at, max_uses, used_count")
        .eq("code", code.trim().toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ valid: false, error: "كود غير صالح" }),
          { status: 200, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
        );
      }

      const now = new Date().toISOString();
      if (data.expires_at && data.expires_at < now) {
        return new Response(
          JSON.stringify({ valid: false, error: "الكوبون منتهي الصلاحية" }),
          { status: 200, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
        );
      }
      if (data.max_uses && data.used_count >= data.max_uses) {
        return new Response(
          JSON.stringify({ valid: false, error: "تم استنفاد الكوبون" }),
          { status: 200, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          coupon: { id: data.id, code: data.code, percentage: data.percentage },
        }),
        { status: 200, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "إجراء غير معروف" }),
      { status: 400, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "خطأ غير متوقع" }),
      { status: 500, headers: { ...CORS_HEADERS_PLATFORM, "Content-Type": "application/json" } }
    );
  }
});
