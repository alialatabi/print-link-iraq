import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-triggered sync of Al-Waseet (alwaseet-iq.net merchant API) location reference data into
// public.alwaseet_cities (محافظات) + public.alwaseet_regions (مناطق). One-time / occasional run —
// re-runnable; upserts so existing rows are updated and new areas are added.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALWASEET_API = "https://api.alwaseet-iq.net/v1/merchant";

// Login → merchant token. Login is multipart/form-data { username, password }.
async function login(username: string, password: string): Promise<string> {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  const res = await fetch(`${ALWASEET_API}/login`, { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  const token = body?.data?.token;
  if (!res.ok || !body?.status || !token) {
    throw new Error(`Al-Waseet login failed: ${body?.msg || res.status}`);
  }
  return token as string;
}

// Cities + regions are GET endpoints authenticated with the token as a `?token=` query param
// (consistent with the other documented merchant endpoints).
async function getCities(token: string): Promise<Array<{ id: string; city_name: string }>> {
  const res = await fetch(`${ALWASEET_API}/citys?token=${encodeURIComponent(token)}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) throw new Error(`citys failed: ${body?.msg || res.status}`);
  return Array.isArray(body.data) ? body.data : [];
}

async function getRegions(token: string, cityId: string): Promise<Array<{ id: string; region_name: string }>> {
  const res = await fetch(`${ALWASEET_API}/regions?city_id=${encodeURIComponent(cityId)}&token=${encodeURIComponent(token)}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) throw new Error(`regions(${cityId}) failed: ${body?.msg || res.status}`);
  return Array.isArray(body.data) ? body.data : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Only admins may trigger a sync (it calls an external API + writes reference data).
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "غير مصرح" }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "غير مصرح" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: { role: string }) => r.role === "admin")) {
      return json({ error: "هذه العملية للأدمن فقط" }, 403);
    }

    const username = Deno.env.get("ALWASEET_USERNAME");
    const password = Deno.env.get("ALWASEET_PASSWORD");
    if (!username || !password) return json({ error: "بيانات الوسيط غير مهيأة" }, 500);

    // 1) Auth → token.
    const token = await login(username, password);

    // 2) Cities.
    const cities = await getCities(token);
    const cityRows = cities
      .map((c) => ({ id: Number(c.id), name: String(c.city_name || "").trim(), synced_at: new Date().toISOString() }))
      .filter((c) => Number.isFinite(c.id) && c.name);
    if (cityRows.length) {
      const { error } = await supabaseAdmin.from("alwaseet_cities").upsert(cityRows, { onConflict: "id" });
      if (error) throw new Error(`upsert cities: ${error.message}`);
    }

    // 3) Regions per city.
    let regionCount = 0;
    for (const city of cityRows) {
      const regions = await getRegions(token, String(city.id));
      const regionRows = regions
        .map((r) => ({ id: Number(r.id), city_id: city.id, name: String(r.region_name || "").trim(), synced_at: new Date().toISOString() }))
        .filter((r) => Number.isFinite(r.id) && r.name);
      if (regionRows.length) {
        const { error } = await supabaseAdmin.from("alwaseet_regions").upsert(regionRows, { onConflict: "id" });
        if (error) throw new Error(`upsert regions(${city.id}): ${error.message}`);
        regionCount += regionRows.length;
      }
    }

    return json({ success: true, cities: cityRows.length, regions: regionCount });
  } catch (e) {
    console.error("sync-alwaseet-locations error:", e);
    return json({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }, 500);
  }
});
