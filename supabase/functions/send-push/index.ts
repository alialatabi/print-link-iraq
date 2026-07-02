import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS, json, getServiceClient } from "../_shared/helpers.ts";

// Sends push notifications via Firebase Cloud Messaging (HTTP v1). Auth (M6): two caller paths.
// Staff (admin / super-admin / designer — super admins hold the `admin` role) may only target
// users who are the customer of some order, so staff can't push to arbitrary users. Any OTHER
// caller (a customer) may only target the assigned designer of their OWN orders (the customer →
// designer approve/revision pushes from OrderTracking) — nothing else. This is not a general
// messaging endpoint. Input:
//   { userId?: string, userIds?: string[], title: string, body: string, data?: Record<string,string> }
// Looks up the targets' device tokens, sends one message per token, and prunes tokens FCM reports
// as unregistered. Needs the FCM_SERVICE_ACCOUNT secret (the full Firebase service-account JSON).

// --- Service-account → OAuth2 access token (RS256-signed JWT, exchanged at Google's token endpoint) ---
const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlStr = (str: string) => b64url(new TextEncoder().encode(str));

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

async function getAccessToken(sa: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64urlStr(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput)));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`token exchange failed: ${JSON.stringify(data).slice(0, 200)}`);
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "غير مصرح" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (userErr || !user) return json({ error: "غير مصرح" }, 401);

    const supabaseAdmin = getServiceClient();

    // M6: the caller's role decides which target rule applies below. A super admin always
    // holds the `admin` role, so user_roles covers them.
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (roles || []).some((r: { role: string }) => ["admin", "designer"].includes(r.role));

    const { userId, userIds, title, body, data } = await req.json();
    const targets: string[] = [...new Set([...(Array.isArray(userIds) ? userIds : []), ...(userId ? [userId] : [])])];
    if (targets.length === 0) return json({ error: "no target users" }, 400);
    if (!title || !body) return json({ error: "title and body required" }, 400);

    if (isStaff) {
      // M6: staff may only push to users who are the customer of some order — blocks pushing to
      // arbitrary users / other staff. AdminPanel and the designer flow always target
      // order.customer_id, so a legitimate call is never rejected here.
      const { data: custRows } = await supabaseAdmin
        .from("orders").select("customer_id").in("customer_id", targets);
      const orderCustomers = new Set((custRows || []).map((r: { customer_id: string }) => r.customer_id));
      if (targets.some((t) => !orderCustomers.has(t))) {
        return json({ error: "الهدف غير صالح" }, 403);
      }
    } else {
      // Customer → designer path: a caller without a staff role may notify ONLY the assigned
      // designers of their OWN orders (the OrderTracking approve/revision pushes). One query:
      // the caller's orders whose designer_id is among the targets — every target must land in
      // that set. Unassigned orders (designer_id NULL) never match, so they grant nothing.
      const { data: ownRows } = await supabaseAdmin
        .from("orders").select("designer_id").eq("customer_id", user.id).in("designer_id", targets);
      const ownDesigners = new Set(
        (ownRows || [])
          .map((r: { designer_id: string | null }) => r.designer_id)
          .filter((d): d is string => typeof d === "string" && d.length > 0),
      );
      if (targets.some((t) => !ownDesigners.has(t))) {
        return json({ error: "يمكنك إشعار مصممي طلباتك فقط" }, 403);
      }
    }

    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) return json({ error: "خدمة الإشعارات غير مهيأة" }, 500);
    const sa = JSON.parse(saRaw);

    const { data: tokenRows } = await supabaseAdmin
      .from("device_tokens").select("token").in("user_id", targets);
    const tokens = (tokenRows || []).map((t: { token: string }) => t.token);
    if (tokens.length === 0) return json({ success: true, sent: 0, note: "no devices" });

    const accessToken = await getAccessToken(sa);
    const dataStr: Record<string, string> = {};
    if (data && typeof data === "object") for (const [k, v] of Object.entries(data)) dataStr[k] = String(v);

    let sent = 0;
    const stale: string[] = [];
    for (const token of tokens) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: { token, notification: { title, body }, data: dataStr, android: { priority: "high" } },
        }),
      });
      if (res.ok) { sent++; continue; }
      // 404 UNREGISTERED / 400 invalid → token is dead, drop it.
      if (res.status === 404 || res.status === 400) stale.push(token);
      else console.error("FCM send error", res.status, (await res.text()).slice(0, 200));
    }
    if (stale.length) await supabaseAdmin.from("device_tokens").delete().in("token", stale);

    return json({ success: true, sent, pruned: stale.length, devices: tokens.length });
  } catch (e) {
    console.error("send-push error:", e);
    return json({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }, 500);
  }
});
